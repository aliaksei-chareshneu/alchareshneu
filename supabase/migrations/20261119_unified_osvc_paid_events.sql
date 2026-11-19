-- IMP-PAID-EVENTS-READY-20261119. Add to the existing RSVP + event tables.
-- Separate legal sellers: OSVC event receipts MUST NOT use Druzina bank configuration.
-- All payment/seat gates default closed. No historic/free bookings are converted.
ALTER TABLE public.imperion_rsvp_events
  ADD COLUMN IF NOT EXISTS osvc_payment_open boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS osvc_payment_recipient text,
  ADD COLUMN IF NOT EXISTS osvc_payment_account text,
  ADD COLUMN IF NOT EXISTS osvc_quote_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS osvc_operational_go_at timestamptz;

ALTER TABLE public.imperion_rsvp_submissions
  ADD COLUMN IF NOT EXISTS osvc_authorized_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_status_token_hash text;

ALTER TABLE public.imperion_rsvp_events
  ADD CONSTRAINT imperion_osvc_event_payment_go_guard_20261119
  CHECK (NOT osvc_payment_open OR (
    data_controller='Aliaksei Chareshneu (OSVČ)'
    AND category IN ('Guided Walk','Hike','Tour','Workshop')
    AND price_czk BETWEEN 1 AND 9999999
    AND price_verified AND end_time_verified AND is_open AND source_active
    AND registration_mode='FORM'
    AND osvc_quote_locked_at IS NOT NULL
    AND osvc_operational_go_at IS NOT NULL
    AND length(btrim(coalesce(osvc_payment_recipient,'')))>=3
    AND length(btrim(coalesce(osvc_payment_account,'')))>=8
  ));

ALTER TABLE public.imperion_rsvp_submissions
  ADD CONSTRAINT imperion_osvc_authorization_guard_20261119
  CHECK (osvc_authorized_at IS NULL OR data_controller='Aliaksei Chareshneu (OSVČ)');

CREATE UNIQUE INDEX IF NOT EXISTS imperion_rsvp_payment_status_token_hash_uq_20261119
  ON public.imperion_rsvp_submissions(payment_status_token_hash)
  WHERE payment_status_token_hash IS NOT NULL;



-- A PDF is only evidence. No bank settlement, Fio action, or seat confirmation
-- is created by this migration. Payment workflow stays owner-reviewed.
