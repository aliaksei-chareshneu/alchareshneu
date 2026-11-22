-- OSVC personal HEMA checkout: personal service is NOT association dues.
-- Existing association RSVPs stay unchanged until the customer explicitly
-- accepts the individual OSVC re-offer by private code.
-- Applied to production with Supabase migration osvc_hema_raiffeisen_seller_consent_20261122.
ALTER TABLE public.imperion_rsvp_events
  DROP CONSTRAINT IF EXISTS imperion_osvc_event_payment_go_guard_20261119;
ALTER TABLE public.imperion_rsvp_events
  ADD CONSTRAINT imperion_osvc_event_payment_go_guard_20261122
  CHECK (NOT osvc_payment_open OR (
    data_controller='Aliaksei Chareshneu (OSVČ)'
    AND (category IN ('Guided Walk','Hike','Tour','Workshop')
      OR (category='HEMA Training' AND community='Družina Moravy'
        AND NOT training_payment_open))
    AND price_czk BETWEEN 1 AND 999999
    AND price_verified AND end_time_verified AND is_open AND source_active
    AND registration_mode='FORM'
    AND osvc_quote_locked_at IS NOT NULL
    AND osvc_operational_go_at IS NOT NULL
    AND osvc_payment_recipient='Aliaksei Chareshneu'
    AND regexp_replace(osvc_payment_account,'[[:space:]]','','g')
      = 'CZ9755000000007804336003'
  ));
ALTER TABLE public.imperion_rsvp_submissions
  ADD COLUMN IF NOT EXISTS osvc_personal_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS osvc_previous_controller text;
ALTER TABLE public.imperion_rsvp_submissions
  ADD CONSTRAINT imperion_osvc_accepted_reoffer_20261122
  CHECK (
    (osvc_personal_consent_at IS NULL OR data_controller='Aliaksei Chareshneu (OSVČ)')
    AND (osvc_previous_controller IS NULL OR
      (osvc_previous_controller='Družina Moravy, z. s.'
       AND osvc_personal_consent_at IS NOT NULL
       AND data_controller='Aliaksei Chareshneu (OSVČ)'))
  );