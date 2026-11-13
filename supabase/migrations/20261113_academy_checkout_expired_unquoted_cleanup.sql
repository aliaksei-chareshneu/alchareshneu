-- Safe, scope-limited operational expiry: ONLY new unquoted Academy website
-- requests with NO approved quote, NO evidence and NO bank-verified funds.
-- Paid transactions and all pre-existing sources remain untouched.
select cron.schedule(
 'imperion_academy_checkout_unquoted_expiry_0350',
 '50 3 * * *',
 $cleanup$
  delete from public.imperion_academy_inquiries
   where source='academy_checkout_20261113'
     and retention_until <= now()
     and payment_quote_status in ('NOT_QUOTED','REVOKED')
     and payment_evidence_status = 'NOT_REQUIRED'
     and bank_verified_at is null
     and booking_confirmed_at is null;
 $cleanup$
);
