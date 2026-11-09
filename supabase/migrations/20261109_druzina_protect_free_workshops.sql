-- Production safety hotfix: free HEMA workshop must NEVER become paid.
ALTER TABLE public.imperion_rsvp_events
 ADD CONSTRAINT imperion_no_payment_for_free_sessions
 CHECK (NOT training_payment_open OR (price_czk IS NOT NULL AND price_czk > 0));
UPDATE public.imperion_rsvp_events
 SET training_price_scheme='LEGACY',
     training_payment_open=false,
     training_confirmed_count=null,
     training_quote_locked_at=null,
     training_operational_go_at=null,
     training_payment_recipient=null,
     training_payment_account=null
 WHERE (price_czk=0 OR event_id='PUB-OREL-20261114')
   AND community='Družina Moravy'
   AND category='HEMA Training';
