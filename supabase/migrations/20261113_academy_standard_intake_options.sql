-- 13 November 2026: additive OSVC Academy standard programme options.
-- Preserve all original enquiry rows and statuses; no booking or bank payment.
begin;
alter table public.imperion_academy_inquiries
  drop constraint if exists imperion_academy_inquiries_product_code_check;
alter table public.imperion_academy_inquiries
  add constraint imperion_academy_inquiries_product_code_check
  check (product_code in ('UNI','MED','A2','CER','CAREER','DEFENSE','EXEC','LIFE','LESSON','CONSULT','PACK5','PACK10','PACK20'));
commit;
