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
