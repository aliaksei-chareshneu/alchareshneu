# P0 Agent4 Telegram Chat Automation - Pasha pilot

Case_ID: IMP-SOCIAL-SALES-PASHA-20261115.
Owner: existing Agent4 (OSVC, or explicitly selected Druzina Moravy z.s. controller).
Budget: 0 Kc additional.
Test chat: Pasha - exact numeric peer to be verified, not matched by the display name.
External send GO: NOT GRANTED. Automatic personal sends: OFF.
State: CODE ON BRANCH. CI does not demonstrate deployment to OCI.

## Deployment to the existing single OCI consumer

1. Verify only the existing OCI imperion-agent4-telegram.service owns Telegram long polling. Do not start a second getUpdates poller. The disabled Windows TelegramSales-Official remains disabled.
2. Using the existing credential without printing it, verify Telegram getMe reports can_connect_to_business and that no webhook currently owns the bot. Confirm Secretary Mode for the existing bot through the owner's Telegram settings.
3. Back up the current OCI listener, its SQLite and local Windows mirror. Independently compare deployed agent4_telegram.py to the reviewed 15 November local version. STOP if any anchor changed.
4. Use the source installer in ops/install-agent4-chat-automation.py in dry-run against the actual listener. Only with technical GO, apply to this same service and verify hashes. The installer changes source and creates backup; it never restarts a process or sends messages.
5. Compile, run unit tests, stop/restart only this ONE existing OCI service, then verify the updated allowed_updates includes business_connection, business_message, edited_business_message and deleted_business_messages, in addition to the old message type. Do not call getUpdates from any other consumer.
6. Telegram Chat Automation UI must show Only Selected Chats and one intended Pasha chat. The local permission MUST NOT be inferred from the displayed name. If connection event was missed because it preceded subscription, safely reconnect the existing bot after deployment to deliver a new official connection update.
7. Preserve owner-proof settings: agent4_owner_test_peer_sha256 must match SHA256 of the true Telegram account ID from the prior verified owner self-test. Unknown connection owners are rejected.
8. Telegram UI selection is owner permission, NOT consent by Pasha. The counterpart must know the purpose, local AI use, retention, opt-out and processing terms, and explicitly consent before storage/AI processing. No chat text is exported to GitHub, Supabase or third-party AI.
9. Only then, in existing private SQLite (not GitHub), set per-connection/peer keys:
    agent4_biz_controller:<connection SHA256 prefix>:<numeric peer> = OSVC or DRUZINA_MORAVY_ZS;
    agent4_biz_consent:<connection SHA256 prefix>:<numeric peer> = AFFIRMATIVE;
    agent4_biz_optout:<connection SHA256 prefix>:<numeric peer> = 0;
    agent4_biz_test_peer_sha256 = SHA256 of pilot numeric peer.
10. Confirm one inbound pilot update, same-source dedup, local DRAFT_ONLY job, and no send. Mark it OWNER_SELFTEST_ONLY, not a paying customer. Check the old bot inbound path still works. Never include personal messages in GitHub Actions logs.

## Separate approval needed for outbound E2E

The technical GO does not authorize sending to Pasha. A single outgoing test requires an additional exact recipient+draft GO, explicit selftest-send flag, recent inbound message (under 24h), connection rights can_reply, local scope, consent, opt-out recheck, API message_id readback, and reconciliation if acceptance is uncertain. No blind retries.

## CRM blocker that must not be concealed

Existing five-minute Supabase helper validates direct bot /start via agent4_tg_controller:<peer>; personal Chat Automation jobs do not necessarily have that bot /start evidence. Their CRM transport is held by design, until the protected source-specific business consent/transport branch is integrated and verified. Do not synthesize /start, customer records, or payment statuses. The Pasha pilot must not create a purchased-service lead.

The free OCI service can listen with the home PC offline, but Ollama Qwen 3.5 4B CPU and the existing Windows CRM transport require the PC. Groq GPT-OSS120B is public/synthetic-only and must never receive unapproved private chat content. Telegram Bot API cannot read arbitrary old personal chat histories; retained permitted incoming messages only.

## Rollback

Stop only the existing OCI service; restore backed-up source and private SQLite if needed; remove newly added adapter if no longer required; restart the original existing poller DRAFT_ONLY; verify bot heartbeat and ordinary message intake. No new webhook, bot, CRM, paid service or subscription.

Official references:
https://core.telegram.org/bots/api
https://core.telegram.org/bots/features
https://telegram.org/faq
https://telegram.org/tos/bot-developers
