-- Reference schema for the server-side Community Hub operator.
-- Apply through reviewed Supabase migrations; do not paste secrets here.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

alter table public.operator_commands
  add column if not exists capability_hash text;

alter table public.operator_commands
  alter column target_worker set default 'supabase-event-operator';

-- Production also contains:
--   public.claim_operator_command(text,text)        -- service_role only
--   public.recover_operator_commands()              -- service_role only
--   public.verify_operator_cron_token(text)         -- service_role only
-- Capability verification itself is handled by the Edge Function /verify route
-- using its built-in service-role access; no public SECURITY DEFINER capability RPC remains.
--   private.kick_event_operator_worker()            -- reads cron token from Vault
--
-- Cron:
--   event-operator-worker | * * * * * | select private.kick_event_operator_worker();
--
-- The cron token is generated directly in Supabase Vault and is never stored in source control.
