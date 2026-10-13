-- Safe draft creation: does not publish anything.
insert into public.operator_commands(
  command, subject_type, subject_id, target_worker, payload, idempotency_key
) values (
  'event.upsert',
  'event',
  'EVT-EXAMPLE-001',
  'supabase-event-operator',
  '{
    "event":{
      "eventId":"EVT-EXAMPLE-001",
      "community":"Brnowalkers",
      "category":"Hike",
      "title":"Example draft",
      "startDateTime":"2026-10-18T10:00:00+02:00",
      "endDateTime":"2026-10-18T15:00:00+02:00",
      "locationName":"Brno",
      "locationAddress":"Brno, Czechia",
      "priceCzk":0,
      "description":"Example only"
    }
  }'::jsonb,
  'event.upsert:EVT-EXAMPLE-001:v1'
);

-- Public publish requires explicit approval already obtained from the owner.
-- Never reuse the example ID in production.
-- Set payload.approved=true only when Aliaksei explicitly asked for that public action.
