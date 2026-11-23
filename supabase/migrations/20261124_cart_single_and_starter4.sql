-- Allow a single-date checkout and Starter4 intent in the existing cart RPC.
-- Payment remains CLOSED until the Edge Function validates the exact plan,
-- same legal seller, 30-day window, individual authorization and live payee.
-- Does not change RLS, banking credentials or any previously agreed terms.
CREATE OR REPLACE FUNCTION public.imperion_rsvp_cart_create(p_cart jsonb, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  v_photo text := CASE WHEN p_cart->>'photo'='YES' AND p_cart->>'age'='adult' THEN 'YES' ELSE 'NO' END;
  v_updates boolean := p_cart->>'futureUpdates'='true' AND p_cart->>'age'='adult';
  v_lang text := p_cart->>'language';
  v_rsvp text := p_cart->>'rsvp';
BEGIN
  -- Extra backstop; this RPC is called only with the private service-role key.
  IF coalesce(current_setting('request.jwt.claim.role', true),'') <> 'service_role' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'invalid_items'; END IF;
  v_count := jsonb_array_length(p_items);
  IF v_count < 1 OR v_count > 8 THEN RAISE EXCEPTION 'invalid_cart_size'; END IF;
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
    -- Starter 4 requests are persisted, but a safe server quote still requires 4 matching dates and individual approval.
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
       v_rsvp,true,'2026-10-25-v1',CASE WHEN v_controller='MIXED' THEN 'NO' ELSE v_photo END,
       CASE WHEN v_controller='MIXED' THEN false ELSE v_updates END,
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
$function$
;
REVOKE ALL ON FUNCTION public.imperion_rsvp_cart_create(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.imperion_rsvp_cart_create(jsonb,jsonb) TO service_role;
