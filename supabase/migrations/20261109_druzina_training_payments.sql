-- Druzina payment evidence. No registrations, price locks or money intake are enabled automatically.
ALTER TABLE public.imperion_rsvp_events
 ADD COLUMN IF NOT EXISTS training_price_scheme text NOT NULL DEFAULT 'LEGACY',
 ADD COLUMN IF NOT EXISTS training_confirmed_count integer,
 ADD COLUMN IF NOT EXISTS training_quote_locked_at timestamptz,
 ADD COLUMN IF NOT EXISTS training_operational_go_at timestamptz,
 ADD COLUMN IF NOT EXISTS training_payment_open boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS training_payment_recipient text,
 ADD COLUMN IF NOT EXISTS training_payment_account text;
ALTER TABLE public.imperion_rsvp_events
 ADD CONSTRAINT imperion_training_price_scheme_check CHECK (training_price_scheme IN ('LEGACY','GROUP_SHARED')),
 ADD CONSTRAINT imperion_training_confirmed_count_check CHECK (training_confirmed_count IS NULL OR training_confirmed_count BETWEEN 3 AND 200),
 ADD CONSTRAINT imperion_training_payment_go_check CHECK (NOT training_payment_open OR (
  training_price_scheme='GROUP_SHARED' AND training_confirmed_count BETWEEN 3 AND 200
  AND training_quote_locked_at IS NOT NULL AND training_operational_go_at IS NOT NULL
  AND length(btrim(coalesce(training_payment_recipient,''))) >= 3
  AND length(btrim(coalesce(training_payment_account,''))) >= 8
  AND community='Družina Moravy' AND category='HEMA Training'
  AND price_verified=true AND end_time_verified=true
 ));
ALTER TABLE public.imperion_rsvp_submissions
 ADD COLUMN IF NOT EXISTS quoted_base_czk integer,
 ADD COLUMN IF NOT EXISTS quoted_late_fee_czk integer,
 ADD COLUMN IF NOT EXISTS quoted_total_czk integer,
 ADD COLUMN IF NOT EXISTS quoted_confirmed_count integer,
 ADD COLUMN IF NOT EXISTS quoted_late_48h boolean,
 ADD COLUMN IF NOT EXISTS payment_pdf_path text,
 ADD COLUMN IF NOT EXISTS payment_pdf_sha256 text,
 ADD COLUMN IF NOT EXISTS payment_evidence_status text NOT NULL DEFAULT 'NOT_REQUIRED',
 ADD COLUMN IF NOT EXISTS payment_evidence_received_at timestamptz,
 ADD COLUMN IF NOT EXISTS bank_verified_at timestamptz,
 ADD COLUMN IF NOT EXISTS payment_resume_token_hash text,
 ADD COLUMN IF NOT EXISTS payment_resume_token_issued_at timestamptz,
 ADD COLUMN IF NOT EXISTS payment_crm_synced_at timestamptz;
ALTER TABLE public.imperion_rsvp_submissions
 ADD CONSTRAINT imperion_resume_token_hash_check
 CHECK (payment_resume_token_hash IS NULL OR payment_resume_token_hash ~ '^[0-9a-f]{64}$'),
 ADD CONSTRAINT imperion_payment_evidence_status_check
 CHECK (payment_evidence_status IN ('NOT_REQUIRED','PROOF_RECEIVED','BANK_VERIFIED','REJECTED')),
 ADD CONSTRAINT imperion_payment_quote_check CHECK (quoted_total_czk IS NULL OR (
  quoted_base_czk > 0 AND quoted_late_fee_czk >= 0
  AND quoted_total_czk=quoted_base_czk+quoted_late_fee_czk
  AND quoted_confirmed_count BETWEEN 3 AND 200
 )),
 ADD CONSTRAINT imperion_payment_path_check
 CHECK (payment_pdf_path IS NULL OR payment_pdf_path ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9a-f-]{36}[.]pdf$');
CREATE INDEX IF NOT EXISTS imperion_rsvp_payment_review_idx
 ON public.imperion_rsvp_submissions (payment_evidence_status,created_at)
 WHERE payment_evidence_status <> 'NOT_REQUIRED';
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
 VALUES ('imperion-training-payment-proofs','imperion-training-payment-proofs',false,2097152,ARRAY['application/pdf'])
 ON CONFLICT (id) DO NOTHING;
-- Existing 9 November individually offered 240 Kč is legacy; free workshop not affected.
UPDATE public.imperion_rsvp_events SET training_price_scheme='GROUP_SHARED'
 WHERE community='Družina Moravy' AND category='HEMA Training'
 AND begins_at >= '2026-11-10T00:00:00Z' AND price_czk > 0 AND event_id <> 'PUB-OREL-20261114';
