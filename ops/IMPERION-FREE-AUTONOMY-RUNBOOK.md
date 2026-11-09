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

## 2026-11-05 — Local models, B2B and publishing acceptance snapshot

This dated section records a VERIFIED readback of existing systems, not autonomous deployment. The repo remains the code source, Hub remains the only operational CRM, and no new external paid service is authorized.

### Device and model inventory (owner PC zmrzlina)

- Hardware readback: RTX 3060 Laptop with 6 GiB VRAM; 16 GiB system RAM; >300 GiB free on C: at inspection.
- Ollama 0.40.14; prior qwen3:4b retained (2.5 GB).
- Imported imperion-qwen35:4b (Qwen3.5 4B Q4_K_M, approx. 2.8 GB) from SoAIHQ/Qwen3.5-4B-GGUF using the existing Ollama; external GGUF SHA256 matched publisher SHA256SUMS: 2ebe6eb67cb92adeffc7073c48dd4e3baf79465ac650793dc751cad2b29cf219.
- Official Ollama registry pull stalled at manifest; fallback import succeeded. No driver changes, model deletion, service restart or subscription.
- Current Ollama logs show CUDA error "device kernel image is invalid"; local tests explicitly request num_gpu=0 until the underlying cause is investigated. GPU-speed claims are NOT verified.
- Same four synthetic tasks: qwen3:4b 4/4 formal checks (but unnatural Czech social language); imperion-qwen35:4b 3/4 (invented age/capacity facts in a social draft). No model is approved for autonomous social publication.
- Reproducible local script: ops/imperion-local-model-eval.cjs. Tiny local context 4096 is a resource choice, not the model's maximum advertised context.

### Approved routing boundary (no new CRM, no parallel publisher)

- PUBLIC_TRANSLATION_DRAFT from the fixed first-party URL allowlist: optional imperion-qwen35:4b via the existing ops/imperion-free-model-router.cjs. Explicit local-enable flag; loopback-only endpoint, CPU fallback, durable atomic reserveQuota required, owner review; produces a DRAFT, never an action.
- PUBLIC_COPY_DRAFT and PUBLIC_FACT_REVIEW: local 4B is deliberately blocked as a sole publisher/fact authority. Groq/OpenRouter free adapter stays conditional on verified credentials, limits and lawful public-only data; never automatic paid fallback.
- Private mail, B2B lead follow-up, minor data and real CRM: no external free-model forwarding. Deterministic source checks, history/opt-out and owner approval remain mandatory.
- High-stakes strategy and code: interactive available strong model and Codex/CI, not an assumed free unattended API.
- Social production: OWN ShortFactory -> existing SocialPublishing -> approved direct platform adapter -> provider permalink/readback. Metricool only opportunistic reserve because the 20-post plan cap is operationally unusable for monthly volume.
- Existing Code.gs contains Telegram Bot API and Facebook Pages Graph API paths, but deployed owner-bound Apps Script permissions/trigger and successful publication are not verified. Current Facebook event post builder includes a link IN the post: violates the current first-comment-link instruction; never enable without change/review.

### Live readbacks and release gates

- Public /corporate/, /corporate/request/ and /autopilot/feed.json: HTTP 200 from owner PC on Nov 5. Existing Supabase OSVC B2B intake GET: HTTP 200, accepting:true, bookingConfirmed:false, paymentCollected:false.
- Supabase browser-bridge ACTIVE_HEALTHY; imperion-b2b-intake v3, imperion-intake-bridge v4, Deal Hunter v2 ACTIVE. Existing imperion_b2b_inquiries: 0; public opportunity candidates: 61, all REVIEW_UNCOSTED; 7 candidate rows show CRM sync. Not 61 accepted paid leads.
- Important live mismatch: intake-bridge v4 excludes MEDIA_SPONSOR from B2B pending reads, documenting concern that the deployed bound GAS importer does not support that offer. GitHub main imperion-intake-sync.gs NOW contains a MEDIA_SPONSOR mapping, but that does not prove the actual bound script deployed. Before removing the filter, verify owner-bound Apps Script source, access rights, tests and rollback.
- Source-only B2B/Candidate/LLM tests on this branch: 32/32 PASS, synthetic only. REAL form submit -> private row -> CRM row -> owner notice and provider readback is NOT YET ATTESTED. No outbound email, post, CRM mutation, new payment, production Edge redeploy or site merge in this activity.
- Work in feature/imperion-free-ai-local-20261105 from current origin/main. This is a review branch until explicit release approval. New router local option is not installed in any 24/7 worker; PC availability is optional, never a prerequisite for cloud intake.

