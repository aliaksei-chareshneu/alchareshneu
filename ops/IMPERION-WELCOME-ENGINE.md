# IMPERION Welcome Engine — staged extension (04 Nov 2026)

Status 2026-11-04: Supabase Edge Function v2 ACTIVE but DRY_RUN / NO LIVE MESSAGES. This is a module of existing alchareshneu + Supabase browser-bridge, not a new CRM. The existing read-only imperion-social-mcp-stage endpoint, operator worker and publishing system must remain unchanged.

## Platform capability and restrictions

| Trigger | Supported behaviour |
| --- | --- |
| Telegram group member joins | Bot administrator can observe chat_member updates and post one allowed group greeting; not an unsolicited private DM |
| Telegram user sends /start to bot | Private reply is allowed because user initiated conversation |
| WhatsApp ordinary group member joins | Do not scrape members or run unofficial auto-DM; use group description/announcement and an optional website opt-in |
| WhatsApp official Groups API | Separate account eligibility + approval required; not wired here |
| Facebook friend/follower | No automated cold private messaging to a personal profile |
| Facebook Page Messenger inbound | Official Page API on user-initiated conversation, once account permissions are verified |
| Instagram new follower | No general public follow-to-DM API; special Meta-controlled beta/native eligibility must be verified |
| Instagram DM inbound | Reply using authorized Instagram Business Messaging API |
| TikTok new follower | Official FOLLOW_WELCOME through approved TikTok Business Messaging access, if eligible; not a browser scraper |
| YouTube new subscriber | No channel-to-subscriber private messaging API; welcome via content, pinned comment and website |

## Files

- supabase/functions/imperion-welcome-engine/core.mjs: platform policy, Telegram join/start validation, atomic dedupe workflow, provider-readback states.
- supabase/functions/imperion-welcome-engine/security.mjs: webhook secret validation and fail-closed configuration parser.
- supabase/functions/imperion-welcome-engine/index.ts: Deno webhook adapter, default DRY_RUN, official Telegram Bot API sending only after explicit activation.
- ops/imperion-welcome-receipts.sql: APPLIED as Supabase migration 20261104092835 imperion_welcome_receipts_v1; deny-all public RLS verified; pg_cron job #11 ACTIVE (daily 04:00 UTC) for 90-day retention.
- tests/imperion-welcome-engine.test.mjs: offline unit tests; run node --test tests/imperion-welcome-engine.test.mjs.

## Gate before activation

1. Confirm Telegram bot ownership/admin rights, permitted group IDs, language and exact RU/UA message. Group joining is NOT consent to commercial direct messages. Never mix OSVC, Druzina NGO, BrnoWalkers or grants.
2. Set server-side WELCOME_GROUPS_JSON, mapping chat IDs to subject, language, text. RU/UA only for Telegram community. Text must contain the canonical aliaksei-chareshneu.github.io/alchareshneu/ site link; use channel-specific UTM after verifying page/registration.
3. Set server-side WELCOME_PRIVATE_START_JSON to an object with default:{subject,language,text} for user-initiated /start. No automatic private DM on join.
4. COMPLETED: Supabase migration applied; RLS enabled, anon/authenticated SELECT denied, service_role SELECT/INSERT granted; daily 90-day deletion cron active. No name, phone, chat ID, user ID or marketing database persisted. Receipt rows = 0 at readback.
5. Set WELCOME_TELEGRAM_WEBHOOK_SECRET (20+ characters), WELCOME_TELEGRAM_BOT_TOKEN, WELCOME_RECEIPT_PEPPER (24+ characters) in server secrets; never in GitHub.
6. PARTLY COMPLETED: deployed Edge Function v1 to existing Supabase browser-bridge with default WELCOME_ENGINE_MODE=dry-run. Independent HTTP GET returned {service:'imperion-welcome-engine',mode:'dry-run',noMessagesSentByHealth:true}. NO webhook registered. Next: configure secret_token and allowed_updates chat_member/message without taking over another bot's webhook; verify dry-run join and /start.
7. Only after explicit GO, set WELCOME_ENGINE_MODE=live, test one authorized new join and one /start. Verify Telegram provider message_id and independently observe the actual Telegram message. API_ACCEPTED does not imply DELIVERED or READ.
8. Check replay dedupe, opt-out, privacy notices/retention, account permissions and platform compliance before any other adapter is activated.

Risk controls: fail closed on missing config; keep owner-controlled allowlist; no bulk cold messages; no auto-retry after ambiguous send; operational receipt is not a CRM lead. If a person asks to stop, block further communications. No money/spend/publishing changes are authorized by this draft PR.

## 2026-11-04 GO execution readback
- SQL migration: 20261104092835 / imperion_welcome_receipts_v1. Cron: #11 active. Anon/authenticated SELECT=false. Zero real receipt rows.
- Deployed Supabase function imperion-welcome-engine id 4dd82553-e232-4d83-9bbe-fb540e3f8fc3; version 1 ACTIVE with verify_jwt=false; webhook secret comparison enforces authorization, missing secret FAILS CLOSED.
- Independent endpoint GET response confirmed `mode: dry-run`; GET itself never sends messages. No Telegram outbound credential, numeric group IDs, admin rights or webhook confirmed; NO external message sent and no platform delivery evidence.
- Unit tests: 15/15 PASS; includes ignoring bot join updates and preserving SEND_UNCERTAIN on network ambiguity.
- GitHub PR #214 remains DRAFT because site browser-regression workflow 41807810342 fails on an existing unrelated weekly page missing brand-theme/site-design CSS in both main and PR. Do not claim full CI green or merge until resolved, unless independently scoped.
- Security GO: production LIVE prohibited until opt-out/suppression handling for user-specific greeting, secret provisioning, verified Telegram bot/group ownership and actual supervised readback. Do not modify existing Apps Script Telegram webhook or BotFather identity without verifying its current integration.

## Security extension (2026-11-04, v2)
- User-initiated Telegram `/stop` atomically writes hashed per-user/subject suppression; all future group join welcomes and private starts check suppression before sending. `/resume` removes only the same user's/subject's suppression. Both responses are transactional acknowledgments, not marketing.
- `ops/imperion-welcome-suppression.sql` APPLIED as Supabase migration `imperion_welcome_suppressions_v1`; RLS enabled; anon/authenticated SELECT denied; service_role has select/insert/delete. Contains no raw Telegram IDs/names. Opt-out retained until `/resume` so withdrawals remain effective.
- Cloud function redeployed as v2, ACTIVE, default dry-run; independently fetched HTTP health after deployment: mode=dry-run. `index.ts` has fail-closed secret validation, no webhook/token connected. Current LIVE gate remains BOT TOKEN + SECRET in Supabase, verified non-disruptive group admin/Telegram webhook, actual one-message readback.
- Offline Node tests 18/18 PASS. Synthetic SQL smoke inserts duplicate receipt and suppression keys, verifies exactly one of each, deletes both, independently reads zero residual rows in both tables.
- Public site CI browser-regression remains unrelated failed (weekly page missing brand stylesheet on both main and PR); PR stays DRAFT, no merge.
