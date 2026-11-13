-- 2026-11-13. Extend the EXISTING OSVC Academy enquiries table for a controlled
-- service order -> owner-approved quote -> PRIVATE bank proof -> BANK VERIFIED flow.
-- No new CRM table; no public SELECT, bank writes, payment capture or bookings.
BEGIN;
ALTER TABLE public.imperion_academy_inquiries
  ADD COLUMN IF NOT EXISTS service_key text,
  ADD COLUMN IF NOT EXISTS service_variant text,
  ADD COLUMN IF NOT EXISTS requested_session_at timestamptz,
  ADD COLUMN IF NOT EXISTS requested_duration_min integer,
  ADD COLUMN IF NOT EXISTS booking_status text NOT NULL DEFAULT 'REQUESTED',
  ADD COLUMN IF NOT EXISTS payment_quote_status text NOT NULL DEFAULT 'NOT_QUOTED',
  ADD COLUMN IF NOT EXISTS quoted_amount_czk integer,
  ADD COLUMN IF NOT EXISTS quote_recipient text,
  ADD COLUMN IF NOT EXISTS quote_account text,
  ADD COLUMN IF NOT EXISTS quote_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS quote_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_token_hash text,
  ADD COLUMN IF NOT EXISTS payment_evidence_status text NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS payment_proof_path text,
  ADD COLUMN IF NOT EXISTS payment_proof_sha256 text,
  ADD COLUMN IF NOT EXISTS payment_proof_mime text,
  ADD COLUMN IF NOT EXISTS payment_proof_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS bank_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS booking_confirmed_at timestamptz;
ALTER TABLE public.imperion_academy_inquiries
  ADD CONSTRAINT academy_service_key_valid CHECK (service_key IS NULL OR service_key ~ '^[a-z][a-z0-9-]{1,47}$'),
  ADD CONSTRAINT academy_variant_valid CHECK (service_variant IS NULL OR service_variant ~ '^[a-z0-9-]{1,32}$'),
  ADD CONSTRAINT academy_duration_valid CHECK (requested_duration_min IS NULL OR requested_duration_min BETWEEN 10 AND 240),
  ADD CONSTRAINT academy_booking_status_valid CHECK (booking_status IN ('REQUESTED','REVIEW','AWAITING_BANK','READY_TO_SCHEDULE','CONFIRMED','CANCELLED')),
  ADD CONSTRAINT academy_quote_status_valid CHECK (payment_quote_status IN ('NOT_QUOTED','APPROVED','REVOKED')),
  ADD CONSTRAINT academy_evidence_state_valid CHECK (payment_evidence_status IN ('NOT_REQUIRED','AWAITING_PROOF','PROOF_RECEIVED','BANK_VERIFIED','REJECTED')),
  ADD CONSTRAINT academy_token_hash_valid CHECK (payment_token_hash IS NULL OR payment_token_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT academy_quote_approved_guard CHECK (payment_quote_status<>'APPROVED' OR
     (quoted_amount_czk > 0 AND quoted_amount_czk < 10000000 AND
      length(btrim(coalesce(quote_recipient,'')))>=3 AND
      length(btrim(coalesce(quote_account,'')))>=8 AND quote_locked_at IS NOT NULL)),
  ADD CONSTRAINT academy_proof_path_valid CHECK (payment_proof_path IS NULL OR
      payment_proof_path ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9a-f-]{36}[.](pdf|png|jpg)$'),
  ADD CONSTRAINT academy_bank_verification_guard CHECK (bank_verified_at IS NULL OR
      (payment_evidence_status='BANK_VERIFIED' AND payment_proof_received_at IS NOT NULL)),
  ADD CONSTRAINT academy_booking_confirm_guard CHECK (booking_confirmed_at IS NULL OR
      (booking_status='CONFIRMED' AND bank_verified_at IS NOT NULL));
CREATE INDEX IF NOT EXISTS imperion_academy_payment_review_idx
 ON public.imperion_academy_inquiries (payment_evidence_status,created_at)
 WHERE payment_evidence_status <> 'NOT_REQUIRED';
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
 VALUES ('imperion-academy-payment-proofs','imperion-academy-payment-proofs',false,2097152,
  ARRAY['application/pdf','image/png','image/jpeg'])
 ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.imperion_academy_inquiries ENABLE ROW LEVEL SECURITY;
COMMIT;
