-- Prepared additive migration: payments are NEVER verified from an uploaded screenshot.
-- Deployment requires owner GO and reconciliation with the live register Edge Function.
-- The upload bucket is private; only service-role server functions access records.
-- Payment collection is a separate, explicit event approval.
-- A price on an unconfirmed / interest-only event must NOT invite prepayment.
alter table public.imperion_rsvp_events
 add column if not exists payment_gate_mode text not null default 'NONE'
 check (payment_gate_mode in ('NONE','PROOF_OR_PACKAGE'));
alter table public.imperion_rsvp_events
 add constraint imperion_event_payment_gate_positive
 check (payment_gate_mode <> 'PROOF_OR_PACKAGE' or price_czk > 0);

create table if not exists public.imperion_payment_evidence (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.imperion_rsvp_events(event_id),
  attendee_email text not null check (length(attendee_email) between 5 and 254),
  data_controller text not null,
  expected_amount_czk integer not null check (expected_amount_czk > 0),
  declared_amount_czk integer not null check (declared_amount_czk > 0),
  declared_reference text check (length(declared_reference) <= 80),
  declared_paid_on date,
  storage_path text not null unique,
  file_sha256 text not null check (file_sha256 ~ '^[a-f0-9]{64}$'),
  media_type text not null check (media_type in ('image/png','image/jpeg','image/webp','application/pdf')),
  file_bytes integer not null check (file_bytes between 1024 and 4194304),
  precheck jsonb not null default '{}'::jsonb,
  review_status text not null default 'PENDING_BANK_REVIEW'
    check (review_status in ('PENDING_BANK_REVIEW','VERIFIED','REJECTED')),
  bank_transaction_reference text,
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  retention_until timestamptz not null,
  constraint imperion_proof_verification_requires_bank
    check (review_status <> 'VERIFIED' or
      (bank_transaction_reference is not null and verified_by is not null and verified_at is not null)),
  unique (data_controller, file_sha256)
);
create index if not exists imperion_evidence_pending_idx
 on public.imperion_payment_evidence(review_status,created_at);
create index if not exists imperion_evidence_retention_idx
 on public.imperion_payment_evidence(retention_until);

alter table public.imperion_rsvp_submissions
  add column if not exists payment_evidence_id uuid unique
    references public.imperion_payment_evidence(id),
  add column if not exists payment_gate text
    check (payment_gate in ('FREE','INQUIRY_NO_PAYMENT','PROOF_PENDING','PROOF_VERIFIED','PACKAGE_VERIFIED'));
comment on column public.imperion_rsvp_submissions.payment_gate is
 'NULL = historic unverified legacy submission; PROOF_PENDING is NEVER a paid place.';

create table if not exists public.imperion_paid_packages (
  id uuid primary key default gen_random_uuid(),
  code_sha256 text not null unique check (code_sha256 ~ '^[a-f0-9]{64}$'),
  owner_email text not null check (length(owner_email) between 5 and 254),
  data_controller text not null,
  total_uses integer not null check (total_uses between 1 and 1000),
  paid_total_czk integer not null check (paid_total_czk > 0),
  active_from date not null default current_date,
  expires_at timestamptz,
  status text not null default 'PENDING'
    check (status in ('PENDING','ACTIVE','VOIDED','EXPIRED')),
  verified_at timestamptz,
  verified_by text,
  bank_transaction_reference text,
  created_at timestamptz not null default now(),
  constraint imperion_package_activation_requires_bank
    check (status <> 'ACTIVE' or
      (verified_at is not null and verified_by is not null and bank_transaction_reference is not null))
);
comment on table public.imperion_paid_packages is
 'Store only a hash of a high-entropy code. Activate only after independent bank readback. Controller-bound: no OSVC/NGO mixing.';

