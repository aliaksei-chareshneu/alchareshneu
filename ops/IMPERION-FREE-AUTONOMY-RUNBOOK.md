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
4. Local Ollama/Qwen as offline option on existing owner hardware; not a cloud 24/7 guarantee. Local `zmrzlina` Qwen3 4B and Qwen3.5 4B pass CPU-mode tests; default GPU CUDA path failed in an earlier readback.
5. On quota failure, queue/retry later or deterministic template, **never silently fall back to paid model**. The router still requires injected durable `reserveQuota`. A **manual-only GitHub Actions proof** now exists (`.github/workflows/imperion-groq-free-draft-smoke.yml`) with serialized GitHub run history as the durable **maximum 2 manual attempts per rolling 24h** reservation. The live Groq `openai/gpt-oss-120b` API draft run #42593552282 succeeded 2026-11-09 (13 offline safety tests; 4,888-character owner-review draft; output ZIP artifact 13662562963). Run #42592827896 produced a truncated 19-character draft and was independently rejected. Groq-specific `reasoning_effort: low`, `max_completion_tokens: 2400`, and incomplete-output rejection corrected the issue. **Not a scheduled 24/7 or CRM-integrated agent; billing/bank readback remains NOT VERIFIED.**
6. Cloudflare `@cf/nvidia/nemotron-3-120b-a12b` is **scheduled for deprecation on 2026-11-20** according to Cloudflare's official 2026-11-05 changelog; do not build a permanent fallback around it. Workers Free has 10,000 Neurons/day, but an authenticated account/API, free-plan rights and budget cap must still be verified before routing. Sources: https://developers.cloudflare.com/changelog/post/2026-11-05-planned-model-deprecations/ and https://developers.cloudflare.com/workers-ai/platform/pricing/

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
