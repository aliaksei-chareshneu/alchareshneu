# IMPERION Agent #5 — original specification vs verified acceptance
Date: 2026-11-15 (Europe/Prague). Machine: zmrzlina.
Owner: OSVČ. New spend authorization: 0 Kč. This is an acceptance ledger, not a new agent or CRM.

## Original specification (8 November 2026, Project 80)
A real Windows PC operator for zmrzlina: receive owner tasks including from mobile through existing infrastructure; control allowed applications, browser, files and documents; inspect and optimize Windows/services; plan using the best available legal/free model; act with least privilege; check results independently; log, report and recover. No new server/queue/CRM. No unrestricted shell or secrets. Deletion, payments, posting, credentials, production settings and permission expansion require separately scoped GO; no bypassing CAPTCHA/2FA or disabling Defender.

## Acceptance matrix

| Capability | Evidence-based status | Acceptance test / remaining gate |
|---|---|---|
| Cloud task intake -> existing Supabase -> zmrzlina | **LIVE (restricted)** | Real job `79745ec2-54e4-4f0d-9af7-00728b7e9590`: queue done, attempts=1, executor=IMPERION_AGENT5_RESTRICTED, nested result DONE, mode=machine_readiness |
| Scratch TXT/CSV import, inspect, deterministic transformation | **LIVE (restricted)** | Prior cloud synthetic import and local readback SHA verified; no private files |
| System/application read-only inspection | **LIVE (restricted)** | Fresh machine_readiness readback DONE; app status and fixed catalog previously tested |
| Windows full audit (startup/Defender/disks/services) | **SOURCE INSTALLED, NOT CLOUD LIVE** | M6 local readback blocked when RAM <1024 MB; running BrowserBridge has stale adapter |
| Lightweight system audit | **LOCAL DONE, CLOUD NOT LIVE** | Local `audit_light` readback confirmed; cloud route blocked MODE_NOT_ALLOWED before worker reload |
| Actual cleanup/startup/service changes | **NOT LIVE** | Review-only dry-run, separate owner GO and rollback for every exact change |
| Local Notepad GUI mouse/keyboard | **SOURCE INSTALLED, GUI E2E UNVERIFIED** | Owner one-time physical YES, GUI driver run, independent file+approval+receipt SHA readback, shared worker version proof |
| General Word/Excel/browser/program GUI operations | **NOT LIVE** | Need separately allowlisted, reviewed drivers, consent, same active desktop, privacy-safe observations and real E2E; no general remote shell |
| Planning with best free cloud model | **GATEWAY v4 ACTIVE, PROVIDER INFERENCE UNVERIFIED** | Nemotron 3 Ultra free -> Groq GPT-OSS120B free only after server-side key, provider plan, quota and independent model response verified |
| Synthetic GUI visual planning | **CATALOG ONLY, NOT LIVE** | Nemotron 3.5 Super VL free candidate verified publicly. NVIDIA free endpoint disallows confidential/personal screen images, so no personal screenshots ever sent |
| Paid flagship API (OpenAI GPT-6 Astra) | **NOT AUTHORIZED** | Strongest published API candidate, but explicit new budget and data-processing authorization are required. No automatic paid fallback |
| Autonomous recovery after Windows reboot | **NOT VERIFIED** | Test single existing BrowserBridge worker after reboot without duplicate process, then read heartbeat/generation and job result; no unattended reboot |
| Owner-only approvals and privacy | **SOURCE + OFFLINE TESTS PASS** | Spoofed remote GO blocked; exact local physical approval consumed once; no keys in Windows code/PR; no private data to free providers |
| Independent nested readback | **CLOUD GATEWAY v4 DEPLOYED and MOCK CI PASS** | JWT+service role; exact case ID, action, app mode, attempt count and nested DONE; live read-only queue query verified independently |
| Primary operational model using ChatGPT's GPT-6 in THIS conversation | **INTERACTIVE LIVE** | ChatGPT here has operated allowed Windows probes through Supabase; not a 24/7 external headless model |
| Permanent autonomous headless model worker | **NOT VERIFIED / BLOCKED** | Groq/OpenRouter account-specific free flags, live response, and authorized recurring caller not independently verified. No new background worker |

## Source and immutable-ish proofs

- Existing PR: https://github.com/aliaksei-chareshneu/alchareshneu/pull/237 (DRAFT; deliberately not merged).
- Existing gateway: Supabase project `cmrknyhnnehyjpreehcf`, function `imperion-free-inference` ACTIVE v4 `verify_jwt=true`. Prior v2/v3 code retained at `ops/pc-agent/cloud/gateway/rollback-v2/` and `rollback-v3/` and v4 at `rollback-v4/`.
- Existing BrowserBridge queue: `public.browser_jobs`; never trust `state=done` alone, require nested app status and exact mode.
- Windows low-memory observations in this work include ~233–2694MB free; no safe model/GUI inference can be presumed from a single observation.
- Desktop Commander account quota was exhausted in this session. No attempt was made to bypass quota, restart worker or control desktop windows.
- For the full original specification, `DRAFT/SOURCE INSTALLED` is **not** `LIVE`.

## Next safe acceptance gates (not scripts that self-execute)

1. From a trusted authenticated server (not Windows), check provider free-plan flags and run one SYNTHETIC_ONLY model response with 0 Kč new spend. Confirm exact model ID, timestamp, zero billable charge and request receipt. If no model entitlement, **BLOCKED**, never auto-upgrade.
2. On zmrzlina, only with sufficient sustained RAM and shared-queue idle, reload the **same** BrowserBridge worker once (not another daemon). Confirm fresh heartbeat plus `runtime_probe` nested DONE `generation=M7-20261115`, then `audit_light` nested DONE. Never kill other work.
3. Only by local physical owner approval, run `IMPERION-PC5-Notepad-Approve.cmd` exactly once on synthetic Notepad, then independent `pc5_gui_readback.py`; log exact hashes. Expand other apps only after each narrow tested driver and separate data-specific GO.

## Operational invariant

MODEL_PLAN != PERMISSION. QUEUED != EXECUTED. state=done != application DONE. CI PASS != WINDOWS LIVE. USER CLICK != PRIVATE DATA EXPORT CONSENT. API MODEL SUPPORT != VERIFIED FREE ACCOUNT ENTITLEMENT. Do not mark this project fully done until the explicit acceptance gates above have independent receipts.
