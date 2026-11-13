-- Case IMP-ACADEMY-FLEX-SCHED-20261113.
-- Safely reconcile live 400-character Academy preferred-times form and Edge v3
-- with the database's old 100-character CHECK. Does not alter other status,
-- privacy, CRM, booking, payment, or retention controls.
-- Applied and independently read back 13 Nov 2026.
BEGIN;
ALTER TABLE public.imperion_academy_inquiries
  DROP CONSTRAINT IF EXISTS imperion_academy_inquiries_deadline_check;
ALTER TABLE public.imperion_academy_inquiries
  ADD CONSTRAINT imperion_academy_inquiries_deadline_check
  CHECK (char_length(deadline) <= 400);
COMMIT;
