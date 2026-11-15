## M10 — source v6 deployed and zero-spend account probe (15 Nov 2026)

- **Deployed:** existing Supabase `imperion-free-inference` version **6**, ACTIVE, JWT verification and service-role auth preserved, v5 original code backed up under `gateway/rollback-v5/`.
- **New capability:** `runAndVerifyCloudPC()` wraps the restricted external model route, one existing queue job, then at most five bounded read-only receipt polls. Only an independent nested `status=DONE` for the exact allowlisted mode and one attempt yields `VERIFIED_DONE`. A slow Windows worker yields `QUEUED_PENDING` with the same job ID, no automatic retries. Offline CI on candidate v6 SUCCESS https://github.com/aliaksei-chareshneu/alchareshneu/actions/runs/43742201396, latest staging CI also SUCCESS https://github.com/aliaksei-chareshneu/alchareshneu/actions/runs/43742255362.
- **Postdeploy Windows regression:** existing queue case `08ffa19e-d995-4a34-8a73-c20eae680e95` machine_readiness `state=done`, `attempts=1`, nested `DONE`, `agent=IMPERION_AGENT5_RESTRICTED`, snapshot free RAM 542 MB. This is **ChatGPT-cloud -> PC**, not external model -> PC.
- **Verified API access (one-time isolated no-billable-inference GitHub job):** Groq existing `GROQ_API_KEY` authenticated at `GET /openai/v1/models`, `openai/gpt-oss-120b` available. OpenRouter GitHub secret **NOT CONFIGURED**; Supabase service-role GitHub secret **NOT CONFIGURED**, so the separate GitHub client cannot invoke the private v6 HTTP receipt API. Groq account-specific **Free vs Developer billing not proven**: rate-limit model-list GET did not report usable plan evidence. No token-generating provider call made. One-time probe jobs removed from CI after recording outcomes; secrets never printed.
- **Unverified:** server-side provider secrets/free entitlement on Supabase, real headless Nemotron/Groq model call, private JWT HTTP receipt invocation, Windows live GUI Notepad and reboot recovery. The running Windows Bridge still has a stale adapter and Remote Desktop Commander was quota-blocked. Zero new billed model inference was authorized or performed.

**Important:** model API key authenticated != billing tier Free. Do not change the free-only flags or trigger model inference on a possibly paid account before verifying the organization's tier through the provider's Billing UI/primary source. NVIDIA `:free` endpoints cannot receive private Windows data. New M10 code remains strict SYNTHETIC_ONLY and only two read-only PC intents.

# Agent #5 — cloud-first, no-new-spend control plane (15 Nov 2026)

**Canonical worker:** existing Windows `zmrzlina` / BrowserBridge / Supabase `public.browser_jobs`. Do not start a second Windows agent or expose a listening desktop port.

## Evidence / milestones

- **LIVE:** this ChatGPT cloud turn -> Supabase `browser_jobs` -> existing Windows `pc_operator` -> independent nested readback. Jobs:
  - `db775880-4fd3-4a31-8429-a93f5e45d9b2`, `machine_readiness`: queue `done`, nested `DONE`, one attempt, 553 MB available at that snapshot.
  - `bae95aed-9810-4e1d-b179-8ea1e57d7046`, `model_capabilities`: queue `done`, nested `DONE`, one attempt; old loaded worker still reports local `imperion-qwen35:4b`.
- **DEPLOYED SOURCE:** existing Supabase `imperion-free-inference` version 3, `ACTIVE`, `verify_jwt=true`, same service-role auth and legacy `PUBLIC/SYNTHETIC` draft route preserved. This does NOT prove a Groq/OpenRouter provider call.
- **CODE TESTS:** `pc5-cloud-core.test.mjs` fixture tests pass; Agent5 GitHub PR #237 CI with gateway JS syntax check PASS.
- **BLOCKED / UNVERIFIED:** currently running BrowserBridge has stale adapter, physical owner Notepad GUI E2E is unverified, and remote Desktop Commander tool hit its monthly usage limit. The new Windows source-installed modes do not become LIVE just because GitHub and disk are updated. Do not restart shared worker or close user apps without safe preflight.
- **CLOUD MODEL INFERENCE:** no verified successful call through the deployed Supabase v3 gateway; server-side provider-key / free-plan flags and quotas have not been read back. No paid model fallback authorized.

## Model routing

1. If and only if the **server-side** `OPENROUTER_API_KEY`, `IMPERION_OPENROUTER_FREE_VERIFIED=1` and `OPENROUTER_FREE_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free` are configured, use that exact `:free` candidate for **fixed synthetic text only**. NVIDIA's free terms disallow confidential/personal inputs.
2. Otherwise, if and only if server-side `GROQ_API_KEY` and `IMPERION_GROQ_FREE_VERIFIED=1` are configured, use Groq `openai/gpt-oss-120b` for **fixed synthetic text only**.
3. Otherwise return `BLOCKED`, with no provider call, no queue job and no new spending.

