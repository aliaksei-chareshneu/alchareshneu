-- Real PostgreSQL 17 migration integration smoke; synthetic fixtures ONLY.
-- Run via: psql -v ON_ERROR_STOP=1 -h localhost -U postgres -d academy_ci -f tests/academy-confirmed-slot-postgres.sql
-- Public project isolated CI database; NEVER connect to a real production database.
CREATE TABLE public.imperion_academy_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL, email text NOT NULL,
  product_code text NOT NULL,
  privacy_acknowledged boolean NOT NULL,
  adult_or_guardian_confirmed boolean NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  requested_duration_min integer,
  booking_status text NOT NULL DEFAULT 'REQUESTED',
  payment_quote_status text NOT NULL DEFAULT 'NOT_QUOTED',
  quote_locked_at timestamptz,
  quote_recipient text, quote_account text, quoted_amount_czk integer,
  payment_evidence_status text NOT NULL DEFAULT 'NOT_REQUIRED',
  payment_proof_received_at timestamptz,
  bank_verified_at timestamptz,
  booking_confirmed_at timestamptz,
  CONSTRAINT academy_bank_verification_guard
    CHECK (bank_verified_at IS NULL OR
      (payment_evidence_status='BANK_VERIFIED' AND payment_proof_received_at IS NOT NULL)),
  CONSTRAINT academy_booking_confirm_guard
    CHECK (booking_confirmed_at IS NULL OR
      (booking_status='CONFIRMED' AND bank_verified_at IS NOT NULL))
);
-- Apply the ACTUAL PR migration file, not a paraphrase.
\i supabase/migrations/20261113_academy_confirmed_slot_integrity.sql
BEGIN;
DO $qa$
DECLARE blocked boolean;
BEGIN
-- Positive: real credited funds do NOT require a client screenshot.
INSERT INTO public.imperion_academy_inquiries (first_name,email,product_code,privacy_acknowledged,adult_or_guardian_confirmed,idempotency_key,requested_duration_min,booking_status,payment_quote_status,quote_locked_at,quote_recipient,quote_account,quoted_amount_czk,payment_evidence_status,bank_verified_at,bank_verified_amount_czk,bank_verification_ref_hash,owner_calendar_checked_at,owner_calendar_check_note,booking_confirmed_at,confirmed_session_at,confirmed_session_end_at) VALUES ('Synthetic User', 'stage-one@example.invalid', 'LESSON', true, true, 'test-one', 60, 'CONFIRMED', 'APPROVED', '2026-11-13 11:00:00+00', 'Synthetic OSVC Seller', 'CZ00NOTREALACCOUNT', 690, 'BANK_VERIFIED', '2026-11-13 12:00:00+00', 690, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '2026-11-13 12:03:00+00', 'Owner checked all known calendar sources and travel', '2026-11-13 12:05:00+00', '2026-11-16 12:00+00', '2026-11-16 13:00+00');
IF (SELECT payment_proof_received_at FROM public.imperion_academy_inquiries LIMIT 1) IS NOT NULL
 THEN RAISE EXCEPTION 'Screenshot mistakenly required'; END IF;
