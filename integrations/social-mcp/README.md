# Imperion Social MCP — Telegram bridge + WhatsApp group preview

**Stage:** reviewable source only. NO deployment or live publication established. Zero npm dependencies, zero new CRM, zero new scheduler, no n8n activation.

## What this is

A small Node >=20 remote MCP HTTP endpoint whose Telegram tools call the existing **Community Hub Apps Script**. The Apps Script bridge uses its **existing** `TELEGRAM_BOT_TOKEN`, `Events` and `SocialPublishing` sheet in the existing CRM. The bot publishes only one explicitly approved `Job_ID` to the corresponding club channel. It records Telegram's returned `message_id` and public `t.me` post URL in the existing rows. A failure with an unknown delivery outcome is **never automatically retried**.

The WhatsApp tool generates a prepared `wa.me` group share URL from a fully approved WhatsApp job **without sending**; ordinary personal WhatsApp groups have no generally available official autopost API. This is not an unofficial WhatsApp Web session/QR scraper. No bulk recipient messaging, personal userbot, or unsolicited DM capability.

## Audited legacy context

- `Code.gs` already implements `sendTelegramMessage` and club channel routing. The bridge reuses `TELEGRAM_BOT_TOKEN` and its configured channels.
- Legacy Drive file `content-publish.json` contains an n8n schedule every 15 minutes and a Telegram node, BUT reads a separate `Announcements` sheet in `Moravian Host — Automation Data`. It is not the authoritative `SocialPublishing` queue. It contains a placeholder Facebook Page token and an incomplete GitHub step. **Do not import/activate this old workflow**; audit live n8n workflows and routes first.
- `owner-bot-router.json` is another old workflow template, not proof of server execution.
- `SocialPublishing` has exact columns `Job_ID`, `Event_ID`, `Channel`, `Status`, `Duplicate_Checked`, `Approved_At`, `Rights_OK`, `Visibility`, `Post_ID`, `Post_URL`, etc. Existing rows read on 2026-10-25 were predominantly DRAFT/SCHEDULED_PENDING, not eligible for automatic publication.
- Existing `Events.Telegram_Post_ID` is a second deduplication gate. Telegram publishing is blocked when this field is set.

## Security / approval contract

- The MCP server defaults to `127.0.0.1:8788`; it cannot be publicly exposed without `MCP_CLIENT_TOKEN` and an allowed Host. Use an authenticated HTTPS proxy or ChatGPT Secure MCP Tunnel. The server itself is not OAuth; **do not choose No Authentication on a publicly reachable endpoint**.
- The Apps Script bridge accepts only `POST /exec?mcp=1` with a HMAC-SHA256 signed body (`v1`, action, Job_ID, Unix ms, nonce), checks a 120s window and one-use nonce. It **does not** reuse the Tally webhook secret.
- Required Apps Script Script Properties: existing `TELEGRAM_BOT_TOKEN`; new independent random `MCP_BRIDGE_SECRET` (at least 32 characters). `MCP_BRIDGE_SECRET` is also set privately on the MCP server. Never check these into GitHub or docs or memory.
- Publishing requires `PUBLISH_ENABLED=1` and `confirm:true` on the MCP tool. The bridge then checks exactly one Job_ID, channel `telegram`, status `APPROVED`, nonempty Approved_At, Rights_OK=YES, Duplicate_Checked=YES, Visibility=PUBLIC, nonempty legal Entity, clear Post_ID/Post_URL/Error, current Active event with a future start, empty `Events.Telegram_Post_ID`, and grant attribution when funded.
- **Media:** image HTTPS PNG/JPEG/WebP is supported with Telegram `sendPhoto` and caption <=1024 chars; text-only with <=4096 chars. Videos and unsafe media formats intentionally block until reviewed support is implemented. No HTML parsing of user content.
- `Status=SENDING_RECONCILE_IF_INTERRUPTED` is written **before** Bot API call. Unknown results go to `RECONCILIATION_REQUIRED`, never blind retry. `PUBLISHED_VERIFIED` is written only after Telegram returns a message ID and Apps Script saves its receipt. Independent public link readback is still needed before claiming user-visible verification in the broad campaign dashboard.
- This interface does not add another queue, cron, outreach automation, or message recipient database. Do not merge/release before an operator reviews actual `Code.gs` deployment, script version, target channels and current active workflow state.

## Files

- `server.mjs` — minimal stateless legacy-MCP 2025-11-25 Streamable HTTP JSON-RPC (JSON responses); no npm packages.
- `bridge/MCPBridge.gs` — signed Apps Script dispatcher and synchronous lock-protected Telegram publication.
- `.env.example` — only placeholder configuration.
- `tests/server.test.mjs` — synthetic protocol, HMAC, auth, duplicate and fail-closed tests.

## Integration steps (not yet executed)

1. **Check live source of the Apps Script project** (not just GitHub). Deploy the reviewed `bridge/MCPBridge.gs` in the **existing** Community Hub script, then add only this early branch at the very beginning of the same deployed `Code.gs` `doPost(e)`:

   ```javascript
   if (e && e.parameter && e.parameter.mcp === '1') return imperionMcpHandle_(e);
   ```

   Keep all existing registration and site routes. Do not deploy a second Apps Script project.
2. Set a random >=32-character `MCP_BRIDGE_SECRET` in Apps Script **Script Properties**, and identical secret on the MCP host. Never reuse the Tally webhook secret.
3. On the host, set `MCP_BRIDGE_WEBAPP_URL` to the deployed existing Apps Script `/exec` URL. Run `node server.mjs`, then use synthetic local test calls with `PUBLISH_ENABLED=0`.
4. Connect ChatGPT using an authorised Secure MCP Tunnel or a separately secured HTTPS/OAuth proxy. The host is **not internet-public by default**. A ChatGPT plugin connection requires workspace-level permission/installation. No manual auth is hidden in these files.
5. Read an already completed job with `telegram_preview`, expecting `ALREADY_PUBLISHED` or `EVENT_ALREADY_ANNOUNCED_IN_TELEGRAM` and **no new publication**. Then review one future approved job under the correct legal entity, grant, media and permission checks. Only after review set `PUBLISH_ENABLED=1` and call `telegram_publish_approved` with `confirm=true`. Verify the live `t.me` link and read back the exact `SocialPublishing`/`Events` cells.
6. n8n may use this MCP only as a client of the existing queue; don't turn on its old `Announcements` schedule. Audit and disable duplicate senders **only after** proving what is currently active, with no interruption of existing promised publications.

## Quick checks (no side effects)

```bash
cd integrations/social-mcp
node --test tests/*.test.mjs
MCP_PORT=8788 node server.mjs
# In another terminal, only for a local development server:
curl -s http://127.0.0.1:8788/health
curl -s -X POST http://127.0.0.1:8788/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"smoke","version":"1"}}}'
```

## Costs

MCP bridge, Telegram Bot API and existing Google Sheets / Apps Script have no separate paid MCP subscription; quotas still apply. The existing server must be maintained and be allowed to run. WhatsApp Business 1:1 messaging templates and Meta charges are a separate product; group posting here remains a manual share preview.