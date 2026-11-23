-- IMP-REGISTER-CART-20261123: one contact form, multiple event RSVPs.
-- Carts are PRIVATE; multi-payee selections can never generate one bank transfer.
CREATE TABLE IF NOT EXISTS public.imperion_rsvp_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  controller text NOT NULL,
  resume_token_hash text NOT NULL UNIQUE CHECK (resume_token_hash ~ '^[0-9a-f]{64}$'),
  payment_variable_symbol text NOT NULL UNIQUE CHECK (payment_variable_symbol ~ '^[1-9][0-9]{9}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  retention_until timestamptz NOT NULL,
  quote_total_czk integer CHECK (quote_total_czk IS NULL OR (quote_total_czk > 0 AND quote_total_czk <= 9999999)),
  quote_lines jsonb,
  quote_locked_at timestamptz,
  quote_recipient text,
  quote_iban text,
  osvc_personal_consent_at timestamptz,
  payment_pdf_path text CHECK (payment_pdf_path IS NULL OR payment_pdf_path ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9a-f-]{36}[.]pdf$'),
  payment_pdf_sha256 text UNIQUE,
  payment_evidence_status text NOT NULL DEFAULT 'NOT_REQUIRED' CHECK (payment_evidence_status IN ('NOT_REQUIRED','PROOF_RECEIVED','BANK_VERIFIED','REJECTED')),
  payment_evidence_received_at timestamptz,
  payment_pdf_review_status text,
  payment_pdf_review_flags text[] NOT NULL DEFAULT '{}',
  bank_verified_at timestamptz,
  owner_bank_reference text,
  CHECK ((bank_verified_at IS NULL) = (payment_evidence_status <> 'BANK_VERIFIED'))
);
ALTER TABLE public.imperion_rsvp_carts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.imperion_rsvp_carts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.imperion_rsvp_carts TO service_role;

ALTER TABLE public.imperion_rsvp_submissions
  ADD COLUMN IF NOT EXISTS cart_id uuid REFERENCES public.imperion_rsvp_carts(id);
