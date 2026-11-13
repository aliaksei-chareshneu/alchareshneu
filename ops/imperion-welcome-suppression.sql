-- Independent opt-out suppression only. Hashed per-user key; no chat IDs or usernames stored.
create table if not exists public.imperion_welcome_suppressions (
  suppress_key text primary key check (suppress_key ~ '^[0-9a-f]{64}$'),
  platform text not null check (platform in ('telegram')),
  subject text not null check (subject in ('druzina','brnowalkers','osvc')),
  created_at timestamptz not null default now()
);
alter table public.imperion_welcome_suppressions enable row level security;
revoke all on table public.imperion_welcome_suppressions from public, anon, authenticated;
grant select,insert,delete on public.imperion_welcome_suppressions to service_role;
