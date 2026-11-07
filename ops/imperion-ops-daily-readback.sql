-- Deployment record: Supabase browser-bridge, migration 20261107202229
-- APPLIED 2026-11-07. DO NOT AUTO-REPLAY; reviewed recovery reference.
-- No parallel CRM, client data, paid models, messaging, or third-party calls.
-- Daily at 07:30 Europe/Prague, one append-only receipt/day in private schema.

CREATE SCHEMA IF NOT EXISTS imperion_ops;
REVOKE ALL ON SCHEMA imperion_ops FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS imperion_ops.agent_daily_receipts (
  receipt_day date PRIMARY KEY,
  observed_at timestamptz NOT NULL DEFAULT now(),
  run_mode text NOT NULL CHECK (run_mode IN ('MANUAL_SMOKE','CRON')),
  report jsonb NOT NULL CHECK (jsonb_typeof(report)='object')
);
ALTER TABLE imperion_ops.agent_daily_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE imperion_ops.agent_daily_receipts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION imperion_ops.capture_daily_readback(p_force boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_day date := (clock_timestamp() AT TIME ZONE 'Europe/Prague')::date;
  v_h integer := EXTRACT(HOUR FROM (clock_timestamp() AT TIME ZONE 'Europe/Prague'));
  v_opportunities integer;
  v_uncosted integer;
  v_deadline_unknown integer;
  v_economics_pass integer;
  v_grant_sources integer;
  v_grant_needs_manual integer;
  v_recent_browser_errors integer;
  v_deal_latest timestamptz;
  v_grant_latest timestamptz;
  v_deal_status text;
  v_data jsonb;
BEGIN
  -- Invoked at 05:30 and 06:30 UTC. Only one is 07:30 Europe/Prague.
  IF NOT p_force AND v_h <> 7 THEN
    RETURN jsonb_build_object('status','SKIPPED_LOCAL_HOUR','local_hour',v_h);
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE status='REVIEW_UNCOSTED'),
         count(*) FILTER (WHERE deadline_on IS NULL),
         count(*) FILTER (WHERE economics_gate='PASS'
            AND net_czk_per_full_hour>=1000
            AND owner_full_hours>0
            AND deadline_on >= v_day)
    INTO v_opportunities, v_uncosted, v_deadline_unknown, v_economics_pass
  FROM public.imperion_deal_hunter_candidates;

  SELECT max(started_at) INTO v_deal_latest FROM public.imperion_deal_hunter_runs;
  SELECT r.status INTO v_deal_status FROM public.imperion_deal_hunter_runs r
    ORDER BY r.started_at DESC LIMIT 1;
  SELECT max(started_at) INTO v_grant_latest FROM public.imperion_grant_source_runs;
  SELECT count(*), count(*) FILTER (WHERE verification_status='NEEDS_MANUAL_VERIFICATION')
    INTO v_grant_sources, v_grant_needs_manual
    FROM public.imperion_grant_source_snapshots;
  SELECT count(*) INTO v_recent_browser_errors
    FROM public.browser_jobs WHERE state='error'
      AND created_at > clock_timestamp()-interval '24 hours';

  v_data := jsonb_build_object(
    'status','REVIEW_REQUIRED',
    'timezone','Europe/Prague',
    'osvc',jsonb_build_object(
      'entity','OSVC','deal_candidates',v_opportunities,
      'uncosted',v_uncosted,'deadline_unknown',v_deadline_unknown,
      'economics_pass',v_economics_pass,'latest_run',v_deal_latest,
      'latest_run_status',coalesce(v_deal_status,'UNVERIFIED'),
      'bank_cash','NOT_CHECKED',
      'next','Validate buyer, legal eligibility, deadline, budget and all-in hours before any bid'),
    'ngo',jsonb_build_object(
      'entity','Druzina Moravy z.s.','grant_sources',v_grant_sources,
      'manual_review',v_grant_needs_manual,'latest_source_run',v_grant_latest,
      'next','Independently review any flagged official grant page; no submission or award claim'),
    'execution',jsonb_build_object(
      'recent_browser_errors_24h',v_recent_browser_errors,
      'source','LIVE_SUPABASE_READ_ONLY_AGGREGATES',
      'llm_calls',0,'outbound_messages',0,'publication',false,
      'financial_actions',false)
  );
  INSERT INTO imperion_ops.agent_daily_receipts(receipt_day,run_mode,report)
  VALUES (v_day,CASE WHEN p_force THEN 'MANUAL_SMOKE' ELSE 'CRON' END,v_data)
  ON CONFLICT (receipt_day) DO NOTHING;
  SELECT report INTO v_data
    FROM imperion_ops.agent_daily_receipts WHERE receipt_day=v_day;
  RETURN v_data;
END;
$function$;
REVOKE ALL ON FUNCTION imperion_ops.capture_daily_readback(boolean) FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'imperion_ops_daily_cash_proof_prague_0730',
  '30 5,6 * * *',
  $$SELECT imperion_ops.capture_daily_readback(false)$$
);
