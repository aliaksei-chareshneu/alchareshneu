-- Case IMP-DRUZINA-FIO-AUTO-20261116. Only an existing Project 80 job,
-- scoped to due and approved Druzina PDFs. No bank calls until due.
-- Generated Vault secret is NEVER sent to ChatGPT, Google Sheets, or GitHub.
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='imperion_druzina_fio_cron_token') THEN
   PERFORM vault.create_secret(
    replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),
    'imperion_druzina_fio_cron_token','Read-only Fio worker internal cron authentication');
 END IF;
END $$;

-- Service role must resolve the existing non-exposed private schema.
GRANT USAGE ON SCHEMA private TO service_role;

CREATE OR REPLACE FUNCTION private.verify_druzina_fio_cron_token(p_token text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=''
AS $$
 SELECT length(coalesce(p_token,''))=64
 AND p_token ~ '^[0-9a-f]{64}$'
 AND EXISTS(
  SELECT 1 FROM vault.decrypted_secrets
  WHERE name='imperion_druzina_fio_cron_token' AND decrypted_secret=p_token
 );
$$;
REVOKE ALL ON FUNCTION private.verify_druzina_fio_cron_token(text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.verify_druzina_fio_cron_token(text) TO service_role;

-- Public-schema RPC entrypoint is an invoker-only wrapper with no anonymous grant.
CREATE OR REPLACE FUNCTION public.verify_imperion_druzina_fio_cron_token(p_token text)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT private.verify_druzina_fio_cron_token(p_token) $$;
REVOKE ALL ON FUNCTION public.verify_imperion_druzina_fio_cron_token(text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_imperion_druzina_fio_cron_token(text) TO service_role;

-- No network invocation until an actual evidence-backed payment is DUE.
-- Fio adapter itself is additionally hard-disabled until read-only credentials,
-- seller identity, and owner approval are present in server-only environment.
SELECT cron.schedule(
 'imperion_druzina_fio_due_payment_hourly',
 '17 * * * *',
 $CRON$
 SELECT net.http_post(
  url:='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-druzina-fio-reconcile',
  headers:=jsonb_build_object(
    'Content-Type','application/json',
    'x-imperion-fio-cron-token',
    (SELECT decrypted_secret FROM vault.decrypted_secrets
      WHERE name='imperion_druzina_fio_cron_token')),
  body:='{}'::jsonb,
  timeout_milliseconds:=20000
 )
 WHERE EXISTS(
  SELECT 1 FROM public.imperion_rsvp_submissions
  WHERE payment_evidence_status='PROOF_RECEIVED'
    AND bank_verified_at IS NULL
    AND payment_variable_symbol IS NOT NULL
    AND payment_bank_check_after <= now()
 );
 $CRON$
);