create table if not exists public.imperion_package_visits (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.imperion_paid_packages(id),
  submission_id uuid not null unique references public.imperion_rsvp_submissions(id),
  event_id text not null references public.imperion_rsvp_events(event_id),
  units integer not null default 1 check (units = 1),
  state text not null default 'RESERVED'
    check (state in ('RESERVED','CONSUMED','RELEASED')),
  reserved_at timestamptz not null default now(),
  consumed_at timestamptz,
  consumed_by text,
  release_reason text,
  constraint imperion_visit_attendance_readback check
    (state <> 'CONSUMED' or (consumed_at is not null and consumed_by is not null))
);
create index if not exists imperion_package_visits_balance_idx
 on public.imperion_package_visits(package_id,state);
comment on column public.imperion_package_visits.state is
 'RESERVED on application; CONSUMED only after verified attendance; RELEASED when reservation cancelled.';

create or replace view public.imperion_package_balances
with (security_invoker=true) as
select p.id,p.owner_email,p.data_controller,p.total_uses,p.paid_total_czk,p.status,
  count(v.id) filter (where v.state='RESERVED')::integer as reserved_uses,
  count(v.id) filter (where v.state='CONSUMED')::integer as consumed_uses,
  (p.total_uses - count(v.id) filter (where v.state in ('RESERVED','CONSUMED')))::integer as available_uses
from public.imperion_paid_packages p
left join public.imperion_package_visits v on v.package_id=p.id
group by p.id;