NEXT (existing cases, no duplicates): #195 source-to-CRM B2B proof, #196 public-site watchdog reconciliation; after owner approval, one direct-platform publisher with independent permalink readback. Avoid production replays or migrations until source/permissions are checked.

## 2026-11-09 — Groq/Qwen reconciliation in existing PR #221

- Refreshed the existing `feature/imperion-free-ai-local-20261105` review branch against current `main` instead of creating another router/PR. Preserved the working Groq GPT-OSS 120B settings: `reasoning_effort: low`, `max_completion_tokens: 2400`, `include_reasoning: false`, and a fail-closed check for truncated outputs.
- For explicitly approved `PUBLIC_TRANSLATION_DRAFT` only, a 429 from verified-free Groq can fall back to loopback Ollama `imperion-qwen35:4b` with `num_gpu: 0` and no authorization header to localhost. Fixed first-party public-source allowlist, no customer/child data, no send/post/payment actions. Local output remains owner-review DRAFT.
- Provenance sanity tests block unsupported numeric claims and public URLs; they are not proof of factual correctness. The original small model's invented age/capacity claims remain a release blocker for automatic publication.
- Local tests on zmrzlina on 2026-11-09: **24/24 PASS** for model router and public workflow gates, including the synthetic Groq-429 -> Qwen fallback and GPT-OSS clipped-output rejection. This is a mocked fallback test, **not** a live Groq-429 incident.
- Live local smoke attempt on zmrzlina (2026-11-09, owner-approved first-party corporate page, local Ollama CPU): the `imperion-qwen35:4b` model was loaded but no accepted output returned before the 90-second API timeout; adapter readback was `BLOCKED`, failure `ollama_local:NETWORK_OR_PARSE`, runtime 93.77s. This **does not** pass production fallback acceptance; no private data, messages or publication occurred. Recheck local prompt-size/CPU latency and source connectivity before enabling.
- Second real adapter smoke, strictly synthetic PUBLIC fixture (same allowlisted source ID but GET content simulated locally): `DRAFT_FOR_OWNER_REVIEW` via `ollama_local` after **23.44s**, owner approval true, 0 sends/posts. This proves the actual local API adapter can generate a small translation, **not** that large live source pages or cloud failover work. Direct tiny Ollama prompt separately succeeded after 14.22s. The one-off diagnostic script was removed after test.
- GitHub PR #221 at merge commit `b39edbd4822d6f75fe2890c990f5c10e1c9df0c4`, existing branch pushed and read back `mergeable=true`, still `draft=true`, `merged=false`. Site quality CI run #42607412584 passed `static-checks` but failed `browser-regression` (26 page/UI tests: brand styles, Druzina mobile positioning). Those website files were not changed by the model-router PR diff; CI remains FAILED and no production merge is justified.
- Existing GitHub Actions Groq direct API test #42593552282 is separately verified successful; this PR does not change the existing manually dispatched smoke or enable scheduled external inference.
- **NOT DONE / gates:** Groq Billing and free-plan spend rights independent readback; provider credential/budget for Cloudflare or OpenRouter; durable on-device quota reservation for automated use; cloud-to-PC secure transport; end-to-end CRM receipts and unattended production dispatch. No automatic agent 24/7 is claimed. No new paid subscription, customer messaging or publication authorized.

## 2026-11-09 evening — bounded local fallback + historic CI reconciliation (draft-only)

