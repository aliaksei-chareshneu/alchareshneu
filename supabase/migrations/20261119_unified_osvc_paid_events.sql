-- IMP-PAID-EVENTS-READY-20261119. Add to the existing RSVP + event tables.
-- Separate legal sellers: OSVC event receipts MUST NOT use Druzina bank configuration.
-- All payment/seat gates default closed. No historic/free bookings are converted.
ALTER TABLE public.imperion_rsvp_events
  ADD COLUMN IF NOT EXISTS osvc_payment_open boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS osvc_payment_recipient text,
  ADD COLUMN IF NOT EXISTS osvc_payment_account text,
  ADD COLUMN IF NOT EXISTS osvc_quote_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS osvc_operational_go_at timestamptz,
  ADD COLUMN IF NOT EXISTS booking_capacity integer,
  ADD COLUMN IF NOT EXISTS booking_operational_go_at timestamptz;

ALTER TABLE public.imperion_rsvp_submissions
  ADD COLUMN IF NOT EXISTS osvc_authorized_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_status_token_hash text,
  ADD COLUMN IF NOT EXISTS booking_confirmed_at timestamptz;

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
  )),
  ADD CONSTRAINT imperion_event_booking_capacity_guard_20261119
  CHECK (booking_capacity IS NULL OR booking_capacity BETWEEN 1 AND 200);

ALTER TABLE public.imperion_rsvp_submissions
  ADD CONSTRAINT imperion_paid_booking_confirmation_guard_20261119
  CHECK (booking_confirmed_at IS NULL OR (
    bank_verified_at IS NOT NULL AND payment_evidence_status='BANK_VERIFIED'
    AND rsvp_status='YES'
  )),
  ADD CONSTRAINT imperion_osvc_authorization_guard_20261119
  CHECK (osvc_authorized_at IS NULL OR data_controller='Aliaksei Chareshneu (OSVČ)');

CREATE UNIQUE INDEX IF NOT EXISTS imperion_rsvp_payment_status_token_hash_uq_20261119
  ON public.imperion_rsvp_submissions(payment_status_token_hash)
  WHERE payment_status_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS imperion_rsvp_booked_capacity_idx_20261119
  ON public.imperion_rsvp_submissions (event_id,booking_confirmed_at)
  WHERE booking_confirmed_at IS NOT NULL;

