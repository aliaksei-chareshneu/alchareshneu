-- Imperion RSVP: adult Druzina enquiries use the existing registration service.
-- Applied to the linked Supabase project as migration imperion_druzina_enquiry_inbox.
CREATE TABLE IF NOT EXISTS public.imperion_rsvp_enquiries (
 id uuid primary key default gen_random_uuid(),
 first_name text not null check (char_length(first_name) between 2 and 80),
 last_name text not null check (char_length(last_name) between 2 and 80),
 contact text not null check (char_length(contact) between 7 and 254),
 contact_kind text not null check (contact_kind in ('email','phone')),
 visit_type text not null check (visit_type in ('FIRST','RETURNING')),
 preferred_day text not null check (preferred_day in ('NEXT','MON','SAT','DATE')),
 preferred_date date,
 adult_confirmed boolean not null check (adult_confirmed = true),
 safety_acknowledged boolean not null check (safety_acknowledged = true),
 safety_version text not null default '2026-10-25-v2',
 language text not null check (language in ('cs','en','ru','uk')),
 data_controller text not null default 'Družina Moravy, z. s.',
 source text not null default 'site-druzina-first-visit',
 status text not null default 'RECEIVED_UNCONFIRMED'
  check (status in ('RECEIVED_UNCONFIRMED','CONTACTED','CONFIRMED','DECLINED','CLOSED')),
 created_at timestamptz not null default now(),
 retention_until timestamptz not null default (now() + interval '90 days'),
 constraint imperion_enquiry_date_guard check
 ((preferred_day='DATE' and preferred_date is not null) or
  (preferred_day<>'DATE' and preferred_date is null))
);
create index if not exists imperion_enquiries_received_idx
 on public.imperion_rsvp_enquiries(status,created_at desc);
create index if not exists imperion_enquiries_expiry_idx
 on public.imperion_rsvp_enquiries(retention_until);
alter table public.imperion_rsvp_enquiries enable row level security;
revoke all on table public.imperion_rsvp_enquiries from public,anon,authenticated;
grant select,insert,update,delete on table public.imperion_rsvp_enquiries to service_role;
select cron.schedule('imperion_rsvp_enquiries_retention_0330',
 '30 3 * * *', $$delete from public.imperion_rsvp_enquiries
 where retention_until <= now();$$);
