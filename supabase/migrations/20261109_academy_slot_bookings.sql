-- Academy slots + PDF receipt intake; PREPARED ONLY. Apply after owner release approval.
-- Reuse public.imperion_academy_inquiries as the CRM-facing intake. No new CRM.
create table if not exists public.imperion_academy_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  service_code text not null check (service_code in ('LESSON','CONSULT')),
  delivery_mode text not null default 'ONLINE' check (delivery_mode in ('ONLINE','BRNO')),
  is_open boolean not null default false,
  owner_approved_at timestamptz,
  source_reference text not null default '',
  created_at timestamptz not null default now(),
  constraint academy_slot_duration check (
    ends_at = starts_at +
    case when service_code='LESSON' then interval '60 minutes'
         else interval '15 minutes' end
  ),
  constraint academy_slot_source_len check (char_length(source_reference)<=300)
);
-- Do not expose an owner's Google Calendar event IDs or private free/busy.
-- In addition to exclusive claims, prevent overlapping appointment windows.
alter table public.imperion_academy_slots
  add constraint academy_published_slot_no_overlap exclude using gist
  (tstzrange(starts_at,ends_at,'[)') with &&)
  where (is_open and owner_approved_at is not null);
alter table public.imperion_academy_slots enable row level security;
revoke all on public.imperion_academy_slots from anon, authenticated;
grant select, insert, update, delete on public.imperion_academy_slots to service_role;
create index if not exists academy_slots_open_idx
  on public.imperion_academy_slots (starts_at)
  where is_open and owner_approved_at is not null;

-- Existing programme enquiries remain intact; only new lesson bookings use these fields.
alter table public.imperion_academy_inquiries
  add column if not exists slot_id uuid references public.imperion_academy_slots(id),
  add column if not exists subject_code text,
  add column if not exists delivery_mode text,
  add column if not exists base_price_czk integer,
  add column if not exists surcharge_czk integer,
  add column if not exists quoted_total_czk integer,
  add column if not exists receipt_path text,
  add column if not exists receipt_submitted_at timestamptz,
  add column if not exists payment_status text not null default 'NOT_CHECKED';

alter table public.imperion_academy_inquiries
  drop constraint if exists imperion_academy_inquiries_product_code_check;
alter table public.imperion_academy_inquiries
  add constraint imperion_academy_inquiries_product_code_check
  check (product_code in ('UNI','MED','A2','CER','CAREER','DEFENSE','EXEC','LIFE','LESSON','CONSULT'));

-- Prevent two pending/confirmed clients from claiming the same slot.
create unique index if not exists imperion_academy_one_live_booking_per_slot
 on public.imperion_academy_inquiries(slot_id)
 where slot_id is not null and status in ('PENDING_BANK_CHECK','PAYMENT_VERIFIED','BOOKING_CONFIRMED');

-- Every booking is written by a server-side service_role, never a public user.
-- This function is SECURITY INVOKER and not callable by anon/authenticated.
create or replace function public.imperion_academy_claim_slot(
  p_slot uuid, p_name text, p_email text, p_subject text, p_locale text,
  p_goal text, p_receipt_path text, p_idempotency text,
  p_privacy boolean, p_adult_or_guardian boolean
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_slot public.imperion_academy_slots%rowtype;
  v_existing public.imperion_academy_inquiries%rowtype;
  v_id uuid;
  v_base integer;
  v_fee integer;
  v_total integer;
begin
  if not coalesce(p_privacy,false) or not coalesce(p_adult_or_guardian,false)
     or char_length(trim(coalesce(p_name,''))) not between 2 and 110
     or char_length(trim(coalesce(p_email,''))) not between 6 and 180
     or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or p_subject not in ('CZECH','ENGLISH','GERMAN','MATHS','PHYSICS','CHEMISTRY','BIOLOGY','PROGRAMMING','OTHER')
     or p_locale not in ('en','cs','ru','uk')
     or char_length(coalesce(p_goal,''))>500
     or p_receipt_path !~ '^proofs/[0-9a-f-]{36}[.]pdf$'
     or p_idempotency !~ '^[0-9a-f]{64}$'
  then raise exception 'invalid_booking_fields' using errcode='22023'; end if;

  select * into v_existing from public.imperion_academy_inquiries
   where idempotency_key=p_idempotency;
  if found then
    return jsonb_build_object('reference',v_existing.id,'status',v_existing.status,
      'total_czk',v_existing.quoted_total_czk,'duplicate',true);
  end if;

  select * into v_slot from public.imperion_academy_slots
   where id=p_slot for update;
  if not found or not v_slot.is_open or v_slot.owner_approved_at is null
     or v_slot.starts_at < now()+interval '2 hours'
     or v_slot.starts_at > now()+interval '45 days'
  then raise exception 'slot_unavailable' using errcode='22023'; end if;
  if exists(select 1 from public.imperion_academy_inquiries
     where slot_id=p_slot and status in ('PENDING_BANK_CHECK','PAYMENT_VERIFIED','BOOKING_CONFIRMED'))
  then raise exception 'slot_unavailable' using errcode='23505'; end if;

  v_base := case when v_slot.service_code='LESSON' then 1000 else 250 end;
  -- Provisional quote uses receipt submission time; bank-cleared payment time
  -- must be verified separately and can change the final amount.
  v_fee := case when now()>v_slot.starts_at-interval '48 hours'
                then ceil(v_base*0.25)::integer else 0 end;
  v_total := v_base+v_fee;

  insert into public.imperion_academy_inquiries
    (first_name,email,product_code,goal,deadline,locale,source,
     privacy_acknowledged,adult_or_guardian_confirmed,idempotency_key,
     status,slot_id,subject_code,delivery_mode,base_price_czk,
     surcharge_czk,quoted_total_czk,receipt_path,receipt_submitted_at,payment_status)
  values
    (trim(p_name),lower(trim(p_email)),v_slot.service_code,coalesce(p_goal,''),
     '',p_locale,'academy_booking_20261109',true,true,p_idempotency,
     'PENDING_BANK_CHECK',p_slot,p_subject,v_slot.delivery_mode,
     v_base,v_fee,v_total,p_receipt_path,now(),'PROOF_UPLOADED_UNVERIFIED')
  returning id into v_id;

  return jsonb_build_object('reference',v_id,'status','PENDING_BANK_CHECK',
        'total_czk',v_total,'surcharge_czk',v_fee,'duplicate',false);
end $$;
revoke all on function public.imperion_academy_claim_slot(
 uuid,text,text,text,text,text,text,text,boolean,boolean
) from public, anon, authenticated;
grant execute on function public.imperion_academy_claim_slot(
 uuid,text,text,text,text,text,text,text,boolean,boolean
) to service_role;

-- Bucket provision required separately via Supabase Storage API:
-- 'imperion-academy-payment-proofs', PRIVATE, max_file_size=4 MiB, PDF only.
-- No example slots are published. Owner must approve source availability.
