-- 9 Nov 2026 owner-approved individual Druzina prices supersede 7 Nov group formula.
-- Only price model is migrated: never open payment or change historical commitments.
ALTER TABLE public.imperion_rsvp_events DROP CONSTRAINT IF EXISTS imperion_training_price_scheme_check;
ALTER TABLE public.imperion_rsvp_events
 ADD CONSTRAINT imperion_training_price_scheme_check
 CHECK (training_price_scheme IN ('LEGACY','GROUP_SHARED','INDIVIDUAL'));
ALTER TABLE public.imperion_rsvp_events DROP CONSTRAINT IF EXISTS imperion_training_payment_go_check;
ALTER TABLE public.imperion_rsvp_events
 ADD CONSTRAINT imperion_training_payment_go_check
 CHECK (NOT training_payment_open OR (
   training_price_scheme='INDIVIDUAL'
   AND training_quote_locked_at IS NOT NULL
   AND training_operational_go_at IS NOT NULL
   AND length(btrim(coalesce(training_payment_recipient,''))) >= 3
   AND length(btrim(coalesce(training_payment_account,''))) >= 8
   AND category='HEMA Training' AND community='Družina Moravy'
   AND price_czk>0 AND price_verified=true AND end_time_verified=true
 ));
ALTER TABLE public.imperion_rsvp_submissions
 ADD COLUMN IF NOT EXISTS training_requested_tier text NOT NULL DEFAULT 'STANDARD',
 ADD COLUMN IF NOT EXISTS training_authorized_tier text,
 ADD COLUMN IF NOT EXISTS training_authorized_at timestamptz,
 ADD COLUMN IF NOT EXISTS quoted_tier text;
ALTER TABLE public.imperion_rsvp_submissions
 ADD CONSTRAINT imperion_training_requested_tier_check
 CHECK (training_requested_tier IN ('STANDARD','SENIOR','STARTER4')),
 ADD CONSTRAINT imperion_training_authorized_tier_check
 CHECK (training_authorized_tier IS NULL OR training_authorized_tier IN ('SENIOR','STARTER4')),
 ADD CONSTRAINT imperion_training_quoted_tier_check
 CHECK (quoted_tier IS NULL OR quoted_tier IN ('STANDARD','SENIOR','STARTER4'));
ALTER TABLE public.imperion_rsvp_submissions DROP CONSTRAINT IF EXISTS imperion_payment_quote_check;
ALTER TABLE public.imperion_rsvp_submissions
 ADD CONSTRAINT imperion_payment_quote_check CHECK (
  quoted_total_czk IS NULL OR (
   quoted_base_czk>0 AND quoted_late_fee_czk>=0
   AND quoted_total_czk=quoted_base_czk+quoted_late_fee_czk
   AND (quoted_confirmed_count IS NULL OR quoted_confirmed_count BETWEEN 3 AND 200)
  )
 );
UPDATE public.imperion_rsvp_events
 SET training_price_scheme='INDIVIDUAL',
     training_confirmed_count=NULL
 WHERE community='Družina Moravy' AND category='HEMA Training'
   AND training_price_scheme='GROUP_SHARED' AND price_czk>0
   AND begins_at >= '2026-11-10T00:00:00Z';
-- Strictly maintain existing free workshop and pre-9-Nov agreed offer.
UPDATE public.imperion_rsvp_events
 SET training_price_scheme='LEGACY',training_payment_open=false
 WHERE event_id IN ('PUB-OREL-20261114','PUB-HEMA-20261109');
