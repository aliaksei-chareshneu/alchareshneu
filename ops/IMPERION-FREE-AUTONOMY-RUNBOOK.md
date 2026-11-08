# IMPERION — Free-first autonomous operations (implementation runbook)

State: STAGED / DRAFT PR, not fully autonomous or live. Updated 2026-11-03. Zero new payments.

## One architecture, no duplicate CRM

- **Own website / approved public campaign**: existing GitHub Pages `growth-experience`, with canonical events and registration forms.
- **Private intake**: existing `imperion-register`, `imperion-b2b-intake`, `imperion-intake-bridge` Supabase functions.
- **State + events**: existing `browser_jobs`, `operator_commands`, `operator_command_events`, `imperion_rsvp_submissions`, `imperion_b2b_inquiries`; read/write only through server-authorized handlers.
- **Canonical CRM**: existing Community Hub, including `Leads`, `Registrations`, `IMPERION_Agent_Jobs`, `IMPERION_Execution_Receipts`, `IMPERION_Exceptions`, `SocialPublishing`. Use source IDs and idempotency keys, never a second CRM.
- **Orchestrators**: existing GitHub Actions for PUBLIC site refresh/watchdog, existing Apps Script for private imports/snapshots. Verify existing bound script triggers. Optional existing Oracle+n8n worker only after live host/credentials/quota verification; do not invent an instance or deploy a second runtime.
- **Agent library**: existing five read-only agents + existing ShortFactory + new `imperion-free-model-router.cjs` PUBLIC-DRAFT-only. Other specific capabilities must be separate policy-checked adapters, not a broad unrestricted bot.
- **Provider receipts**: source system readback; never equate draft/CI/merged/queued/sent with delivered/accepted/paid/published.

## Explicit permission matrix

| Operation | Unattended default | Approval/readback |
| --- | --- | --- |
| Public source GET, source audit, RSS/website health checks | Yes, bounded and allowlisted | Verified source content hash, time |
| Private CRM import of voluntarily submitted enquiries | Existing authorized workflow only | Unique persisted source ID + CRM row + ACK |
| Free LLM public copy/translation | Only with entity/source/owner/provider approval + atomic daily quota reservation | DRAFT only, owner review, no automatic POST |
| Inbox or messenger support | Existing authenticated connector, narrowly allowed FAQ after written owner approval; otherwise drafts | Channel identity, opt-in, message_id and provider status |
| Sales follow-up | No unsolicited autonomous sends | Full Inbox/SENT history + CRM + opt-out + owner GO + SENT readback |
| Website changes, external promotions | Existing approved PUBLIC campaigns only; new content needs GO | Correct Pages branch and HTTP content hash/permalink |
| Grants and public portals | Research and prefilled drafts, no autonomous final submission | Entity authority, form, attachments, owner GO, submitted receipt |
| Payments, billing, refunds, contracts | Never grant model unrestricted write tokens | Separate verified legal entity/payee, owner GO, merchant/bank receipt |
| Child data, sensitive data | No external free-model routing | Human/legal review, restricted storage and retention |

## Models without Work credits

1. Non-LLM code/templates for source checks, repeat replies and routing: zero inference.
2. Groq `openai/gpt-oss-120b` as primary public-data draft model, only when account has verified free rate limits and no spending path.
3. OpenRouter explicitly selected `:free` model as reserve, with account cap and privacy review. Avoid openrouter/free auto-routing unless destination/provider and data residency policy are known.
4. Local Ollama/Qwen as offline option on existing owner hardware; not a cloud 24/7 guarantee.
5. On quota failure, queue/retry later or deterministic template, **never silently fall back to paid model**. Current router requires an injected durable atomic `reserveQuota`; it is not yet integrated with a production ledger or n8n and cannot call real provider from a GitHub Action.

Quotas published by vendor do not establish account-specific rights. Verify actual dashboard and terms before enabling `*_VERIFIED_FREE_PLAN`; safely store secrets server-side. Keep OSVČ, NGO, grants and personal data in separate authorization scopes.

## Vertical go-live gates (one at a time)

1. **P0 production proof**: incident #196; current watchdog failures include stale campaigns/404. Existing live readback falsely gave CI SUCCESS because shell pipeline swallowed node error. This PR fixes `set -euo pipefail`; test fail-closed regression, merge only after review, then independently check actual Pages HTTP hashes and verify watchdog closes issue.
2. **P0 lead intake**: verify incoming existing form -> existing Supabase row -> existing Hub row -> persisted source ACK -> owner notice. Use authorized synthetic adult fixtures, not customer messages.
3. **P1 draft agent**: verify account billing/free limits + legal data policy + durable reservations, run first-party PUBLIC task -> draft -> manual approval; validate token spend remains zero.
4. **P1 messaging**: existing Telegram/WA/IG official paths and rights inventory, business chat opt-in, pure deterministic FAQ first. Verify provider message ID and channel, no group/personal bypass.
5. **P1 payments**: verify payee identity and legal contract, connect read-only merchant status / bank reconciliation where permitted, never infer bank receipt from email payout notice.
6. **P2 grants, invoices, media, social, browser jobs**: only one narrow adapter at a time, with readback and human gate for commitments.

