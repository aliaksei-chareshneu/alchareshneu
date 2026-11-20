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
| Planning with best free cloud model | **GATEWAY v5 ACTIVE, PROVIDER INFERENCE UNVERIFIED** | Nemotron 3 Ultra free -> Groq GPT-OSS120B free only after server-side key, provider plan, quota and independent model response verified |
| Synthetic GUI visual planning | **CATALOG ONLY, NOT LIVE** | Nemotron 3.5 Super VL free candidate verified publicly. NVIDIA free endpoint disallows confidential/personal screen images, so no personal screenshots ever sent |
| Paid flagship API (OpenAI GPT-6 Astra) | **NOT AUTHORIZED** | Strongest published API candidate, but explicit new budget and data-processing authorization are required. No automatic paid fallback |
| Autonomous recovery after Windows reboot | **NOT VERIFIED** | Test single existing BrowserBridge worker after reboot without duplicate process, then read heartbeat/generation and job result; no unattended reboot |
| Owner-only approvals and privacy | **SOURCE + OFFLINE TESTS PASS** | Spoofed remote GO blocked; exact local physical approval consumed once; no keys in Windows code/PR; no private data to free providers |
| Independent nested readback | **CLOUD GATEWAY v5 DEPLOYED and MOCK CI PASS** | JWT+service role; exact case ID, action, app mode, attempt count and nested DONE; live read-only queue query verified independently |
| Primary operational model using ChatGPT's GPT-6 in THIS conversation | **INTERACTIVE LIVE** | ChatGPT here has operated allowed Windows probes through Supabase; not a 24/7 external headless model |
| Permanent autonomous headless model worker | **NOT VERIFIED / BLOCKED** | Groq/OpenRouter account-specific free flags, live response, and authorized recurring caller not independently verified. No new background worker |

## Source and immutable-ish proofs

- Existing PR: https://github.com/aliaksei-chareshneu/alchareshneu/pull/237 (DRAFT; deliberately not merged).
- Existing gateway: Supabase project `cmrknyhnnehyjpreehcf`, function `imperion-free-inference` ACTIVE v5 `verify_jwt=true`. Prior v2/v3 code retained at `ops/pc-agent/cloud/gateway/rollback-v2/` and `rollback-v3/` and v4 at `rollback-v4/`.
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


## M9 evidence update — live server and device (15 Nov 2026)

- Supabase `imperion-free-inference` is **v5 ACTIVE**, `verify_jwt=true`; model provider receives only its five relevant flags/keys, never the Supabase service role. GitHub CI PASS on this hardening.
- Restricted Windows job `79745ec2-54e4-4f0d-9af7-00728b7e9590`: `state=done`, one attempt, `agent=IMPERION_AGENT5_RESTRICTED`, `requested=pc_operator`, nested `status=DONE`, nested `mode=machine_readiness`, RAM 1710 MB at observation.
- New gateway `pc5_receipt` is **deployed code**, not yet independently HTTP-invoked. CI mocked exact nested readback and blocked malformed approvals/rows. Do not mislabel as real HTTP readback.
- Windows `runtime_probe` job `41e3eb3c-fb87-4b18-9e01-9620e5f11aa6`: queue `done` but inner result `BLOCKED MODE_NOT_ALLOWED`. Running BrowserBridge has not reloaded M7 adapter, so GUI and new audit routes are still NOT cloud live.
- Account-specific free provider authorization remains NOT VERIFIED, no headless model completion receipt. Desktop Commander quota exhaustion still prevents manual Windows refresh from this connection. No fees, private-data upload or process termination triggered.

## M10 actual acceptance evidence — 15 Nov 2026, 18:30 Europe/Prague onward

