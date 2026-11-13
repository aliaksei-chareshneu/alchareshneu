-- PDF operational evidence expires at event end + 90 days.
-- Storage deletion must use Storage API, not DELETE FROM storage.objects.
-- Reuse existing private intake bridge Vault secret; no new credential or paid service.
-- The Edge job deletes only date-prefix folders older than the expiry day.
SELECT cron.schedule(
 'imperion_training_payment_proof_retention_daily',
 '15 4 * * *',
 $job$
  SELECT net.http_post(
   url:='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-training-proof-retention',
   headers:=jsonb_build_object(
    'Content-Type','application/json',
    'x-imperion-cleanup-key',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='imperion_intake_bridge_key')
   ),
   body:='{}'::jsonb,
   timeout_milliseconds:=15000
  );
 $job$
);
