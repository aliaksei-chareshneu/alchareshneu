# IMPERION Welcome Engine — staged extension (04 Nov 2026)

Status: PREPARED / NOT DEPLOYED / NO LIVE MESSAGES. This is a module of existing alchareshneu + Supabase browser-bridge, not a new CRM. The existing read-only imperion-social-mcp-stage endpoint, operator worker and publishing system must remain unchanged.

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
- ops/imperion-welcome-receipts.sql: proposed operational receipt table; NOT APPLIED.
- tests/imperion-welcome-engine.test.mjs: offline unit tests; run node --test tests/imperion-welcome-engine.test.mjs.

## Gate before activation

1. Confirm Telegram bot ownership/admin rights, permitted group IDs, language and exact RU/UA message. Group joining is NOT consent to commercial direct messages. Never mix OSVC, Druzina NGO, BrnoWalkers or grants.
2. Set server-side WELCOME_GROUPS_JSON, mapping chat IDs to subject, language, text. RU/UA only for Telegram community. Text must contain the canonical aliaksei-chareshneu.github.io/alchareshneu/ site link; use channel-specific UTM after verifying page/registration.
3. Set server-side WELCOME_PRIVATE_START_JSON to an object with default:{subject,language,text} for user-initiated /start. No automatic private DM on join.
4. Review SQL, generate a proper migration via Supabase CLI, apply RLS and test API deny/allow, set deletion of expired receipts. No name, phone, chat ID, user ID or marketing database is persisted.
5. Set WELCOME_TELEGRAM_WEBHOOK_SECRET (20+ characters), WELCOME_TELEGRAM_BOT_TOKEN, WELCOME_RECEIPT_PEPPER (24+ characters) in server secrets; never in GitHub.
6. Deploy with WELCOME_ENGINE_MODE=dry-run. For Telegram, use setWebhook with secret_token and allowed_updates chat_member and message. Verify a real join and a /start cause NO sends.
7. Only after explicit GO, set WELCOME_ENGINE_MODE=live, test one authorized new join and one /start. Verify Telegram provider message_id and independently observe the actual Telegram message. API_ACCEPTED does not imply DELIVERED or READ.
8. Check replay dedupe, opt-out, privacy notices/retention, account permissions and platform compliance before any other adapter is activated.

Risk controls: fail closed on missing config; keep owner-controlled allowlist; no bulk cold messages; no auto-retry after ambiguous send; operational receipt is not a CRM lead. If a person asks to stop, block further communications. No money/spend/publishing changes are authorized by this draft PR.
