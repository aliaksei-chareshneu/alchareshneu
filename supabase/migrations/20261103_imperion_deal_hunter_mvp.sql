-- IMPERION OSVC Deal Hunter MVP: private staging, NOT a second CRM.
-- Existing Community Hub tab IMPERION_B2B_Open_Requests remains canonical.
-- Official public TED procurement notices only; no recipients or payments.
create table if not exists public.imperion_deal_hunter_candidates (
 source_key text primary key check (source_key ~ '^TED:[0-9]{6,8}-20[0-9]{2}$'),
 source text not null default 'TED_OFFICIAL' check (source='TED_OFFICIAL'),
 publication_number text not null,
 source_url text not null check (source_url ~ '^https://ted[.]europa[.]eu/cs/notice/-/detail/[0-9]{6,8}-20[0-9]{2}$'),
 title text not null check (length(title) between 12 and 320),
 buyer text not null default '',
 cpv_codes text[] not null default '{}',
 published_on date, deadline_on date,
 notice_value_raw text, notice_currency text,
 fit_score integer not null check (fit_score between 0 and 100),
 legal_entity text not null default 'OSVC' check (legal_entity='OSVC'),
 status text not null default 'REVIEW_UNCOSTED' check (status in ('REVIEW_UNCOSTED','MANUAL_REVIEW','REVIEW_ELIGIBILITY','QUALIFIED_FOR_OWNER','REJECTED_UNDER_1000','CLOSED')),
 evidence_classification text not null,
 owner_quote_czk numeric(15,2) check (owner_quote_czk>=0),
 owner_full_hours numeric(12,2) check (owner_full_hours>0),
 owner_direct_cost_czk numeric(15,2) check (owner_direct_cost_czk>=0),
 net_czk_per_full_hour numeric(15,2) generated always as
  (case when owner_quote_czk is null or owner_full_hours is null or owner_direct_cost_czk is null then null
   else round((owner_quote_czk-owner_direct_cost_czk)/owner_full_hours,2) end) stored,
 economics_gate text generated always as
  (case when owner_quote_czk is null or owner_full_hours is null or owner_direct_cost_czk is null then 'REVIEW_UNCOSTED'
   when (owner_quote_czk-owner_direct_cost_czk)/owner_full_hours>=1000 then 'PASS_ESTIMATE'
   else 'REJECT_UNDER_1000' end) stored,
 crm_synced_at timestamptz, crm_target_id text,
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now()
);
create table if not exists public.imperion_deal_hunter_runs (
 id uuid primary key default gen_random_uuid(),
 run_slot text not null unique check (length(run_slot) between 12 and 130),
 source text not null default 'TED_OFFICIAL' check (source='TED_OFFICIAL'),
 mode text not null check (mode in ('cron','manual')),
 status text not null check (status in ('RUNNING','SOURCE_OK','SOURCE_PARTIAL','SOURCE_FAILED','PERSISTENCE_FAILED')),
 started_at timestamptz not null default now(), finished_at timestamptz,
 received integer not null default 0, screened integer not null default 0,
 inserted integer not null default 0, persisted integer not null default 0,
 source_successes integer not null default 0, source_errors text[] not null default '{}',
 report jsonb not null default '[]'::jsonb
);
alter table public.imperion_deal_hunter_candidates enable row level security;
alter table public.imperion_deal_hunter_runs enable row level security;
revoke all on table public.imperion_deal_hunter_candidates,public.imperion_deal_hunter_runs from public,anon,authenticated,service_role;
grant select,insert,update on table public.imperion_deal_hunter_candidates,public.imperion_deal_hunter_runs to service_role;
do $$ begin
 if not exists(select 1 from vault.secrets where name='imperion_deal_hunter_cron_token') then
  perform vault.create_secret(encode(gen_random_bytes(32),'hex'),'imperion_deal_hunter_cron_token');
 end if;
end $$;
create or replace function public.imperion_deal_hunter_verify_token(p_token text)
 returns boolean language sql stable security definer set search_path = '' as $$
 select p_token ~ '^[a-f0-9]{64}$' and exists(
  select 1 from vault.decrypted_secrets where name='imperion_deal_hunter_cron_token' and decrypted_secret=p_token
 );
$$;
revoke all on function public.imperion_deal_hunter_verify_token(text) from public, anon,authenticated;
grant execute on function public.imperion_deal_hunter_verify_token(text) to service_role;