CREATE INDEX IF NOT EXISTS imperion_rsvp_cart_member_idx
  ON public.imperion_rsvp_submissions (cart_id) WHERE cart_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.imperion_rsvp_cart_create(p_cart jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $fn$
DECLARE
  item jsonb;
  ev public.imperion_rsvp_events%ROWTYPE;
  v_id uuid;
  v_controller text := NULL;
  v_expiry timestamptz := NULL;
  v_count int;
  v_total int := 0;
  v_references jsonb := '[]'::jsonb;
  v_row_id uuid;
  v_email text := p_cart->>'email';
  v_first text := p_cart->>'first';
  v_last text := p_cart->>'last';
  v_age text := p_cart->>'age';
  v_guardian text := nullif(p_cart->>'guardianName','');
  v_guardian_phone text := nullif(p_cart->>'guardianPhone','');
  v_photo text := 'NO'; -- no ambiguous cross-controller media licence
  v_lang text := p_cart->>'language';
  v_rsvp text := p_cart->>'rsvp';
BEGIN
  -- Extra backstop; this RPC is called only with the private service-role key.
  IF coalesce(current_setting('request.jwt.claim.role', true),'') <> 'service_role' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'invalid_items'; END IF;
  v_count := jsonb_array_length(p_items);
  IF v_count < 2 OR v_count > 8 THEN RAISE EXCEPTION 'invalid_cart_size'; END IF;
  IF v_rsvp NOT IN ('YES','MAYBE','NO') OR v_age NOT IN ('adult','under18')
    OR v_lang NOT IN ('cs','en','ru','uk') OR
    length(v_first) NOT BETWEEN 2 AND 80 OR length(v_last) NOT BETWEEN 2 AND 80 OR
    length(v_email) NOT BETWEEN 5 AND 254 OR
    length(p_cart->>'phone') NOT BETWEEN 7 AND 35 OR
    (v_age='under18' AND (length(coalesce(v_guardian,'')) < 3 OR length(coalesce(v_guardian_phone,'')) < 7))
    OR (p_cart->>'cartTokenHash') !~ '^[0-9a-f]{64}$'
    OR (p_cart->>'paymentVariableSymbol') !~ '^[1-9][0-9]{9}$'
  THEN RAISE EXCEPTION 'invalid_cart_fields'; END IF;
  IF (SELECT count(DISTINCT x->>'eventId') FROM jsonb_array_elements(p_items) x) <> v_count
  THEN RAISE EXCEPTION 'duplicate_cart_items'; END IF;

  -- Validate ALL items before a single insert; unique-index conflict aborts the whole transaction.
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF (item->>'eventId') !~ '^[A-Za-z0-9-]{2,100}$' OR
       (item->>'resumeTokenHash') !~ '^[0-9a-f]{64}$' OR
       (item->>'statusTokenHash') !~ '^[0-9a-f]{64}$' OR
       (item->>'variableSymbol') !~ '^[1-9][0-9]{9}$' OR
       (item->>'tier') NOT IN ('STANDARD','SENIOR','STARTER4')
    THEN RAISE EXCEPTION 'invalid_item'; END IF;
    SELECT * INTO ev FROM public.imperion_rsvp_events
      WHERE event_id=item->>'eventId' AND public_listing=true AND is_open=true
      AND source_active=true AND price_verified=true AND end_time_verified=true
      AND registration_mode='FORM' AND begins_at>now();
    IF NOT FOUND THEN RAISE EXCEPTION 'event_not_available'; END IF;
    IF ev.contact_activity AND ev.rules_url !~ '/druzina/(safety|rules)/'
    THEN RAISE EXCEPTION 'event_not_available'; END IF;
    IF ev.category <> 'HEMA Training' AND item->>'tier' <> 'STANDARD'
    THEN RAISE EXCEPTION 'invalid_item_tier'; END IF;
    IF ev.data_controller='Aliaksei Chareshneu (OSVČ)' AND
       ev.category='HEMA Training' AND item->>'tier'='STARTER4'
    THEN RAISE EXCEPTION 'package_requires_authorization'; END IF;
    IF EXISTS(SELECT 1 FROM public.imperion_rsvp_submissions s
      WHERE s.event_id=ev.event_id AND lower(s.email)=v_email
      AND lower(s.first_name)=lower(v_first) AND lower(s.last_name)=lower(v_last))
    THEN RAISE EXCEPTION 'already_registered'; END IF;
    IF v_controller IS NULL THEN v_controller := ev.data_controller;
    ELSIF v_controller <> ev.data_controller THEN v_controller := 'MIXED'; END IF;
    v_expiry := greatest(coalesce(v_expiry,ev.ends_at),ev.ends_at);
  END LOOP;
  -- Retain only as long as the latest event's existing 90-day RSVP window.
  v_expiry := v_expiry + interval '90 days';
  INSERT INTO public.imperion_rsvp_carts
    (first_name,last_name,email,controller,resume_token_hash,payment_variable_symbol,retention_until)
  VALUES (v_first,v_last,v_email,v_controller,p_cart->>'cartTokenHash',p_cart->>'paymentVariableSymbol',v_expiry)
  RETURNING id INTO v_id;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO ev FROM public.imperion_rsvp_events WHERE event_id=item->>'eventId';
    INSERT INTO public.imperion_rsvp_submissions
      (cart_id,event_id,first_name,last_name,email,phone,age_group,guardian_name,guardian_phone,
       rsvp_status,safety_acknowledged,safety_version,photo_choice,marketing_requested,
       data_controller,language,retention_until,discovery_source,utm_source,utm_medium,utm_campaign,
       training_requested_tier,payment_variable_symbol,payment_resume_token_hash,
       payment_status_token_hash,payment_resume_token_issued_at)
    VALUES
      (v_id,ev.event_id,v_first,v_last,v_email,p_cart->>'phone',v_age,v_guardian,v_guardian_phone,
       v_rsvp,true,'2026-10-25-v1',v_photo,false,
       ev.data_controller,v_lang,ev.ends_at + interval '90 days',
       nullif(p_cart->>'discoverySource',''),nullif(p_cart->>'utmSource',''),
       nullif(p_cart->>'utmMedium',''),nullif(p_cart->>'utmCampaign',''),
       item->>'tier',item->>'variableSymbol',item->>'resumeTokenHash',
       item->>'statusTokenHash',now())
    RETURNING id INTO v_row_id;
    v_references := v_references || jsonb_build_array(jsonb_build_object('eventId',ev.event_id,'reference',v_row_id));
  END LOOP;
  RETURN jsonb_build_object('cartId',v_id,'references',v_references,'controller',v_controller);
END;
$fn$;
REVOKE ALL ON FUNCTION public.imperion_rsvp_cart_create(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.imperion_rsvp_cart_create(jsonb,jsonb) TO service_role;

COMMENT ON TABLE public.imperion_rsvp_carts IS 'Private multi-event RSVP checkout groups; NOT bank-verified until independent owner statement readback.';

CREATE OR REPLACE FUNCTION public.imperion_rsvp_cart_record_proof(
  p_cart_id uuid, p_pdf_path text, p_pdf_sha256 text,
  p_review_status text, p_review_flags text[])
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $fn$
DECLARE cart public.imperion_rsvp_carts%ROWTYPE; line jsonb; v_count int := 0;
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
  THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT * INTO cart FROM public.imperion_rsvp_carts WHERE id=p_cart_id FOR UPDATE;
  IF NOT FOUND OR cart.payment_evidence_status <> 'NOT_REQUIRED' OR cart.quote_total_czk IS NULL
    OR p_pdf_path !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9a-f-]{36}[.]pdf$'
    OR p_pdf_sha256 !~ '^[a-f0-9]{64}$'
    OR p_review_status NOT IN ('MATCHED_UNVERIFIED','NEEDS_MANUAL_REVIEW')
  THEN RETURN false; END IF;
  UPDATE public.imperion_rsvp_carts SET
    payment_pdf_path=p_pdf_path,payment_pdf_sha256=p_pdf_sha256,
    payment_evidence_status='PROOF_RECEIVED',payment_evidence_received_at=now(),
    payment_pdf_review_status=p_review_status,payment_pdf_review_flags=p_review_flags
  WHERE id=p_cart_id;
  FOR line IN SELECT value FROM jsonb_array_elements(cart.quote_lines) LOOP
    UPDATE public.imperion_rsvp_submissions SET
      quoted_base_czk=(line->>'baseCzk')::int,
      quoted_late_fee_czk=(line->>'surchargeCzk')::int,
      quoted_total_czk=(line->>'totalCzk')::int,
      quoted_tier=line->>'tier',
      quoted_late_48h=(line->>'late48h')::boolean,
      payment_evidence_status='PROOF_RECEIVED',
      payment_evidence_received_at=now(),
      payment_pdf_review_status=p_review_status,
      payment_pdf_review_flags=ARRAY['MULTI_EVENT_SINGLE_TRANSFER','BANK_NOT_VERIFIED'],
      payment_bank_check_after=NULL,
      payment_resume_token_hash=NULL,
      payment_crm_synced_at=NULL
    WHERE id=(line->>'reference')::uuid AND cart_id=p_cart_id
      AND payment_evidence_status='NOT_REQUIRED';
    IF NOT FOUND THEN RAISE EXCEPTION 'cart_member_changed'; END IF;
    v_count := v_count+1;
  END LOOP;
  RETURN v_count>0;
END;
$fn$;
REVOKE ALL ON FUNCTION public.imperion_rsvp_cart_record_proof(uuid,text,text,text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.imperion_rsvp_cart_record_proof(uuid,text,text,text,text[]) TO service_role;

-- Owner-only bank statement readback: never triggered by uploading a PDF.
CREATE OR REPLACE FUNCTION public.imperion_rsvp_cart_verify_credit(
  p_cart_id uuid, p_paid_czk integer, p_bank_reference text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $fn$
DECLARE cart public.imperion_rsvp_carts%ROWTYPE;
BEGIN
 IF coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
 THEN RAISE EXCEPTION 'not_authorized'; END IF;
 SELECT * INTO cart FROM public.imperion_rsvp_carts WHERE id=p_cart_id FOR UPDATE;
 IF NOT FOUND OR cart.payment_evidence_status <> 'PROOF_RECEIVED'
   OR cart.controller <> 'Aliaksei Chareshneu (OSVČ)'
   OR cart.quote_recipient <> 'Aliaksei Chareshneu'
   OR cart.quote_iban <> 'CZ9755000000007804336003'
   OR cart.quote_total_czk IS DISTINCT FROM p_paid_czk
   OR p_bank_reference IS NULL OR length(trim(p_bank_reference)) NOT BETWEEN 8 AND 100
 THEN RETURN false; END IF;
 UPDATE public.imperion_rsvp_carts SET
   payment_evidence_status='BANK_VERIFIED',bank_verified_at=now(),owner_bank_reference=trim(p_bank_reference)
 WHERE id=p_cart_id;
 UPDATE public.imperion_rsvp_submissions SET
   payment_evidence_status='BANK_VERIFIED',bank_verified_at=now(),payment_crm_synced_at=NULL
 WHERE cart_id=p_cart_id AND payment_evidence_status='PROOF_RECEIVED'
   AND quoted_total_czk IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'cart_paid_rows_missing'; END IF;
 RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION public.imperion_rsvp_cart_verify_credit(uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.imperion_rsvp_cart_verify_credit(uuid,integer,text) TO service_role;