-- One private, zero-PII delivery staging table and one one-way token digest.
-- This is TRANSPORT for the existing Community Hub, NOT another CRM.
CREATE TABLE IF NOT EXISTS public.imperion_agent4_transport (
  source_key text PRIMARY KEY CHECK (source_key ~ '^IMP4-TG-[0-9a-f]{24}$'),
  legal_entity text NOT NULL CHECK (legal_entity IN ('OSVC','DRUZINA_MORAVY_ZS')),
  local_job_id integer NOT NULL CHECK (local_job_id BETWEEN 1 AND 1000000000),
  inbound_at timestamptz NOT NULL,
  provider_send_status text NOT NULL CHECK
    (provider_send_status IN ('NO_CONFIRMED_SEND','API_ACCEPTED_NOT_DELIVERY')),
  created_at timestamptz NOT NULL DEFAULT now(),
  crm_case_id text,
  crm_synced_at timestamptz,
  CONSTRAINT agent4_case_id_valid CHECK (
    crm_case_id IS NULL OR
    (legal_entity='OSVC' AND crm_case_id ~ '^LEAD-AG4-[0-9a-f]{24}$') OR
    (legal_entity='DRUZINA_MORAVY_ZS' AND crm_case_id ~ '^DM-[0-9]{3,6}$')
  ),
  CONSTRAINT agent4_receipt_pair CHECK ((crm_case_id IS NULL) = (crm_synced_at IS NULL))
);
CREATE INDEX IF NOT EXISTS imperion_agent4_transport_pending_idx
 ON public.imperion_agent4_transport(created_at)
 WHERE crm_synced_at IS NULL;
CREATE TABLE IF NOT EXISTS public.imperion_agent4_transport_auth (
  token_sha256 text PRIMARY KEY CHECK (token_sha256 ~ '^[a-f0-9]{64}$'),
  role text NOT NULL DEFAULT 'WINDOWS_AGENT4' CHECK (role='WINDOWS_AGENT4'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.imperion_agent4_transport ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imperion_agent4_transport_auth ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.imperion_agent4_transport FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.imperion_agent4_transport_auth FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.imperion_agent4_transport TO service_role;
GRANT ALL ON public.imperion_agent4_transport_auth TO service_role;
COMMENT ON TABLE public.imperion_agent4_transport IS 'Private SHA-key metadata handoff to existing Community Hub Google Sheets, no PII or money, 90-day retention via owner governance.';
COMMENT ON TABLE public.imperion_agent4_transport_auth IS 'SHA256 digest of random Windows-only bearer token. Never store raw token or person/chat content.';
