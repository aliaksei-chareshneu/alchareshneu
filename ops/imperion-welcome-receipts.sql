-- STAGING ONLY. Do not run in production before authorization and review.
-- Non-CRM operational idempotency/acceptance receipts, no names, handles or phone numbers.
create table if not exists public.imperion_welcome_receipts (
  dedupe_key text primary key check (dedupe_key ~ '^[0-9a-f]{64}$'),
  platform text not null check (platform in ('telegram')),
  subject text not null check (subject in ('druzina','brnowalkers','osvc')),
  action text not null check (action in ('GROUP_GREETING','USER_INITIATED_REPLY')),
  state text not null check (state in ('RESERVED','API_ACCEPTED','SEND_UNCERTAIN')),
  receipt jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retention_until timestamptz not null default (now() + interval '90 days')
);
alter table public.imperion_welcome_receipts enable row level security;
revoke all on table public.imperion_welcome_receipts from anon, authenticated;
grant select,insert,update,delete on public.imperion_welcome_receipts to service_role;
create index if not exists imperion_welcome_receipts_retention_idx
  on public.imperion_welcome_receipts(retention_until);
-- Optional scheduled maintenance, separate owner-approved change:
-- delete from public.imperion_welcome_receipts where retention_until < now();
