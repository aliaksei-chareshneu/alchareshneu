-- Prepared additive migration: payments are NEVER verified from an uploaded screenshot.
-- Deployment requires owner GO and reconciliation with the live register Edge Function.
-- The upload bucket is private; only service-role server functions access records.
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
    check (payment_gate in ('FREE','PROOF_PENDING','PROOF_VERIFIED','PACKAGE_VERIFIED'));
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
language plpgsql security definer set search_path=''
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
     and price_czk>0 and begins_at>now();
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
language plpgsql security definer set search_path=''
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