## Recovery and metrics

- A duplicate source_id/job id is rejected; no retry if provider status ambiguous until reconciled.
- Every job has legal entity, capability, source timestamp, consent, owner, deadline, cost ceiling, desired effect and evidence requirement.
- Status: `READY` -> `APPROVAL_REQUIRED` -> `EXECUTING` -> `PROVIDER_ACCEPTED` -> `INDEPENDENTLY_VERIFIED` or `BLOCKED`; `PAID` requires bank receipt.
- KPI: website visits -> inquiries -> qualified opportunities -> signed paid scope -> invoices -> bank-cleared Kč; plus owner time, error count and zero unapproved charges.
- Do not turn chat-based planning into live status; production health must be verified from actual public HTTP and server-specific receipts.


## Growth Department #3 → Sales #4: staging contract, 08 November 2026

This extends the existing five-function operator, NOT a second CRM, paid vendor, or a sixth marketing agent. The owner may later use the existing Chief function as COO #6. The new private adapter `ops/imperion-growth-policy.cjs` consumes the existing Community Hub owner-bound snapshot, selects live-source candidates, audits post duplicates and rights, evaluates a finite **standing GO** policy, and classifies **synthetic or provider-verified** public comments. All current outputs remain **READ_ONLY / DRAFT**.

**Current real pilot:** `PUB-OREL-20261114` has `Events.Status=Active`, 14 November 2026 at 12:00–14:30, Orlovna Husovice, 0 Kč, published registration landing page. On 08 November the Hub `RSVP_Total_Recorded=45` and `RSVP_Confirmed_Yes=5`; 16 previous written seat promises are in the existing safety reconciliation, but a safe numeric active-person maximum is still **NOT VERIFIED**. `Active` in Hub is NOT independent venue/safety/seat approval. Do not advertise open places, auto-enrol, tell people to travel without confirmation or republish old FB content.

**Standing GO, future-only, per exact owned account:** Private, owner-signed policy must specify owner, legal entity (OSVČ / BrnoWalkers OSVČ / Družina Moravy z.s.), exact provider account ID, platform, content types, languages, `valid_from`/`valid_until` (maximum 31 days per approval), conservative maximum publications in 24h, explicit status ACTIVE, revision/approval receipt, kill switch, revocation, zero monetary spend, privacy/child/media rights and grant attribution. Missing or stale approval means DENY. Publishing adapter must additionally verify at execution time: canonical dates/prices/venue and capacity, consent, actual native permission, public CTA/form test, last 72h platform history/duplicate reconciliation, provider quota and exact campaign legal entity. A model-written `owner_authority_verified` field is NOT proof of authorization; adapter must validate it in an independent owner-bound ledger before it is trusted. Runbook policy only; **no ACTIVE grant has been issued by this change.**

**Physical boundaries:** Growth can *discover, prepare, schedule suggestions and classify* without sending. Only future owner-authorized official adapters can publish/answer. No personal FB/group/WA posting through undocumented APIs. First FB organic comment link must be possible and verified for each specific channel. After uncertain or pending provider status, never retry until source readback. A publish success requires platform post ID + public permalink + correct first comment (where applicable) + linked form test; a model `PASS` or GitHub CI is not a post.

**Comments to #4:** Public FAQ may use checked public facts only within owner-approved reply scope, never invent availability/price/insurance. Individual booking, price negotiation, payment, personal details, complaints and consent withdrawal route to existing #4 inbox/intake. The route envelope carries source platform, verified post permalink, immutable comment ID hash and action reason, NOT full personal comment text. Deduplicate using `SOCIAL-<hash>`; do not create CRM Leads without lawful original voluntary enquiry, confirmed submission and source receipt. No automatic DM or payment obligation.

**Telemetry:** existing `SocialPublishing` + `IMPERION_Execution_Receipts` for media/post provider readback; existing `Leads`/intake and revenue/bank records for actual conversion; measure all founder and rendering minutes, clean banked personal OSVČ net vs independent z.s. grants. Views and clicks are diagnostic, not CASH. No new CRM or parallel queue.

**Triggers:** existing public GitHub watchdog hourly for public Pages checks only; existing `09 · Growth Studio + CEO` automation M/W/F for bounded marketing review. Neither is a private high-frequency post-publishing runtime. A 1–2h PRIVATE Calendar/Drive/CRM campaign monitor is STAGED pending verified existing owner-bound Apps Script trigger/webhook, provider free quotas and a nonduplicating idempotency ledger; no new live triggers or subscriptions from this PR.

**Fail-closed QA:** `node --test tests/imperion-growth-policy.test.cjs` on synthetic 14 Nov record: event discovery, ACTIVE status independent confirmation gate, duplicates/unsettled providers, kill switch, wrong account, quota unknown, privacy/cost, safe FAQ and #4 handoff without PII. Does **not** simulate actual external posting, read a real comment, or prove provider delivery. Exit criterion: a separate owner GO + independently verified actual scheduled trigger → approved media → permitted channel API → permalink + CTA verification → genuine opt-in CRM handoff → order and bank receipts; until then state **STAGED / NOT LIVE**.