-- An atomic operation: a package is locked before a new RSVP and reservation
-- are created. Failed / overdrawn / duplicate calls roll back both writes.
create or replace function public.imperion_reserve_package_registration(
  p_code text, p_registration jsonb
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare
  v_event public.imperion_rsvp_events%rowtype;
  v_pack public.imperion_paid_packages%rowtype;
  v_id uuid;
  v_used int;
  v_reserved int;
  v_email text;
  v_event_id text;
begin
  v_email := lower(trim(p_registration->>'email'));
  v_event_id := p_registration->>'event_id';
  if p_code !~ '^[A-Za-z0-9]{16,64}$' or v_email is null or v_event_id is null then
    raise exception 'invalid_package';
  end if;
  select * into v_event from public.imperion_rsvp_events
   where event_id=v_event_id and is_open=true and public_listing=true
     and source_active=true and registration_mode='FORM'
     and price_verified=true and end_time_verified=true
     and price_czk>0 and payment_gate_mode='PROOF_OR_PACKAGE' and begins_at>now();
  if not found then raise exception 'event_unavailable'; end if;
  select * into v_pack from public.imperion_paid_packages
   where code_sha256=encode(pg_catalog.sha256(pg_catalog.convert_to(upper(trim(p_code)),'UTF8')),'hex')
     and owner_email=v_email and data_controller=v_event.data_controller
     and status='ACTIVE' and verified_at is not null
     and active_from<=current_date and (expires_at is null or expires_at>now())
   for update;
  if not found then raise exception 'package_not_valid'; end if;
  select count(*) filter (where state='CONSUMED')::integer,
         count(*) filter (where state='RESERVED')::integer
    into v_used,v_reserved
  from public.imperion_package_visits where package_id=v_pack.id;
  if v_used+v_reserved>=v_pack.total_uses then raise exception 'package_exhausted'; end if;
  if (p_registration->>'rsvp_status') <> 'YES' then raise exception 'paid_event_requires_yes'; end if;
  insert into public.imperion_rsvp_submissions
   (event_id,first_name,last_name,email,phone,age_group,guardian_name,guardian_phone,
    rsvp_status,safety_acknowledged,safety_version,photo_choice,marketing_requested,
    data_controller,language,source,status,retention_until,
    discovery_source,utm_source,utm_medium,utm_campaign,payment_gate)
  values
   (v_event_id,p_registration->>'first_name',p_registration->>'last_name',v_email,
    p_registration->>'phone',p_registration->>'age_group',
    nullif(p_registration->>'guardian_name',''),nullif(p_registration->>'guardian_phone',''),
    'YES',true,'2026-10-25-v1',p_registration->>'photo_choice',
    coalesce((p_registration->>'marketing_requested')::boolean,false),
    v_event.data_controller,p_registration->>'language','site-register',
    'RECEIVED_UNCONFIRMED',v_event.ends_at+interval '90 days',
    nullif(p_registration->>'discovery_source',''),
    nullif(p_registration->>'utm_source',''),
    nullif(p_registration->>'utm_medium',''),
    nullif(p_registration->>'utm_campaign',''),'PACKAGE_VERIFIED')
  returning id into v_id;
  insert into public.imperion_package_visits(package_id,submission_id,event_id,state)
    values (v_pack.id,v_id,v_event_id,'RESERVED');
  return jsonb_build_object(
    'ok',true,'status','RESERVED','available',v_pack.total_uses-v_used-v_reserved-1,
    'consumed',v_used,'reserved',v_reserved+1,'submissionId',v_id
  );
end;
$$;

create or replace function public.imperion_evidence_review_sync()
returns trigger
language plpgsql security invoker set search_path=''
as $$
begin
  if new.review_status='VERIFIED' and old.review_status <> 'VERIFIED' then
    update public.imperion_rsvp_submissions
       set payment_gate='PROOF_VERIFIED',status='RECEIVED_UNCONFIRMED'
     where payment_evidence_id=new.id and payment_gate='PROOF_PENDING';
  end if;
  return new;
end;
$$;
drop trigger if exists imperion_evidence_review_sync on public.imperion_payment_evidence;
create trigger imperion_evidence_review_sync
after update of review_status on public.imperion_payment_evidence
for each row execute function public.imperion_evidence_review_sync();

-- Explicit Data API privilege: after 2026-10-30, new public tables may not
-- be granted automatically; never grant anonymous clients access.
alter table public.imperion_payment_evidence enable row level security;
alter table public.imperion_paid_packages enable row level security;
alter table public.imperion_package_visits enable row level security;
revoke all on table public.imperion_payment_evidence,public.imperion_paid_packages,
  public.imperion_package_visits,public.imperion_package_balances from PUBLIC,anon,authenticated;
grant select,insert,update,delete on public.imperion_payment_evidence,
  public.imperion_paid_packages,public.imperion_package_visits to service_role;
grant select on public.imperion_package_balances to service_role;
revoke all on function public.imperion_reserve_package_registration(text,jsonb),
 public.imperion_evidence_review_sync() from PUBLIC,anon,authenticated;
grant execute on function public.imperion_reserve_package_registration(text,jsonb) to service_role;

-- Never make this bucket public; do not add public object read/insert policies.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('imperion-payment-private','imperion-payment-private',false,4194304,
  array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do nothing;


-- A service-role-only owner action after actual attendance is reconciled
-- to the existing CRM / attendance journal. It is idempotent.
-- A mere registration or reservation never consumes a visit.
create or replace function public.imperion_set_package_visit_state(
  p_submission_id uuid, p_state text, p_actor text,
  p_reason text default null
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare
  v_visit public.imperion_package_visits%rowtype;
  v_pack public.imperion_paid_packages%rowtype;
  v_remaining integer;
begin
  if p_state not in ('CONSUMED','RELEASED') or length(trim(p_actor))<3 then
    raise exception 'invalid_state_or_actor';
  end if;
  select * into v_visit from public.imperion_package_visits
    where submission_id=p_submission_id for update;
  if not found then raise exception 'visit_not_found'; end if;
  select * into v_pack from public.imperion_paid_packages
    where id=v_visit.package_id for update;
  if v_visit.state=p_state then
    return jsonb_build_object('ok',true,'unchanged',true,'state',v_visit.state);
  end if;
  if v_visit.state<>'RESERVED' then raise exception 'state_transition_forbidden'; end if;
  if p_state='CONSUMED' then
    update public.imperion_package_visits
       set state='CONSUMED',consumed_at=now(),consumed_by=left(trim(p_actor),140)
     where id=v_visit.id;
  else
    if p_reason is null or length(trim(p_reason))<3 then
      raise exception 'release_reason_required';
    end if;
    update public.imperion_package_visits
       set state='RELEASED',release_reason=left(trim(p_reason),400)
     where id=v_visit.id;
  end if;
  select (v_pack.total_uses-count(*))::integer into v_remaining
    from public.imperion_package_visits
   where package_id=v_pack.id and state in ('CONSUMED','RESERVED');
  return jsonb_build_object('ok',true,'unchanged',false,'state',p_state,
    'available',v_remaining);
end;
$$;
revoke all on function public.imperion_set_package_visit_state(uuid,text,text,text)
  from PUBLIC,anon,authenticated;
grant execute on function public.imperion_set_package_visit_state(uuid,text,text,text)
  to service_role;

-- Duplicate financial transaction IDs must never approve two independent receipts.
-- The true bank transaction identity must be recorded with the paying entity/controller.
create unique index if not exists imperion_payment_evidence_bank_ref_unique
 on public.imperion_payment_evidence(data_controller,bank_transaction_reference)
 where review_status='VERIFIED';
create unique index if not exists imperion_paid_packages_bank_ref_unique
 on public.imperion_paid_packages(data_controller,bank_transaction_reference)
 where status='ACTIVE';

-- Readback for authorised service-role owner: grouped by controller, event and gate.
-- PII remains inside the database and is not exposed to anon/authenticated roles.
create or replace view public.imperion_payment_gate_readback
with (security_invoker=true) as
select e.event_id,e.data_controller,
 count(s.id) filter (where s.payment_gate='PROOF_PENDING')::integer as awaiting_bank,
 count(s.id) filter (where s.payment_gate='PROOF_VERIFIED')::integer as bank_checked,
 count(s.id) filter (where s.payment_gate='PACKAGE_VERIFIED')::integer as valid_package_reservations
from public.imperion_rsvp_events e
left join public.imperion_rsvp_submissions s on s.event_id=e.event_id
group by e.event_id,e.data_controller;
revoke all on public.imperion_payment_gate_readback from PUBLIC,anon,authenticated;
grant select on public.imperion_payment_gate_readback to service_role;


-- Independent bank-statement reconciliation, not screenshot OCR.
-- Only a trusted owner-side statement import/bank API is permitted to populate this.
create table if not exists public.imperion_bank_movements (
  id uuid primary key default gen_random_uuid(),
  data_controller text not null,
  provider_transaction_id text not null check (length(provider_transaction_id) between 5 and 180),
  source_kind text not null
    check (source_kind in ('BANK_API','OWNER_STATEMENT_EXPORT')),
  imported_by text not null check (length(imported_by) between 3 and 180),
  imported_at timestamptz not null default now(),
  booked_on date not null,
  amount_czk integer not null check (amount_czk > 0),
  payment_reference text,
  matched_evidence_id uuid unique references public.imperion_payment_evidence(id),
  matched_package_id uuid unique references public.imperion_paid_packages(id),
  matched_at timestamptz,
  matched_by text,
  constraint imperion_bank_use_once check
    (matched_evidence_id is null or matched_package_id is null),
  constraint imperion_bank_marked_by_actor check
    ((matched_evidence_id is null and matched_package_id is null and
      matched_at is null and matched_by is null)
     or ((matched_evidence_id is not null or matched_package_id is not null)
       and matched_at is not null and matched_by is not null)),
  unique (data_controller,provider_transaction_id)
);
alter table public.imperion_bank_movements enable row level security;
revoke all on public.imperion_bank_movements from PUBLIC,anon,authenticated;
grant select,insert,update,delete on public.imperion_bank_movements to service_role;

alter table public.imperion_payment_evidence
  add column if not exists bank_movement_id uuid unique
    references public.imperion_bank_movements(id);
alter table public.imperion_paid_packages
  add column if not exists bank_movement_id uuid unique
    references public.imperion_bank_movements(id);
alter table public.imperion_payment_evidence
  add constraint imperion_verified_requires_trusted_bank_movement
  check (review_status <> 'VERIFIED' or bank_movement_id is not null);
alter table public.imperion_paid_packages
  add constraint imperion_active_requires_trusted_bank_movement
  check (status <> 'ACTIVE' or bank_movement_id is not null);

-- Owner readback must import bank records from the correct legal entity,
-- match the real statement transaction and identity, then execute this RPC.
-- A receipt, text or image alone can NEVER produce VERIFIED.
create or replace function public.imperion_reconcile_bank_evidence(
  p_evidence_id uuid, p_bank_movement_id uuid, p_actor text
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare
 v_proof public.imperion_payment_evidence%rowtype;
 v_bank public.imperion_bank_movements%rowtype;
begin
 if length(trim(p_actor))<3 then raise exception 'actor_required'; end if;
 select * into v_proof from public.imperion_payment_evidence
  where id=p_evidence_id for update;
 if not found or v_proof.review_status<>'PENDING_BANK_REVIEW' then
  raise exception 'evidence_not_pending';
 end if;
 select * into v_bank from public.imperion_bank_movements
  where id=p_bank_movement_id for update;
 if not found or v_bank.matched_evidence_id is not null or
   v_bank.matched_package_id is not null or
   v_bank.data_controller<>v_proof.data_controller or
   v_bank.amount_czk<>v_proof.expected_amount_czk
 then raise exception 'bank_match_invalid'; end if;
 if v_proof.declared_reference is not null and v_bank.payment_reference is not null and
    lower(trim(v_proof.declared_reference))<>lower(trim(v_bank.payment_reference))
 then raise exception 'reference_mismatch'; end if;
 update public.imperion_bank_movements set
  matched_evidence_id=v_proof.id,matched_at=now(),matched_by=left(trim(p_actor),140)
  where id=v_bank.id;
 update public.imperion_payment_evidence set
  review_status='VERIFIED',bank_movement_id=v_bank.id,
  bank_transaction_reference=v_bank.provider_transaction_id,
  verified_by=left(trim(p_actor),140),verified_at=now()
  where id=v_proof.id;
 return jsonb_build_object('ok',true,'status','VERIFIED','evidenceId',v_proof.id);
end;
$$;
revoke all on function public.imperion_reconcile_bank_evidence(uuid,uuid,text)
 from PUBLIC,anon,authenticated;
grant execute on function public.imperion_reconcile_bank_evidence(uuid,uuid,text)
 to service_role;

create or replace function public.imperion_activate_package_from_bank(
  p_package_id uuid, p_bank_movement_id uuid, p_actor text
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare
 v_pack public.imperion_paid_packages%rowtype;
 v_bank public.imperion_bank_movements%rowtype;
begin
 if length(trim(p_actor))<3 then raise exception 'actor_required'; end if;
 select * into v_pack from public.imperion_paid_packages
  where id=p_package_id for update;
 if not found or v_pack.status<>'PENDING' then raise exception 'package_not_pending'; end if;
 select * into v_bank from public.imperion_bank_movements
  where id=p_bank_movement_id for update;
 if not found or v_bank.matched_evidence_id is not null or
   v_bank.matched_package_id is not null or
   v_bank.data_controller<>v_pack.data_controller or
   v_bank.amount_czk<>v_pack.paid_total_czk
 then raise exception 'bank_match_invalid'; end if;
 update public.imperion_bank_movements set
  matched_package_id=v_pack.id,matched_at=now(),matched_by=left(trim(p_actor),140)
  where id=v_bank.id;
 update public.imperion_paid_packages set
  status='ACTIVE',bank_movement_id=v_bank.id,
  bank_transaction_reference=v_bank.provider_transaction_id,
  verified_by=left(trim(p_actor),140),verified_at=now()
  where id=v_pack.id;
 return jsonb_build_object('ok',true,'status','ACTIVE','packageId',v_pack.id,
   'totalUses',v_pack.total_uses,'availableUses',v_pack.total_uses);
end;
$$;
revoke all on function public.imperion_activate_package_from_bank(uuid,uuid,text)
 from PUBLIC,anon,authenticated;
grant execute on function public.imperion_activate_package_from_bank(uuid,uuid,text)
 to service_role;
