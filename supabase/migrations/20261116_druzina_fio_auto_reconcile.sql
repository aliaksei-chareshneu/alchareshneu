-- Case IMP-DRUZINA-FIO-AUTO-20261116.
-- Additive integration with EXISTING private RSVP and private CRM. No paid checkout enabled.
-- Numeric VS is minted only for NEW training RS​VPs; legacy UUID-only quotes are not rewritten.
ALTER TABLE public.imperion_rsvp_submissions
 ADD COLUMN IF NOT EXISTS payment_variable_symbol text,
 ADD COLUMN IF NOT EXISTS payment_bank_check_after timestamptz,
 ADD COLUMN IF NOT EXISTS fio_bank_movement_id text,
 ADD COLUMN IF NOT EXISTS fio_bank_amount_czk integer,
 ADD COLUMN IF NOT EXISTS fio_bank_movement_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS imperion_rsvp_payment_variable_symbol_uq
 ON public.imperion_rsvp_submissions(payment_variable_symbol)
 WHERE payment_variable_symbol IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS imperion_rsvp_fio_movement_id_uq
 ON public.imperion_rsvp_submissions(fio_bank_movement_id)
 WHERE fio_bank_movement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS imperion_rsvp_due_proofs_idx
 ON public.imperion_rsvp_submissions(payment_bank_check_after)
 WHERE payment_evidence_status='PROOF_RECEIVED' AND payment_variable_symbol IS NOT NULL
 AND bank_verified_at IS NULL;

DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='imperion_rsvp_payment_vs_check') THEN
  ALTER TABLE public.imperion_rsvp_submissions
   ADD CONSTRAINT imperion_rsvp_payment_vs_check
   CHECK(payment_variable_symbol IS NULL OR payment_variable_symbol ~ '^[1-9][0-9]{9}$');
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='imperion_rsvp_fio_movement_check') THEN
  ALTER TABLE public.imperion_rsvp_submissions
   ADD CONSTRAINT imperion_rsvp_fio_movement_check
   CHECK(fio_bank_movement_id IS NULL OR
    (fio_bank_movement_id ~ '^[0-9]{6,18}$' AND fio_bank_amount_czk > 0
     AND fio_bank_movement_at IS NOT NULL AND bank_verified_at IS NOT NULL
     AND payment_evidence_status='BANK_VERIFIED'));
 END IF;
END $$;

-- Each bank credit is consumed once inside ONE database transaction, never
-- based on a customer-supplied PDF, front-end payload, or unsigned webhook.
-- SECURITY INVOKER + explicit EXECUTE grants: callers need service_role DB access.
CREATE OR REPLACE FUNCTION public.druzina_apply_fio_bank_credit(
 p_submission_id uuid,
 p_variable_symbol text,
 p_movement_id text,
 p_amount_czk integer,
 p_movement_at timestamptz
) RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
 IF p_submission_id IS NULL OR p_variable_symbol !~ '^[1-9][0-9]{9}$'
    OR p_movement_id !~ '^[0-9]{6,18}$' OR p_amount_czk IS NULL
    OR p_amount_czk<=0 OR p_amount_czk>9999999 OR p_movement_at IS NULL
    OR p_movement_at > now()+interval '1 day' THEN
   RETURN false;
 END IF;
 UPDATE public.imperion_rsvp_submissions AS s
 SET payment_evidence_status='BANK_VERIFIED',
     bank_verified_at=now(),
     fio_bank_movement_id=p_movement_id,
     fio_bank_amount_czk=p_amount_czk,
     fio_bank_movement_at=p_movement_at,
     payment_crm_synced_at=NULL
 FROM public.imperion_rsvp_events AS e
 WHERE s.id=p_submission_id
   AND s.event_id=e.event_id
   AND e.community='Družina Moravy'
   AND e.category='HEMA Training'
   AND e.data_controller='Družina Moravy, z. s.'
   AND s.data_controller=e.data_controller
   AND s.rsvp_status='YES'
   AND s.training_authorized_at IS NOT NULL
   AND s.payment_variable_symbol=p_variable_symbol
   AND s.quoted_total_czk=p_amount_czk
   AND s.payment_evidence_status='PROOF_RECEIVED'
   AND s.payment_pdf_path IS NOT NULL
   AND s.payment_pdf_sha256 IS NOT NULL
   AND s.payment_bank_check_after<=now()
   AND s.bank_verified_at IS NULL
   AND s.fio_bank_movement_id IS NULL
   AND p_movement_at >= s.created_at-interval '2 days'
 RETURNING s.id INTO v_id;
 RETURN v_id IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.druzina_apply_fio_bank_credit(uuid,text,text,integer,timestamptz)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.druzina_apply_fio_bank_credit(uuid,text,text,integer,timestamptz)
 TO service_role;

COMMENT ON COLUMN public.imperion_rsvp_submissions.payment_variable_symbol IS
 'Unique 10-digit VS for NEW individually approved Druzina transfer, never a payment';
COMMENT ON COLUMN public.imperion_rsvp_submissions.fio_bank_movement_id IS
 'Unique trusted provider movement ID, only written by private Fio settlement process';
