# Machine Factory — Event Operator

Source-controlled operator layer for Community Automation Hub.

## Canonical runtime

ChatGPT / operator
→ Supabase `operator_commands`
→ Supabase Edge Function `event-operator-worker`
→ Apps Script Community Hub
→ Google Sheets `Events` + Calendar / Telegram / site API.

Google Sheets `Events` remains the operational event SSoT. The worker routes commands; it does not duplicate Community Hub business logic.

The old local n8n worker is retired. The production worker is server-side and does not require Aliaksei's PC to be on.

## Event commands

- `event.upsert` — create/update a Draft event only. No public send. Refuses to silently edit an Active event.
- `event.publish` — publish/sync through Community Hub. Requires `payload.approved=true`.
- `event.verify` — read back current event evidence.
- `event.cancel` — cancel/archive through Community Hub. Requires `payload.approved=true`.

## Queue

Default target worker: `supabase-event-operator`.

States:
`queued → claimed → done | error | waiting_owner | cancelled`.

The Edge worker:
1. recovers expired leases;
2. atomically claims a queued command;
3. creates a random per-command capability token;
4. stores only its SHA-256 hash in Supabase;
5. sends the raw token once over HTTPS to Apps Script;
6. Apps Script verifies the capability against Supabase before executing;
7. worker records result/evidence and clears the capability.

No Supabase service-role key is stored in Apps Script, Git or Drive.

## Cron authentication

Supabase Cron runs once per minute and calls `private.kick_event_operator_worker()`.

The cron trigger token is generated inside Supabase Vault. Its plaintext value is never committed or copied into Drive/Git. The Edge Function rejects requests without a valid `X-Cron-Token`.

## Owner gate

Public side effects are not inferred.

`event.publish` and `event.cancel` execute only when the queued command contains `payload.approved=true`, after Aliaksei explicitly authorizes that concrete external action.

Drafting, validation and verification are safe automatic operations.

## Browser distribution

Browser-only destinations remain separate and use `target_worker='chatgpt-browser'` plus Browser Bridge.

Initial browser contract:
- `facebook.group.publish`
- `browser.publish.verify`

## Evidence / done criterion

A command is DONE only after readback. Event evidence can include:
- Event_ID / status
- Calendar link and event ID
- Telegram post ID
- Facebook Page post ID
- registration URL
- last sync timestamp
- Sync_Error

## Production state — 2026-10-06

- Apps Script production web app: deployment `AKfycbzKdIEwIF4gH9Cku3IQPC8uTrvR1CtHjMAOIzexrR3Mz9nDSLQ1znfT8Y2SS873jCtsLg`, updated to version 22 during operator rollout.
- Supabase Edge Function: `event-operator-worker`.
- Supabase Cron: `event-operator-worker`, every minute.
- Legacy queued `event.verify` was successfully processed by the new worker.
- A cron-only smoke test also completed without manual invocation.

## Files

- `event-command.schema.json` — event queue contract.
- `browser-command.schema.json` — browser-only distribution contract.
- `enqueue-examples.sql` — safe queue examples.
- `example-event-publish.json` — publish payload example; do not enqueue blindly.
- `supabase-event-operator/index.ts` — deployed Edge worker source.
- `supabase-event-operator/deno.json` — Edge runtime config.
- `supabase-operator.sql` — database functions and cron setup reference.

## Rule

Do not create another queue/dashboard/worker for event operations. Extend this one or deliberately replace it and update this README plus the automation master brief.
