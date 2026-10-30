-- IMPERION autonomous daily source readback
-- Installed in existing Supabase project on 2026-10-30 as pg_cron job 8.
-- Scheduled 05:25 UTC; uses the already running authorized event-operator-worker.
-- All tasks are read-only. No external marketing, publication or bookings.
-- Safe to rerun: named cron job and one idempotency key per event and UTC day.
select cron.schedule(
  'imperion_public_event_daily_source_readback',
  '25 5 * * *',
  $autoverify$
  insert into public.operator_commands
  (command,subject_type,subject_id,payload,state,priority,requested_by,dry_run,
   requires_owner_gate,idempotency_key,max_attempts,target_worker)
  select 'event.verify','event',e.event_id,
    jsonb_build_object('expected','Active','intent','read_only_verify',
      'audit','imperion_autonomous_daily_source_readback','no_publish',true),
    'queued',70,'imperion_autopilot',true,false,
    'imperion-autoverify:'||to_char((now() at time zone 'UTC')::date,'YYYYMMDD')||':'||e.event_id,
    2,'supabase-event-operator'
  from public.imperion_rsvp_events e
  where e.public_listing=true and e.source_active=true and e.is_open=true
    and e.registration_mode='FORM' and e.price_verified=true
    and e.end_time_verified=true and e.begins_at>now()
    and e.event_id~'^PUB-[A-Z0-9-]{4,90}$'
    and (e.title||' '||e.venue) !~* '(план|не подтвержд|уточня|HOLD|TBD|TBC|planned|nepotvrzen)'
  order by e.begins_at asc limit 30
  on conflict (idempotency_key) do nothing;
  $autoverify$
);