Qwen3.5 4B stays installed as **optional local, memory-gated synthetic-only fallback**. It is NOT the primary planner and requires at least 5120 MB free RAM for its existing experimental path.

## Trusted server-only invocation

Only an already-trusted server caller holding the existing Supabase service-role credential may POST to `imperion-free-inference`; never copy that credential to Windows, ChatGPT messages, CI logs or browser JS.

The new request is intentionally fixed and contains no arbitrary user prompt, paths, screenshots or customer content:

```json
{"kind":"pc5_synthetic_readonly","classification":"SYNTHETIC","case_id":"A5-CLOUD-20261115-001","intent":"readiness"}
```

`intent` may be `readiness` (a read-only memory snapshot) or `models` (read-only installed model metadata). Case ID must be unique. A verified free provider must return exact JSON for that one fixed scope; the **server**, not the model, decides the allowlisted queue payload. There is a **three-attempt-per-rolling-day** quota based on existing idempotency receipts, and each case is reserved **before** inference. Reservation remains cancelled on failure; no automatic retry.

Cloud function's `QUEUED_NOT_EXECUTED` / HTTP 202 proves only queue insertion. Query `public.browser_jobs` by returned job ID; accept success only when `state='done'`, `attempts=1`, and nested `result.result.status='DONE'`. If the nested result is blocked, mark `BLOCKED`, not LIVE.

## Scope and rollback

No arbitrary terminal or shell, GUI clicks, process termination, payment, publishing, client messages, private screenshots, Windows service restart or browsing new websites. The model is advisory, never a source of authority.

The last working v2 gateway is preserved at `gateway/rollback-v2/{index.mjs,free-core.mjs}`. To rollback, use an authorized Supabase deployment of **those exact two files** with `verify_jwt=true`, followed by `get_edge_function` source/version readback. No second service.

**Next acceptance:** verify provider free flags through an authorized server-side test and its usage/charge receipt; restart existing BrowserBridge only after idle-queue, RAM and owner work checks; run one user-confirmed synthetic GUI E2E and read back the exact file hash independently. Until then: cloud v3 DEPLOYED, fixed cloud->PC command LIVE, standalone headless inference and Windows GUI NOT YET VERIFIED.


## M9 gateway v5 hardening and verification

- **DEPLOYED and independently fetched:** Supabase `imperion-free-inference` ACTIVE **v5**, JWT required, existing server-role authorization preserved; old public/synthetic drafting still in place.
- **Closed-loop receipt API:** trusted server-side caller may POST `{"kind":"pc5_receipt","classification":"SYNTHETIC","case_id":"A5-CLOUD-20261115-002"}`; response is status-only. It checks exact case ID, queue action, allowed mode, one attempt, expected agent, nested application `DONE`; it never returns file contents, Windows process paths or arbitrary text. Gateway code and mock tests PASS, but direct HTTP invocation from a trusted caller is NOT YET VERIFIED.
- **Provider-key isolation:** v5 no longer passes `SUPABASE_SERVICE_ROLE_KEY` or unrelated server secrets to the model-provider helper. New CI regression test enforces an exact five-key provider-only environment. **No evidence of a previous leak**.
- **Additional live Windows job** `79745ec2-54e4-4f0d-9af7-00728b7e9590`: `machine_readiness`, queue done, exactly 1 attempt, nested DONE, worker identity verified, 1710 MB RAM snapshot. This proves GPT-6-in-chat -> Supabase -> Windows. It does NOT prove the headless external model ran.
- **Stale worker proof:** job `41e3eb3c-fb87-4b18-9e01-9620e5f11aa6` returned queue done, nested `BLOCKED MODE_NOT_ALLOWED` for `runtime_probe`. New Windows adapter still not loaded into the running worker.
- Previous **v4** and **v3/v2** deployed server files are stored under `gateway/rollback-v4/`, `rollback-v3/`, `rollback-v2/`, with `verify_jwt=true` required on rollback.
- Latest free visual model candidate `nvidia/nemotron-3.5-super-vl:free` was published 15 Oct 2026. Never send a user's actual Windows screen, private files, face, messages, credentials or personal data to NVIDIA's free endpoint.
- No paid API, GUI input, app termination, unsafe process restart or automatic publication performed.

**Remaining gates:** live provider invocation with exact account-specific free entitlement and external zero-charge proof; authenticated server call of the v5 receipt API; existing BrowserBridge safe reload; physical owner consent + actual Notepad GUI + independent disk receipt; more app-scoped drivers only after that. Full original specification remains PARTIAL.