blocked:=false;BEGIN
INSERT INTO public.imperion_academy_inquiries (first_name,email,product_code,privacy_acknowledged,adult_or_guardian_confirmed,idempotency_key,requested_duration_min,booking_status,payment_quote_status,quote_locked_at,quote_recipient,quote_account,quoted_amount_czk,payment_evidence_status,bank_verified_at,bank_verified_amount_czk,bank_verification_ref_hash,owner_calendar_checked_at,owner_calendar_check_note,booking_confirmed_at,confirmed_session_at,confirmed_session_end_at) VALUES ('Synthetic User', 'stage-overlap@example.invalid', 'LESSON', true, true, 'test-overlap', 60, 'CONFIRMED', 'APPROVED', '2026-11-13 11:00:00+00', 'Synthetic OSVC Seller', 'CZ00NOTREALACCOUNT', 690, 'BANK_VERIFIED', '2026-11-13 12:00:00+00', 690, 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', '2026-11-13 12:03:00+00', 'Owner checked all known calendar sources and travel', '2026-11-13 12:05:00+00', '2026-11-16 12:30+00', '2026-11-16 13:30+00');
EXCEPTION WHEN exclusion_violation THEN blocked:=true; END;
IF NOT blocked THEN RAISE EXCEPTION 'Overlap not rejected'; END IF;
blocked:=false;BEGIN
INSERT INTO public.imperion_academy_inquiries (first_name,email,product_code,privacy_acknowledged,adult_or_guardian_confirmed,idempotency_key,requested_duration_min,booking_status,payment_quote_status,quote_locked_at,quote_recipient,quote_account,quoted_amount_czk,payment_evidence_status,bank_verified_at,bank_verified_amount_czk,bank_verification_ref_hash,owner_calendar_checked_at,owner_calendar_check_note,booking_confirmed_at,confirmed_session_at,confirmed_session_end_at) VALUES ('Synthetic User', 'stage-reused@example.invalid', 'LESSON', true, true, 'test-reused', 60, 'CONFIRMED', 'APPROVED', '2026-11-13 11:00:00+00', 'Synthetic OSVC Seller', 'CZ00NOTREALACCOUNT', 690, 'BANK_VERIFIED', '2026-11-13 12:00:00+00', 690, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '2026-11-13 12:03:00+00', 'Owner checked all known calendar sources and travel', '2026-11-13 12:05:00+00', '2026-11-16 14:00+00', '2026-11-16 15:00+00');
EXCEPTION WHEN unique_violation THEN blocked:=true; END;
IF NOT blocked THEN RAISE EXCEPTION 'Duplicate bank credit accepted'; END IF;
blocked:=false;BEGIN
INSERT INTO public.imperion_academy_inquiries (first_name,email,product_code,privacy_acknowledged,adult_or_guardian_confirmed,idempotency_key,requested_duration_min,booking_status,payment_quote_status,quote_locked_at,quote_recipient,quote_account,quoted_amount_czk,payment_evidence_status,bank_verified_at,bank_verified_amount_czk,bank_verification_ref_hash,owner_calendar_checked_at,owner_calendar_check_note,booking_confirmed_at,confirmed_session_at,confirmed_session_end_at) VALUES ('Synthetic User', 'stage-bankless@example.invalid', 'LESSON', true, true, 'test-bankless', 60, 'CONFIRMED', 'APPROVED', '2026-11-13 11:00:00+00', 'Synthetic OSVC Seller', 'CZ00NOTREALACCOUNT', 690, 'BANK_VERIFIED', NULL, 690, 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', '2026-11-13 12:03:00+00', 'Owner checked all known calendar sources and travel', '2026-11-13 12:05:00+00', '2026-11-16 14:00+00', '2026-11-16 15:00+00');
EXCEPTION WHEN check_violation THEN blocked:=true; END;
IF NOT blocked THEN RAISE EXCEPTION 'Bankless booking accepted'; END IF;
blocked:=false;BEGIN
INSERT INTO public.imperion_academy_inquiries (first_name,email,product_code,privacy_acknowledged,adult_or_guardian_confirmed,idempotency_key,requested_duration_min,booking_status,payment_quote_status,quote_locked_at,quote_recipient,quote_account,quoted_amount_czk,payment_evidence_status,bank_verified_at,bank_verified_amount_czk,bank_verification_ref_hash,owner_calendar_checked_at,owner_calendar_check_note,booking_confirmed_at,confirmed_session_at,confirmed_session_end_at) VALUES ('Synthetic User', 'stage-underpaid@example.invalid', 'LESSON', true, true, 'test-underpaid', 60, 'CONFIRMED', 'APPROVED', '2026-11-13 11:00:00+00', 'Synthetic OSVC Seller', 'CZ00NOTREALACCOUNT', 690, 'BANK_VERIFIED', '2026-11-13 12:00:00+00', 650, 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', '2026-11-13 12:03:00+00', 'Owner checked all known calendar sources and travel', '2026-11-13 12:05:00+00', '2026-11-16 14:00+00', '2026-11-16 15:00+00');
EXCEPTION WHEN check_violation THEN blocked:=true; END;
IF NOT blocked THEN RAISE EXCEPTION 'Partial payment accepted'; END IF;
blocked:=false;BEGIN
INSERT INTO public.imperion_academy_inquiries (first_name,email,product_code,privacy_acknowledged,adult_or_guardian_confirmed,idempotency_key,requested_duration_min,booking_status,payment_quote_status,quote_locked_at,quote_recipient,quote_account,quoted_amount_czk,payment_evidence_status,bank_verified_at,bank_verified_amount_czk,bank_verification_ref_hash,owner_calendar_checked_at,owner_calendar_check_note,booking_confirmed_at,confirmed_session_at,confirmed_session_end_at) VALUES ('Synthetic User', 'stage-no-calendar@example.invalid', 'LESSON', true, true, 'test-no-calendar', 60, 'CONFIRMED', 'APPROVED', '2026-11-13 11:00:00+00', 'Synthetic OSVC Seller', 'CZ00NOTREALACCOUNT', 690, 'BANK_VERIFIED', '2026-11-13 12:00:00+00', 690, 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', NULL, 'Owner checked all known calendar sources and travel', '2026-11-13 12:05:00+00', '2026-11-16 14:00+00', '2026-11-16 15:00+00');
EXCEPTION WHEN check_violation THEN blocked:=true; END;
IF NOT blocked THEN RAISE EXCEPTION 'No calendar review accepted'; END IF;
blocked:=false;BEGIN
INSERT INTO public.imperion_academy_inquiries (first_name,email,product_code,privacy_acknowledged,adult_or_guardian_confirmed,idempotency_key,requested_duration_min,booking_status,payment_quote_status,quote_locked_at,quote_recipient,quote_account,quoted_amount_czk,payment_evidence_status,bank_verified_at,bank_verified_amount_czk,bank_verification_ref_hash,owner_calendar_checked_at,owner_calendar_check_note,booking_confirmed_at,confirmed_session_at,confirmed_session_end_at) VALUES ('Synthetic User', 'stage-no-calendar-scope@example.invalid', 'LESSON', true, true, 'test-no-calendar-scope', 60, 'CONFIRMED', 'APPROVED', '2026-11-13 11:00:00+00', 'Synthetic OSVC Seller', 'CZ00NOTREALACCOUNT', 690, 'BANK_VERIFIED', '2026-11-13 12:00:00+00', 690, 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', '2026-11-13 12:03:00+00', 'x', '2026-11-13 12:05:00+00', '2026-11-16 14:00+00', '2026-11-16 15:00+00');
EXCEPTION WHEN check_violation THEN blocked:=true; END;
IF NOT blocked THEN RAISE EXCEPTION 'No calendar scope accepted'; END IF;
blocked:=false;BEGIN
INSERT INTO public.imperion_academy_inquiries (first_name,email,product_code,privacy_acknowledged,adult_or_guardian_confirmed,idempotency_key,requested_duration_min,booking_status,payment_quote_status,quote_locked_at,quote_recipient,quote_account,quoted_amount_czk,payment_evidence_status,bank_verified_at,bank_verified_amount_czk,bank_verification_ref_hash,owner_calendar_checked_at,owner_calendar_check_note,booking_confirmed_at,confirmed_session_at,confirmed_session_end_at) VALUES ('Synthetic User', 'stage-no-quote@example.invalid', 'LESSON', true, true, 'test-no-quote', 60, 'CONFIRMED', 'NOT_QUOTED', '2026-11-13 11:00:00+00', 'Synthetic OSVC Seller', 'CZ00NOTREALACCOUNT', 690, 'BANK_VERIFIED', '2026-11-13 12:00:00+00', 690, 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', '2026-11-13 12:03:00+00', 'Owner checked all known calendar sources and travel', '2026-11-13 12:05:00+00', '2026-11-16 14:00+00', '2026-11-16 15:00+00');
EXCEPTION WHEN check_violation THEN blocked:=true; END;
IF NOT blocked THEN RAISE EXCEPTION 'Unapproved payment accepted'; END IF;
INSERT INTO public.imperion_academy_inquiries (first_name,email,product_code,privacy_acknowledged,adult_or_guardian_confirmed,idempotency_key,requested_duration_min,booking_status,payment_quote_status,quote_locked_at,quote_recipient,quote_account,quoted_amount_czk,payment_evidence_status,bank_verified_at,bank_verified_amount_czk,bank_verification_ref_hash,owner_calendar_checked_at,owner_calendar_check_note,booking_confirmed_at,confirmed_session_at,confirmed_session_end_at) VALUES ('Synthetic User', 'stage-adjacent@example.invalid', 'LESSON', true, true, 'test-adjacent', 60, 'CONFIRMED', 'APPROVED', '2026-11-13 11:00:00+00', 'Synthetic OSVC Seller', 'CZ00NOTREALACCOUNT', 690, 'BANK_VERIFIED', '2026-11-13 12:00:00+00', 690, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '2026-11-13 12:03:00+00', 'Owner checked all known calendar sources and travel', '2026-11-13 12:05:00+00', '2026-11-16 13:00+00', '2026-11-16 14:00+00');
IF (SELECT count(*) FROM public.imperion_academy_inquiries) <> 2 THEN
 RAISE EXCEPTION 'Expected two adjacent confirmed appointments'; END IF;
END $qa$;
ROLLBACK;
\echo 'ACADEMY_POSTGRES_INTEGRITY_PASS';
