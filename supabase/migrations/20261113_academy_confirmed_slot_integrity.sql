-- Academy (OSVC) confirmed lesson integrity, 13 Nov 2026.
-- STAGED ONLY: review, back up, test in staging and obtain release GO before applying.
-- Keeps preferred client times distinct from independently checked, owner-confirmed slots.
-- This is not an availability feed, a bank reconciliation, or an authorization to book.
BEGIN;
ALTER TABLE public.imperion_academy_inquiries
  ADD COLUMN IF NOT EXISTS confirmed_session_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_session_end_at timestamptz;

-- The earlier guard allowed the status CONFIRMED without any confirmed time.
-- Do not use requested_session_at: that field is only the client's preference.
ALTER TABLE public.imperion_academy_inquiries
  DROP CONSTRAINT IF EXISTS academy_booking_confirm_guard;
ALTER TABLE public.imperion_academy_inquiries
  ADD CONSTRAINT academy_booking_confirm_guard
  CHECK (
    booking_confirmed_at IS NULL OR (
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
     requested_duration_min BETWEEN 10 AND 240 AND
     confirmed_session_end_at - confirmed_session_at = make_interval(mins => requested_duration_min))
  );
ALTER TABLE public.imperion_academy_inquiries
  ADD CONSTRAINT academy_confirmed_requires_bank_guard
  CHECK (
    booking_status <> 'CONFIRMED' OR
    (booking_confirmed_at IS NOT NULL AND bank_verified_at IS NOT NULL AND
     payment_evidence_status = 'BANK_VERIFIED' AND
     confirmed_session_at IS NOT NULL AND confirmed_session_end_at IS NOT NULL)
  );
-- PostgreSQL uses a GiST range exclusion constraint to serialize concurrent
-- confirmations: no two ACTIVE confirmed individual Academy bookings may overlap.
-- Adjacent sessions [start,end) remain legal; commute buffers and external calendar
-- conflicts MUST be verified before owner confirmation, not inferred by this SQL.
ALTER TABLE public.imperion_academy_inquiries
  ADD CONSTRAINT academy_no_overlapping_confirmed_sessions
  EXCLUDE USING gist
  (tstzrange(confirmed_session_at,confirmed_session_end_at,'[)') WITH &&)
  WHERE (booking_status = 'CONFIRMED');

COMMENT ON COLUMN public.imperion_academy_inquiries.confirmed_session_at IS
  'Owner-verified actual lesson start. NOT the client requested time; set only after cross-calendar and commute checks.';
COMMENT ON COLUMN public.imperion_academy_inquiries.confirmed_session_end_at IS
  'Owner-verified actual lesson end, exclusive. Only confirms after legitimate bank receipt verification.';
COMMIT;