-- Authorization, capacity, and confirmed bank credit are all required.
-- Lock the event row to avoid overselling under concurrent bank readbacks.
CREATE OR REPLACE FUNCTION public.imperion_confirm_paid_rsvp(p_submission_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $confirm$
DECLARE s record; e record; used_seats integer;
BEGIN
  SELECT id,event_id,data_controller,rsvp_status,bank_verified_at,
      payment_evidence_status,booking_confirmed_at,
      training_authorized_at,osvc_authorized_at
    INTO s FROM public.imperion_rsvp_submissions
    WHERE id=p_submission_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF s.booking_confirmed_at IS NOT NULL THEN RETURN true; END IF;
  IF s.rsvp_status<>'YES' OR s.bank_verified_at IS NULL OR
     s.payment_evidence_status<>'BANK_VERIFIED' THEN RETURN false; END IF;
  SELECT event_id,community,category,data_controller,begins_at,is_open,
      source_active,booking_capacity,booking_operational_go_at,
      training_payment_open,training_operational_go_at,
      osvc_payment_open,osvc_operational_go_at
    INTO e FROM public.imperion_rsvp_events
    WHERE event_id=s.event_id FOR UPDATE;
  IF NOT FOUND OR e.data_controller<>s.data_controller OR
     NOT e.is_open OR NOT e.source_active OR e.begins_at<=now() OR
     e.booking_capacity IS NULL OR e.booking_operational_go_at IS NULL THEN
    RETURN false;
  END IF;
  IF NOT (
    (e.data_controller='Družina Moravy, z. s.'
     AND e.community='Družina Moravy' AND e.category='HEMA Training'
     AND e.training_payment_open AND e.training_operational_go_at IS NOT NULL
     AND s.training_authorized_at IS NOT NULL)
    OR
    (e.data_controller='Aliaksei Chareshneu (OSVČ)'
     AND e.category IN ('Guided Walk','Hike','Tour','Workshop')
     AND e.osvc_payment_open AND e.osvc_operational_go_at IS NOT NULL
     AND s.osvc_authorized_at IS NOT NULL)
  ) THEN RETURN false; END IF;
  SELECT count(*) INTO used_seats FROM public.imperion_rsvp_submissions
    WHERE event_id=e.event_id AND booking_confirmed_at IS NOT NULL;
  IF used_seats>=e.booking_capacity THEN RETURN false; END IF;
  UPDATE public.imperion_rsvp_submissions SET
    booking_confirmed_at=now(),payment_crm_synced_at=NULL
    WHERE id=p_submission_id AND booking_confirmed_at IS NULL;
  RETURN FOUND;
END;
$confirm$;
REVOKE ALL ON FUNCTION public.imperion_confirm_paid_rsvp(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.imperion_confirm_paid_rsvp(uuid) TO service_role;

-- Exact OSVC credit can only be applied by a privileged worker with
-- a genuine independent provider readback. Never by browser/PDF.
CREATE OR REPLACE FUNCTION public.osvc_apply_fio_bank_credit(
 p_submission_id uuid,p_variable_symbol text,p_movement_id text,
 p_amount_czk integer,p_movement_at timestamptz
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $credit$
DECLARE v_id uuid;
BEGIN
 IF p_submission_id IS NULL OR p_variable_symbol !~ '^[1-9][0-9]{9}$'
    OR p_movement_id !~ '^[0-9]{6,18}$' OR p_amount_czk IS NULL
    OR p_amount_czk<=0 OR p_amount_czk>9999999 OR p_movement_at IS NULL
    OR p_movement_at > now()+interval '1 day' THEN RETURN false; END IF;
 UPDATE public.imperion_rsvp_submissions AS s
 SET payment_evidence_status='BANK_VERIFIED',bank_verified_at=now(),
     fio_bank_movement_id=p_movement_id,fio_bank_amount_czk=p_amount_czk,
     fio_bank_movement_at=p_movement_at,payment_crm_synced_at=NULL
 FROM public.imperion_rsvp_events AS e
 WHERE s.id=p_submission_id AND e.event_id=s.event_id
   AND e.data_controller='Aliaksei Chareshneu (OSVČ)'
   AND s.data_controller=e.data_controller
   AND e.category IN ('Guided Walk','Hike','Tour','Workshop')
   AND s.rsvp_status='YES' AND s.osvc_authorized_at IS NOT NULL
   AND s.payment_variable_symbol=p_variable_symbol
   AND s.quoted_total_czk=p_amount_czk
   AND s.payment_evidence_status='PROOF_RECEIVED'
   AND s.payment_pdf_path IS NOT NULL AND s.payment_pdf_sha256 IS NOT NULL
   AND s.payment_bank_check_after<=now()
   AND s.bank_verified_at IS NULL AND s.fio_bank_movement_id IS NULL
   AND p_movement_at::date>=s.created_at::date
 RETURNING s.id INTO v_id;
 RETURN v_id IS NOT NULL;
END;
$credit$;
REVOKE ALL ON FUNCTION public.osvc_apply_fio_bank_credit(uuid,text,text,integer,timestamptz)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.osvc_apply_fio_bank_credit(uuid,text,text,integer,timestamptz)
 TO service_role;

COMMENT ON COLUMN public.imperion_rsvp_events.osvc_payment_open IS
  'OSVC only; defaults false, requires separate owner payee/venue/terms/seat authorization';
COMMENT ON COLUMN public.imperion_rsvp_submissions.booking_confirmed_at IS
  'Only set after independent bank credit and event-specific capacity authorization';
