# Machine Factory — Event Operator

Source-controlled operator layer for Community Automation Hub.

## Contract

Every command follows:

INTAKE -> NORMALIZE -> DECIDE -> ACT -> VERIFY -> EVIDENCE -> ESCALATE

Google Sheets `Events` remains the operational event SSoT. n8n is the command router/state machine; it does not duplicate the existing Apps Script business logic.

## Runtime

ChatGPT / operator
-> Supabase `operator_commands`
-> target worker
   - `n8n-event-operator` -> Apps Script Community Hub
   - `chatgpt-browser` -> Browser Bridge for browser-only destinations
-> verification evidence
-> Supabase terminal state

## Event commands handled by n8n

- `event.upsert` — create/update a Draft event only. No public send. Refuses to silently edit an already Active event.
- `event.publish` — create/sync/publish event through the existing Community Hub logic. Requires explicit `payload.approved=true`.
- `event.verify` — read back Sheet state and external IDs/links.
- `event.cancel` — archive/cancel and run external cleanup/notice path. Requires explicit approval.

An approved update flow for already-published events is intentionally not hidden inside `event.upsert`; it should be implemented as a distinct `event.update` command so changed external posts/calendar entries can be reconciled deliberately.

## Browser distribution commands

Browser-only destinations use `target_worker='chatgpt-browser'`.

Initial contract:
- `facebook.group.publish`
- `browser.publish.verify`

These are executed with Browser Bridge using the canonical loop:
open/status -> snapshot -> fresh refs -> one narrow action -> snapshot -> verify.

n8n cannot claim these commands because the Supabase queue is worker-scoped.

## Queue states

`queued -> claimed -> done|error|waiting_owner|cancelled`

The queue has:
- idempotency keys;
- worker targeting;
- lease expiry/retry;
- max attempts;
- correlation IDs;
- command audit events;
- result/evidence storage.

## Secrets

Never put secrets in workflow JSON, Git, Drive briefs, command payloads, or browser jobs.

n8n runtime needs:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `COMMUNITY_HUB_OPERATOR_URL`
- `COMMUNITY_HUB_OPERATOR_SECRET`

Apps Script needs the matching Script Property:
- `OPERATOR_SHARED_SECRET`

## Owner gate

Public action is not inferred.

`event.publish` and `event.cancel` execute only when the queued command contains `payload.approved=true`, which should be set only after Aliaksei explicitly authorizes that concrete external action.

Drafting, normalization, validation and verification remain safe automatic operations.

## Evidence / done criterion

A command is DONE only after readback.

For an event publish, evidence should contain:
- Event_ID
- Status=Active
- Calendar link/event ID
- Telegram post ID for public events
- Facebook Page post ID when Page publishing is enabled
- registration URL
- admin-buffer timestamp when the column exists
- empty Sync_Error

Facebook groups require separate Browser Bridge evidence such as the final post URL or verified snapshot.

## Deployment sequence

1. Validate this package and `Code.gs`.
2. Push branch; do not merge production blindly.
3. Copy canonical `Code.gs` into clasp source and push HEAD.
4. Create a staging Web App deployment for operator tests.
5. Manually configure the shared operator secret in Apps Script and n8n credential/environment storage.
6. Import `n8n-event-operator.workflow.json` inactive.
7. Smoke-test `event.verify` and `event.upsert` first.
8. With explicit approval, test one `event.publish`; verify every channel and clean up.
9. Activate workflow.
10. Only then decide whether to point the canonical production deployment at the tested version.
