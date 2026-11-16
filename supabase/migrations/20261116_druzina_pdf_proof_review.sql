-- Druzina private PDF evidence triage. No bank settlement, booking or new checkout.
-- Existing private RSVP table only; never export extracted PDF text to public Sheets.
ALTER TABLE public.imperion_rsvp_submissions
  ADD COLUMN IF NOT EXISTS payment_pdf_review_status text,
  ADD COLUMN IF NOT EXISTS payment_pdf_review_flags text[] NOT NULL DEFAULT '{}';
DO $migration$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='imperion_payment_pdf_review_status_check') THEN
  ALTER TABLE public.imperion_rsvp_submissions
    ADD CONSTRAINT imperion_payment_pdf_review_status_check
    CHECK (payment_pdf_review_status IS NULL OR
      payment_pdf_review_status IN ('MATCHED_UNVERIFIED','NEEDS_MANUAL_REVIEW'));
 END IF;
END
$migration$;
-- A single uploaded byte-identical proof cannot be used to evidence multiple RSVPs.
CREATE UNIQUE INDEX IF NOT EXISTS imperion_rsvp_unique_payment_pdf_hash
  ON public.imperion_rsvp_submissions (payment_pdf_sha256)
  WHERE payment_pdf_sha256 IS NOT NULL;
COMMENT ON COLUMN public.imperion_rsvp_submissions.payment_pdf_review_status IS
 'Automated text hints only. MATCHED_UNVERIFIED is NEVER BANK_VERIFIED; proof cannot confirm booking.';