- The model router now keeps the FULL first-party public source SHA256 and a bounded 1,400-character stripped MAIN-content excerpt solely for CPU-local public translation. All active/script/style tags are excluded from the prompt; Groq's successful low-reasoning budget remains unchanged. Output URL/numeric provenance is cross-checked against the approved source excerpt plus the original safe prefix. This is a heuristic review gate, not proof that claims are true.
- Existing site QA had 26 unrelated failures when PR #221 was rebased: tests expected four customer cards but public /start/ now has five, tests were temporarily changed to expect generic /register/ but the actual approved Druzina fast-visit CTA correctly retains specialist /druzina/prihlaska/ (restored), 9 November meeting-only banner obscured mobile CTA, and seven digital-store pages omitted common versioned dark theme styles. Updated check expectations to actual approved public routes, moved CTA nearer the top, retired the dated 9 November banner in draft code and normalized store theme; no public deploy or change of prices.
- QA correction: the original Windows Playwright configuration allowed reuse of an unrelated existing port-8000 server. The reported 40/40 PASS measured that running server and must NOT be treated as independent proof of this PR's actual HTML. GitHub CI #42687384793 served the branch in isolation: 345/349 PASS, 4 failures solely because an incorrect test expected generic /register/ instead of actual /druzina/prihlaska/. Reverted that erroneous expectation, then verified the FOUR failing multilingual CTA tests against an ISOLATED local server on port 8337 with reuseExistingServer=false: 4/4 PASS. Authoritative full CI readback after push required. Model-router tests 21/21 PASS, including bounded HTML context, fail-closed policy, synthetic HTTP 429 and GPT-OSS truncation detection.
- Reproducible manual script scripts/imperion-local-fallback-smoke.cjs with explicit --public-fallback-diagnostic flag: simulated Groq 429 at transport layer (NO Groq network or credentials), then REAL localhost Ollama `imperion-qwen35:4b` responding on a first-party corporate HTML repository fixture. 2026-11-09 19:49:14 UTC, elapsed 51,538ms, 673-character review draft, status DRAFT_FOR_OWNER_REVIEW, 0 sends/posts/payments. This proves the local API fallback works on a bounded public fixture, NOT an actual Groq outage or independent live-source HTTP retrieval.
- All changes are in review branch/PR #221. No merge or live CI PASS claim before provider check. This is not an unattended 24/7 agent. Groq provider billing/free-plan entitlement still NOT VERIFIED. Cloudflare Nemotron 120B slated for retirement 2026-11-20; no separate paid/expired reserve was enabled.

## 2026-11-09 owner Groq evidence + durable local quota stage

- Owner-supplied Groq screenshots image(20261109-201807).png + image(20261109-201809).png visually show Personal / Default Project: November 2026 Usage Cost **Total Spend $0.00 USD**, and Organization Billing **Free ($0), Current Plan**. Screenshot evidence only, not an independently authenticated provider login; other projects, all-time spend and future status are not proven. The older "Groq tier unknown" blocker above is resolved at screenshot scope.
- Groq official rate-limit docs describe org limits and 429 fail-closed behavior; current actual project limits must be checked before high-volume autonomous use. Free plan does not provide paid-only automatic Spend Limits; **do not upgrade** to obtain those.
- Added optional local-only `ops/imperion-free-local-quota.cjs` for existing public-DRAFT model router's injected `reserveQuota` callback: trusted on-device absolute path, mkdir mutex (stale lock BLOCKS), durable per-day/provider/model receipt files and per-job dedupe using SHA-256, atomic exclusive creation and fsync, cap 600 per provider/day; on errors or contention no provider call. No credentials or private fields written. Does **not** run automatically and is **not** a shared cloud quota.
- Unit tests and mocked router integration on zmrzlina: 28/28 PASS including concurrency, restart, duplicate, daily limit, stale lock, Groq->Qwen separate provider reservations and same-job second call blocked without model invocation. Test data synthetic; no new Groq API use, payment or client messages.
- **RELEASE STILL BLOCKED:** secure cloud-to-PC transport and owner-approved worker invocation, org-level account rate-limit readback, production atomic reservations shared across all workers, end-to-end canonical CRM receipt and explicit publication/deployment GO. Do not treat this as unattended 24/7 readiness.



