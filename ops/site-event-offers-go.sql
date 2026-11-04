-- REVIEWED STAGING ONLY: NOT APPLIED. Requires separate publication GO.
-- Supabase project cmrknyhnnehyjpreehcf, public.imperion_b2b_inquiries.
-- Readback 2026-11-04 confirmed the current offer constraint permits only
-- AI_WORKSHOP, DATA_PILOT, SCIENTIFIC_CONSULTING, HEMA_CORPORATE.
-- Deployment sequence: approve -> apply this constraint change -> deploy
-- companion Edge Function code -> verify non-PII event enquiry E2E in a
-- controlled test -> publish GitHub Pages -> readback (intake and CRM).
BEGIN;
ALTER TABLE public.imperion_b2b_inquiries
 DROP CONSTRAINT imperion_b2b_inquiries_offer_check;
ALTER TABLE public.imperion_b2b_inquiries
 ADD CONSTRAINT imperion_b2b_inquiries_offer_check
 CHECK (offer = ANY (ARRAY[
  'AI_WORKSHOP', 'DATA_PILOT', 'SCIENTIFIC_CONSULTING',
  'HEMA_CORPORATE', 'EVENT_HOST', 'EVENT_PROGRAM'
 ]::text[]));
COMMIT;
