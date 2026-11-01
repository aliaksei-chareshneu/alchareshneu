-- Secure, separately controlled public event intake. No anonymous database access.
create table if not exists public.imperion_rsvp_events (
  event_id text primary key check (event_id ~ '^[A-Za-z0-9-]{2,100}$'),
  title text not null check (char_length(title) between 3 and 180),
  community text not null,
  category text not null,
  begins_at timestamptz not null,
  ends_at timestamptz not null,
  venue text not null,
  price_czk integer not null default 0 check (price_czk between 0 and 999999),
  data_controller text not null,
  rules_url text not null check (rules_url like 'https://aliaksei-chareshneu.github.io/alchareshneu/%'),
  contact_activity boolean not null default false,
  public_listing boolean not null default true,
  is_open boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint imperion_event_end_after_start check (ends_at > begins_at)
);

create table if not exists public.imperion_rsvp_submissions (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.imperion_rsvp_events(event_id),
  first_name text not null check (char_length(first_name) between 2 and 80),
  last_name text not null check (char_length(last_name) between 2 and 80),
  email text not null check (char_length(email) between 5 and 254),
  phone text not null check (char_length(phone) between 7 and 35),
  age_group text not null check (age_group in ('adult','under18')),
  guardian_name text,
  guardian_phone text,
  rsvp_status text not null check (rsvp_status in ('YES','MAYBE','NO')),
  safety_acknowledged boolean not null check (safety_acknowledged = true),
  safety_version text not null,
  photo_choice text not null check (photo_choice in ('YES','NO')),
  marketing_requested boolean not null default false,
  data_controller text not null,
  language text not null check (language in ('en','cs','ru','uk')),
  source text not null default 'site-register',
  status text not null default 'RECEIVED_UNCONFIRMED',
  created_at timestamptz not null default now(),
  retention_until timestamptz not null,
  constraint imperion_minor_guardian check (
    age_group = 'adult' or
    (length(coalesce(guardian_name,'')) >= 3 and length(coalesce(guardian_phone,'')) >= 7
     and photo_choice = 'NO' and marketing_requested = false)
  )
);
create unique index if not exists imperion_rsvp_submission_dedupe_idx
  on public.imperion_rsvp_submissions (event_id, lower(email), lower(first_name), lower(last_name));
create index if not exists imperion_rsvp_expiry_idx
  on public.imperion_rsvp_submissions(retention_until);

-- An opt-in request is not a confirmed mailing-list subscription.
-- No event histories or phone numbers are stored here.
create table if not exists public.imperion_rsvp_invite_requests (
  id uuid primary key default gen_random_uuid(),
  data_controller text not null,
  email text not null,
  first_name text not null,
  requested_at timestamptz not null default now(),
  confirmation_status text not null default 'PENDING_CONFIRMATION'
    check (confirmation_status in ('PENDING_CONFIRMATION','CONFIRMED','WITHDRAWN')),
  expires_at timestamptz not null default (now() + interval '365 days')
);
create unique index if not exists imperion_rsvp_invite_dedupe_idx
  on public.imperion_rsvp_invite_requests(data_controller, lower(email));
create index if not exists imperion_rsvp_invite_expiry_idx
  on public.imperion_rsvp_invite_requests(expires_at);

-- Hashes are computed by the Edge Function using a server-side secret;
-- never retain the plaintext visitor IP or a hash tied to a contact.
create table if not exists public.imperion_rsvp_rate_limits (
  bucket_key text not null check (bucket_key ~ '^[a-f0-9]{64}$'),
  bucket_day date not null,
  attempts integer not null default 1 check (attempts between 1 and 1000),
  primary key(bucket_key,bucket_day)
);

alter table public.imperion_rsvp_events enable row level security;
alter table public.imperion_rsvp_submissions enable row level security;
alter table public.imperion_rsvp_invite_requests enable row level security;
alter table public.imperion_rsvp_rate_limits enable row level security;
revoke all on table public.imperion_rsvp_events,
  public.imperion_rsvp_submissions,
  public.imperion_rsvp_invite_requests,
  public.imperion_rsvp_rate_limits from public,anon,authenticated;
grant select,insert,update,delete on table public.imperion_rsvp_events,
  public.imperion_rsvp_submissions,
  public.imperion_rsvp_invite_requests,
  public.imperion_rsvp_rate_limits to service_role;

-- Atomic per-day budget; only service_role can call this RPC.
create or replace function public.imperion_rsvp_allow_request(p_key text,p_limit integer default 10)
returns boolean language plpgsql security invoker set search_path = public,pg_temp as $fn$
declare v_hits integer;
begin
  if p_key !~ '^[a-f0-9]{64}$' or p_limit < 1 or p_limit > 30 then return false; end if;
  insert into public.imperion_rsvp_rate_limits as r(bucket_key,bucket_day,attempts)
  values (p_key,(now() at time zone 'utc')::date,1)
  on conflict(bucket_key,bucket_day) do update
    set attempts = r.attempts+1 where r.attempts < p_limit
  returning attempts into v_hits;
  return v_hits is not null;
end;
$fn$;
revoke all on function public.imperion_rsvp_allow_request(text,integer) from public,anon,authenticated;
grant execute on function public.imperion_rsvp_allow_request(text,integer) to service_role;

insert into public.imperion_rsvp_events(event_id,title,community,category,begins_at,ends_at,venue,
  price_czk,data_controller,rules_url,contact_activity,public_listing,is_open)
values
 ('PUB-HIKE-20261101','BrnoWalkers: Hády – Růženin lom – Obřany','BrnoWalkers / Morava v pohybu','Hike',
  '2026-11-01T11:45:00Z','2026-11-01T15:15:00Z','Velká Klajdovka, Brno',0,
  'Družina Moravy, z. s.',
  'https://aliaksei-chareshneu.github.io/alchareshneu/register/safety/',false,true,true),
 ('PUB-OREL-20261114','Free beginner HEMA workshop - Orel Husovice','Družina Moravy','HEMA Training',
  '2026-11-14T11:00:00Z','2026-11-14T13:30:00Z','Orlovna Husovice, Vranovská 93, Brno',0,
  'Družina Moravy, z. s.',
  'https://aliaksei-chareshneu.github.io/alchareshneu/druzina/safety/',true,true,false)
on conflict (event_id) do nothing;

-- Daily irreversible data minimization. Do not retain activity histories
-- in the separate invitation opt-in request table.
select cron.schedule('imperion_rsvp_retention_0315','15 3 * * *',
  $$delete from public.imperion_rsvp_submissions where retention_until <= now();
    delete from public.imperion_rsvp_invite_requests where expires_at <= now();
    delete from public.imperion_rsvp_rate_limits where bucket_day < ((now() at time zone 'utc')::date-7);$$);
