-- Recover the existing B2B schema for isolated QA; do not create another inbox.
-- Existing production table is preserved. Apply ONLY after owner GO and schema readback.
create table if not exists public.imperion_b2b_inquiries (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 company text not null check (char_length(btrim(company)) between 2 and 150),
 contact_name text not null check (char_length(btrim(contact_name)) between 2 and 110),
 email text not null check (char_length(email) between 5 and 180),
 phone text check (char_length(phone)<=42),
 offer text not null check (offer in ('AI_WORKSHOP','DATA_PILOT','SCIENTIFIC_CONSULTING','HEMA_CORPORATE')),
 summary text not null check (char_length(btrim(summary)) between 15 and 1300),
 budget_band text not null check (budget_band in ('<15000','15000-30000','30000-70000','70000+','unknown')),
 preferred_timeframe text not null check (char_length(preferred_timeframe) between 2 and 90),
 team_size integer check (team_size between 1 and 500),
 source text not null default 'corporate_website' check (char_length(source) between 2 and 65),
 privacy_acknowledged boolean not null check (privacy_acknowledged is true),
 status text not null default 'NEW_UNCONFIRMED' check (status in ('NEW_UNCONFIRMED','QUALIFIED','SCOPE_AGREED','CONTRACTED','CLOSED','SPAM')),
 crm_synced_at timestamptz,
 retention_until timestamptz not null default now()+interval '180 days',
 idempotency_key text not null unique check (idempotency_key ~ '^[a-f0-9]{64}$')
);
alter table public.imperion_b2b_inquiries enable row level security;
revoke all on public.imperion_b2b_inquiries from public,anon,authenticated;
grant select,insert,update,delete on public.imperion_b2b_inquiries to service_role;
-- Live catalog readback showed a double-escaped regex rejecting ordinary emails.
-- POSIX classes avoid SQL/backslash escaping ambiguity; no customer data is changed.
alter table public.imperion_b2b_inquiries drop constraint if exists imperion_b2b_valid_email;
alter table public.imperion_b2b_inquiries add constraint imperion_b2b_valid_email
 check (email ~ '^[^@[:space:]]{1,80}@[^@[:space:]]+[.][^@[:space:]]{2,}$');
alter table public.imperion_b2b_inquiries
 add column if not exists utm_source text,
 add column if not exists utm_medium text,
 add column if not exists utm_campaign text;
alter table public.imperion_b2b_inquiries drop constraint if exists imperion_b2b_utm_labels;
alter table public.imperion_b2b_inquiries add constraint imperion_b2b_utm_labels check (
 (utm_source is null or utm_source ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$') and
 (utm_medium is null or utm_medium ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$') and
 (utm_campaign is null or utm_campaign ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$')
);