- **Gateway deployed:** existing Supabase `imperion-free-inference` v6 ACTIVE, `verify_jwt=true`, service-role check preserved. Added `runAndVerifyCloudPC` with five bounded readbacks per request (no background worker or new queue). `VERIFIED_DONE` can be returned only for exact nested `DONE` with one attempt; otherwise returns `QUEUED_PENDING` or `BLOCKED`.
- **Account tests:** non-inference GitHub Actions provider test confirmed an existing **authenticated Groq API key** and **available GPT-OSS 120B model**. No OpenRouter GitHub secret, no Supabase service-role GitHub secret. Neither a valid model list nor previous historically successful draft proves currently free account billing. NVIDIA 550B is still unconnected, Groq not enabled for unverified $0 production routing.
- **Live device regression after gateway upgrade:** queue job `08ffa19e-d995-4a34-8a73-c20eae680e95`, mode `machine_readiness`, `state=done`, `attempts=1`, nested `status=DONE`, trusted Agent5 identity, 542MB RAM free. This confirms the existing worker was NOT broken by cloud gateway deployment; it still does not load new GUI routes.
- **Model-driven complete Windows E2E:** NOT VERIFIED. Owner physical local GUI consent NOT performed. Startup recovery NOT VERIFIED; Desktop Commander monthly quota remains exhausted. No new spending, payment, private screen exposure, app termination, or unauthorized restart.
- **Code and safety readback:** https://github.com/aliaksei-chareshneu/alchareshneu/actions/runs/43742201396 (SUCCESS); rollback v5 pinned at `ops/pc-agent/cloud/gateway/rollback-v5/`; outstanding PR remains DRAFT.

## M11 Windows-native and live CSV acceptance — 15 Nov 2026

- **Real Windows-hosted CI PASS:** GitHub Actions run [43743623443](https://github.com/aliaksei-chareshneu/alchareshneu/actions/runs/43743623443), both `safe-executor` and `windows-native-synthetic` finished SUCCESS. Windows 2025 hosted runner tested local owner confirmation policy, GUI denial paths, memory gates, offline M6 maintenance and M7 recovery mocks; there was NO actual Notepad GUI interaction and this runner is **not** zmrzlina.
- **Real zmrzlina import → plan → execute → fetch LIVE**, inside existing restricted sandbox, no secrets, public uploads or model inference:
  1. `70366bf9-96cb-424a-b7ef-9f36d252f508` `import` `DONE`, one attempt, filename `pc5_m11_demo.csv`, 24 B, SHA256 `0e1aaafac19936fe95ce623e37360b3f2c048b6a3ec95039070a688b1aad4326`.
  2. `d9badec2-84c3-4cf6-a126-e9ed6cab7a5f` `plan` `READY`, exact source hash, preapproved steps `csv_stats` and `write_report`, no action executed.
  3. `aedac05a-c32a-42c7-ac79-8ddb2f73dbe7` `execute` `DONE`, one attempt, exactly two steps, 2 columns and 2 data rows, output SHA256 `9c0ffe1d731c6c22b77ca64addab4b476c5aba7e5b4747fcfb9fc58ed813eec4`.
  4. `c2d74efd-8e59-47dc-97f6-621ddb6cfebc` `fetch` `DONE`, one attempt, 273-byte report SHA256 identical to execute receipt.
- **Independent receipt:** existing IMPERION_Execution_Receipts sheet row **883**, `REC-IMP-PC5-M11-20261115-CLOUDCSV-WINDOWS-CI`, readback 18/18 cells. No new cash costs.
- **Remaining barriers unchanged:** existing Windows BrowserBridge long-lived worker still has old adapter; Desktop Commander usage paused; local physical YES for fixed Notepad GUI E2E, then separately allowlisted other GUI apps and reboot-readback. Cloud Groq API key/model availability verified but account Free billing entitlement and headless inference still unverified. Public repository GitHub-hosted standard Windows CI is free; it is not a permanent PC-hosted agent.

**Truthfulness:** Synthetic CSV workflow is LIVE through the current cloud-to-Windows queue. Full arbitrary Windows GUI, private documents, browser accounts, paid model orchestration and unattended reboot recovery are **NOT VERIFIED**. Do not merge the draft PR as complete merely because Linux/hosted Windows CI passes.
