-- IMPERION Academy OSVC booking/bank integrity (staging; separate release GO).
-- A customer's preference is NEVER a booked slot, and a screenshot NEVER proves bank credit.
-- This migration is additive, with only narrowed CHECK guards on existing states.
BEGIN;

ALTER TABLE public.imperion_academy_inquiries
  ADD COLUMN IF NOT EXISTS confirmed_session_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_session_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS owner_calendar_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS owner_calendar_check_note text,
  ADD COLUMN IF NOT EXISTS bank_verified_amount_czk integer,
  ADD COLUMN IF NOT EXISTS bank_verification_ref_hash text;

-- A bank credit is primary proof; a client's uploaded screenshot is optional.
-- The owner must independently check and record the correct OSVC account, amount and
-- transaction identifier (SHA-256 fingerprint), without storing raw bank statements here.
ALTER TABLE public.imperion_academy_inquiries
  DROP CONSTRAINT IF EXISTS academy_bank_verification_guard;
ALTER TABLE public.imperion_academy_inquiries
  ADD CONSTRAINT academy_bank_verification_guard CHECK (
    (bank_verified_at IS NULL AND bank_verified_amount_czk IS NULL AND
     bank_verification_ref_hash IS NULL)
    OR
    (bank_verified_at IS NOT NULL AND
     payment_evidence_status = 'BANK_VERIFIED' AND
     payment_quote_status = 'APPROVED' AND quote_locked_at IS NOT NULL AND
     bank_verified_at >= quote_locked_at AND
     quoted_amount_czk IS NOT NULL AND bank_verified_amount_czk IS NOT NULL AND
     bank_verified_amount_czk = quoted_amount_czk AND
     bank_verified_amount_czk > 0 AND
     bank_verification_ref_hash IS NOT NULL AND
     bank_verification_ref_hash ~ '^[0-9a-f]{64}$')
  );
ALTER TABLE public.imperion_academy_inquiries
  ADD CONSTRAINT academy_bank_status_timestamp_pair_guard
  CHECK ((payment_evidence_status = 'BANK_VERIFIED') = (bank_verified_at IS NOT NULL));

-- A bank statement transaction may not be credited to two unrelated lesson orders.
CREATE UNIQUE INDEX IF NOT EXISTS academy_bank_verification_ref_unique_idx
  ON public.imperion_academy_inquiries (bank_verification_ref_hash)
  WHERE bank_verification_ref_hash IS NOT NULL;

ALTER TABLE public.imperion_academy_inquiries
  DROP CONSTRAINT IF EXISTS academy_booking_confirm_guard;
ALTER TABLE public.imperion_academy_inquiries
  ADD CONSTRAINT academy_booking_confirm_guard
  CHECK (
    booking_confirmed_at IS NULL OR (
      booking_status = 'CONFIRMED' AND
      bank_verified_at IS NOT NULL AND
      payment_evidence_status = 'BANK_VERIFIED' AND
      confirmed_session_at IS NOT NULL AND
      confirmed_session_end_at IS NOT NULL AND
      booking_confirmed_at >= bank_verified_at
    )
  );

ALTER TABLE public.imperion_academy_inquiries
  ADD CONSTRAINT academy_confirmed_session_pair_guard
  CHECK ((confirmed_session_at IS NULL) = (confirmed_session_end_at IS NULL));
ALTER TABLE public.imperion_academy_inquiries
  ADD CONSTRAINT academy_confirmed_session_valid_guard
  CHECK (
    confirmed_session_at IS NULL OR
    (confirmed_session_end_at > confirmed_session_at AND
     requested_duration_min IS NOT NULL AND
     requested_duration_min BETWEEN 10 AND 240 AND
     confirmed_session_end_at - confirmed_session_at = make_interval(mins => requested_duration_min))
  );
ALTER TABLE public.imperion_academy_inquiries
  ADD CONSTRAINT academy_confirmed_requires_bank_guard
  CHECK (
    booking_status <> 'CONFIRMED' OR
    (booking_confirmed_at IS NOT NULL AND bank_verified_at IS NOT NULL AND
     payment_quote_status = 'APPROVED' AND
     payment_evidence_status = 'BANK_VERIFIED' AND
     bank_verified_amount_czk IS NOT NULL AND
     bank_verification_ref_hash IS NOT NULL AND
     requested_duration_min IS NOT NULL AND
     confirmed_session_at IS NOT NULL AND confirmed_session_end_at IS NOT NULL)
  );
-- The operator must recheck all known calendars, commute and student commitments
-- AFTER the bank receipt check, and attest the scope before confirming an exact slot.
-- This is a human attestation, not a live automated calendar feed.
ALTER TABLE public.imperion_academy_inquiries
  ADD CONSTRAINT academy_confirmed_requires_calendar_guard
  CHECK (
    booking_status <> 'CONFIRMED' OR
    (owner_calendar_checked_at IS NOT NULL AND
     owner_calendar_checked_at >= bank_verified_at AND
     owner_calendar_checked_at <= booking_confirmed_at AND
     owner_calendar_check_note IS NOT NULL AND
     length(btrim(owner_calendar_check_note)) BETWEEN 15 AND 500 AND
     confirmed_session_at > booking_confirmed_at)
  );

-- Only confirmed bookings block each other in this table; unverified external
-- calendar commitments must still be checked by the owner.
ALTER TABLE public.imperion_academy_inquiries
  ADD CONSTRAINT academy_no_overlapping_confirmed_sessions
  EXCLUDE USING gist
  (tstzrange(confirmed_session_at,confirmed_session_end_at,'[)') WITH &&)
  WHERE (booking_status = 'CONFIRMED');

COMMENT ON COLUMN public.imperion_academy_inquiries.confirmed_session_at IS
  'Independently owner-confirmed session start; not a client preference.';
COMMENT ON COLUMN public.imperion_academy_inquiries.confirmed_session_end_at IS
  'Owner-confirmed session end (exclusive), after verified bank credit.';
COMMENT ON COLUMN public.imperion_academy_inquiries.owner_calendar_checked_at IS
  'Human cross-calendar check attestation: not a live calendar or confirmed available feed.';
COMMENT ON COLUMN public.imperion_academy_inquiries.bank_verification_ref_hash IS
  'Private SHA-256 of an independently verified transaction identifier; no raw statement.';
COMMIT;
