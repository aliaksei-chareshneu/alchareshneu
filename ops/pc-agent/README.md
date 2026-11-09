# IMPERION PC Automation Agent #5 — safe Windows runtime

Owner: existing IMPERION project. Canonical Job_ID: JOB-IMP-PC-AUTOMATION-20261108-05.
Status: LIVE restricted PC operator v4 via existing Browser Bridge: import,
plan, execute, fetch, fixed app status, memory readiness and diagnostics.
No new paid service. Not unrestricted Windows or autonomous business operations.

## Existing infrastructure reused

- Remote Desktop Commander: connected Windows zmrzlina, no inbound ports.
- Browser Bridge / Supabase browser_jobs: live paired local Playwright browser agent.
- Existing Project80 health_check.ps1 + health_watch.ps1: hourly health and recovery; do not create another watchdog.
- Ollama installed model: imperion-qwen3-cpu:0.6b, explicitly CPU-only per request.
- No cloud API keys, service_role tokens, private browser profiles, external sends, payments, installs or subscriptions.

## Readback and safety tests on zmrzlina

Run from this directory:
```powershell
python -B .\restricted_executor.py --selftest
python -B .\restricted_executor.py --status
python -B .\ollama_loop_qa.py
```
The executor selftest passed **12/12**; independent local Ollama QA ran **4/4** synthetic
steps twice (create, hash, read, erase) and verified exact sha256.
All synthetic note files were cleaned; the test uses temporary directories.
No model instruction can choose a shell command, custom file path, browser session or external endpoint.

## ChatGPT / Android request path

When the PC is ONLINE, the existing Remote Desktop Commander connector can run this script
from ChatGPT. A trusted connector host may pass Base64-encoded JSON with
`python -B restricted_executor.py --job-b64 <ASCII_BASE64_JSON>`.
Allowed read-only job actions: `status`, `machine_status`, `read_watchdog`,
`read_note`, `hash_note`. The latter two only see this tool's synthetic note.
Allowed synthetic writes: `write_note`, `erase_note`, requiring a separate
trusted `--allow-synthetic-write` CLI flag; model-proposed JSON cannot grant it.
Every job has a unique `key` matching `SYN-...` or `AUD-...`; replay returns prior receipt,
same key with changed payload is rejected. No arbitrary path parameter is accepted.

This proves ChatGPT connector -> local command -> readback. Actual origin from
an Android device has not been independently tested. Do not claim it has.

## Verified cloud queue to local Windows health (one-shot)

Additional zero-cost route: start `python -B .\loopback_readonly.py --once` from
a trusted, authorized local session. It temporarily binds **127.0.0.1 only** on a
random port and accepts at most two GETs: `/a5-status` and `/a5-watchdog`.
Use the **existing** Supabase `browser_jobs` targeted to the known paired
`zmrzlina` Browser Bridge agent, with action `open`, URL
`http://127.0.0.1:<ephemeral-port>/a5-status` or `/a5-watchdog`.
Then read `browser_jobs` result from Supabase and use `snapshot` to confirm
page text. No shell, credentials, private browser data or user file paths are
exposed to the model. This is an **on-demand read-only demo**, not a permanent
listener and not a secure channel for consequential writes.

Source verification 08Nov2026: jobs
`00716cb1-2b83-4355-a20d-388985e68dc0` (machine_status),
`93254e26-88ab-4fd3-a008-11c1f1f11b27` (read_watchdog), and
`5043af53-a391-43d6-92bc-a61d9ce3c9a6` (DOM readback)
each DONE, one attempt, without errors. The DOM reported watchdog OK.
The temporary listener automatically STOPPED after two successful responses,
and independent tests confirmed the loopback port CLOSED and zero remaining
temporary directories. No new cloud queue, external network listener, schedule
or production endpoint. The localhost-only server intentionally requires no
password; do not use it for sensitive data and do not extend it to writes.

Run local regression tests: `python -B .\loopback_readonly.py --selftest`.
Seven checks passed on the real Windows host: route, read-only diagnostics,
Host restriction, POST rejection, query injection denial, non-CORS and CSP.

## LIVE read-only Browser Bridge adapter (activated 09 Nov 2026)

Owner GO was given for a controlled Windows Browser Bridge update and restart.
The existing agent source `~/BrowserBridge/agent/browser_agent.py` was backed
up **before** modification at
`C:\Users\chere\ChatGPT-Workspace\_shared\pc-agent\backups\browser_agent.pre-agent5.20261109.py`.
The old source SHA-256 is
`d913773d5f906dd2c907091334c0a08f8a772857a7141ae17d76a655ccc8114f`;
the deployed source SHA-256 is
`fef3ab79a46f1e27bcb8bc4a6fdee1ccc8362da9b8e2555a310eab759d287efc`.
An additional atomic-replacement rollback copy exists beside the original
`browser_agent.py`, named `browser_agent.pre-agent5.20261109.bak`.
Neither backup includes user browser session files or tokens.

The old Chromium window was closed gracefully, the detached old worker PID
4116 was stopped, and the **existing** Scheduled Task `Browser Bridge Agent`
was restarted. At 09:52 Europe/Prague it reported `Running` with exactly
one **new** worker PID 26604. The existing browser-agent heartbeat returned.

The installed read-only adapter accepts two new fixed actions:
`pc_machine_status` and `pc_watchdog`. The adapter rejects any nonempty
payload; no model-facing shell, write, arbitrary file path, credentials or
public network endpoint was added. Existing `status` continues working.
On 09 Nov the real Supabase browser_jobs queue processed the following
targeted jobs, each once with no worker error:
- `a210fcf7-1014-46ef-9482-bb9b9ccafaa1`: legacy `status`, online=true;
- `f1f775db-90a3-49a6-b039-8a0a19cf7cdf`: `pc_machine_status`, DONE/Windows;
- `121da646-4666-4f49-be02-83df2919f848`: `pc_watchdog`, DONE/OK;
- `e7e3fa77-b1b5-4095-ab2c-3382432b0ac4`: forbidden `path` payload,
  rejected with `PAYLOAD_NOT_ALLOWED`.

Independent postrestart Windows readback confirmed one worker, scheduled
task Running, browser profile directory present and both hashes matching.
This establishes *live unattended read-only diagnostic consumption* through
the existing Browser Bridge queue. No second worker, scheduled task, cloud
service or separate CRM was introduced. Browser account login persistence
and actual Android-origin operation were **not** independently checked.

`stage_browser_integration.py` is for preparing a patch to an unmodified
source only; do not rerun it blindly against the already-patched source.
The `loopback_readonly.py` one-shot diagnostic relay remains a separate
QA fallback and is **not** running. No Windows reboot or privileged
desktop/file autonomy was authorized or attempted.

## LIVE multi-step workspace automation (09 Nov 2026, v2)

The owner repeated the original Agent #5 objective and explicitly instructed
completion. The existing `Browser Bridge Agent` on zmrzlina was updated and
restarted **in place**, preserving the original task scheduler and queue.
No separate listener, cron, model service, API subscription or fee was created.

Action `pc_task` is now LIVE through existing Supabase `browser_jobs`:
- `{"task_id":"A5-EXAMPLE-20261109-001","instruction":"Проверь CSV agent5_qa.csv и сделай отчёт"}`
- `{"task_id":"A5-EXAMPLE-20261109-002","steps":[{"op":"inventory"},{"op":"text_stats","file":"agent5_qa.txt"},{"op":"program_versions"},{"op":"write_report"}]}`

The natural-language input is intentionally **bounded rule-based routing**;
it is NOT a general autonomous LLM reasoning loop. An AI chat client can
create the structured multi-step plan, but the local executor validates
**every** step and cannot be tricked into accepting shell commands or paths.
It supports only `inventory`, `text_stats`, `csv_stats`,
`clean_blanks`, `system_status`, `program_versions`, `write_report`.
Up to six steps. Only UTF-8 text/CSV/Markdown/JSON sources directly within
`pc_task_data/inbox/` (not personal, browser or Project80 directories);
new immutable outputs in `pc_task_data/outbox/`; JSON readback receipts in
`pc_task_data/receipts/`. Input max 128 KiB; per-output max 16 KiB.
Results contain bounded metadata and SHA-256, not full input text.
Exact replay returns the prior receipt; changed request with the same
`task_id` is blocked. Files outside this workspace cannot be accessed.
No arbitrary applications, shell commands, account actions, external sends,
server endpoints, privileged system settings, deletion or overwriting.

Existing `browser_agent.py` was modified only to route `pc_task` into
the locally allowlisted adapter. Pre-v2 backups, hashes and replacement
rollback copies are retained. Source SHA-256 after upgrade:
`d5ec3d0f5185f3b59a5668333d5d53433779c8b2bcb0863d3d2fcc6b31a5428e`.
Adapter SHA-256:
`3ae67239eeace3b43bcddadfe76c653f0b02158382fa53b0ad82de3d5b9452eb`.
One Browser Bridge worker PID 3392; existing Windows task Running.
No modification to Project80.

Actual independent cloud->PC->cloud tests, all queue DONE, attempts=1,
error=NULL and source files unchanged:
- `07192cd1-1cad-427d-acec-e2ca89fa0e04`: natural Russian CSV,
  2-row analysis and report DONE.
- `b97f9863-544d-4c7e-8585-92883e85ee99`: natural Russian clean blanks,
  3-line output plus report DONE.
- `9d5b0203-97ba-4c5c-b4f1-f0672777fdd4`: 4-step inventory, text
  metrics, fixed program version probes and report DONE.
- `2075570f-4e4d-4592-8c10-bdb016875bcf`: malicious shell request
  returned application BLOCKED (queue itself done).
- `8b29de5b-d5d5-4684-8acb-9ce3607ca69d`: existing status preserved.
- `c61bc7cf-f643-420c-91d4-e29b76d60ba1`: identical request replay true.
- `0b6cd445-2eb7-48c5-b073-d882fcda2e8b`: conflicting request ID
  blocked IDEMPOTENCY_CONFLICT.
All four produced files had independent Windows SHA256 readback matching
Supabase job receipts. Synthetic source hashes remained unchanged.
Module unit checks: 15/15; adapter safety checks: 13/13;
staged integration fake-browser checks: 8/8 PASS, all local on Windows.

This is a usable remote **restricted PC task operator** without requiring
Desktop Commander for each job. It is not universal UI/Windows control.
Android-origin and actual reboot/relogin recovery remain UNVERIFIED.
Owner-specific permission remains required for modifying real documents or
code outside the explicitly designated scratch workspace.

## LIVE v3: chat-to-PC input / plan / execution / results (09 Nov 2026)

The original PC Agent #5 remains a **restricted Windows operator**, not a
second coding agent. After the owner's `доработай` request, the existing
Browser Bridge agent on Windows zmrzlina was upgraded **in place** (same
Supabase queue, Windows Scheduled Task and Playwright profile). It now
routes action `pc_operator` to `pc_operator_v3.py` without any extra service,
daemon, browser credential, paid API or resident AI model. Local source SHA256
`22b8f9b1dc5506e8631089a83e3b29deebce6d13c0b7eb4edd56dd1e9cbf10f3`;
adapter SHA256
`88f1aa01cb006dd12486dccd26108d11f4885dc70b74c88564974a4b8e4b59a4`.
Two verified copies of the previous source and adapter are under
`_shared/pc-agent/backups/*pre-v3.20261109.py`, plus atomic replacement backups.
The existing Bridge worker restarted as one process PID 58020 and Windows
Scheduled Task state `Running`.

The queue action `pc_operator` takes ONLY the following sub-modes:
- `capabilities`: fixed capabilities/scope report (no filesystem effect);
- `import`: upload at most 8 KiB of **non-sensitive UTF-8 text/CSV** from the
  user-approved queue request into a NEW flat named file in
  `pc_task_data/inbox/` (example payload
  `{"mode":"import","import_id":"A5-V3-MYIMPORT-0001","filename":"data.csv","content":"k,v\\na,1\\n","data_class":"non_sensitive"}`);
- `plan`: inspect an existing inbox file and validate every step and input
  hash without performing changes (`{"mode":"plan","task_id":"A5-V3-MYTASK-0001","instruction":"Проверь CSV data.csv и сделай отчёт"}`);
- `execute`: run the same validated bounded task, writing a NEW output into
  `pc_task_data/outbox/` and SHA256-verifiable receipt in `receipts/`
  (same payload as `plan`, but `mode:"execute"`);
- `fetch`: return and verify a *small* report or cleaned output text directly
  through Supabase (max 8 KiB) using
  `{"mode":"fetch","task_id":"A5-V3-MYTASK-0001","kind":"report"}`.
  Content SHA256 must match the local task receipt.

This makes a **complete** non-sensitive input -> local preview -> multi-step
execution -> remote text-result workflow accessible via ChatGPT/connector
without Desktop Commander per job. Only existing `pc_task_engine.py`
allowlisted operations execute (CSV and text processing, inventories,
health/program version probes, reports); no free-form shell, arbitrary
commands, unknown Windows folders, account actions, payments, social posts
or unsanctioned real-file access. User-provided inline text and output are
stored in Supabase queue results: DO NOT send private/medical/client records,
passwords or other confidential information by this route.

`pc_operator_v3.py --selftest`: 23/23 PASS on the Windows device, including
SQLite serialized import idempotency, parallel collision, SHA256 readback,
output tamper detection and negative path/shell/secret-field tests.
`stage_pc_operator_v3.py`: 11/11 PASS staged actual Browser Bridge route,
with no production source modification during the test.
The LIVE Supabase cloud->PC->cloud E2E on 09 Nov:
- capabilities job 40360041-4639-4503-96b6-2f61e9d136b8 DONE;
- synthetic CSV import 1432b0ed-4a88-4a35-b99e-a9ee4514a1f2 DONE;
- plan 872e3aaf-e63e-479c-b284-1a2bba684f33 READY, input sha confirmed;
- execute 13d17519-b979-4daa-aa85-b0c035609ffb DONE two steps;
- remote report fetch 554e2349-525c-4555-99d3-3433a9e879a4 DONE, actual
  text returned, independent SHA256 readback matches receipt;
- exact replay 4385247a-b776-4f8f-a220-8ad7a015bb04 DONE replay=true;
- changed task payload 724a73dc-58fc-4082-816f-e39a5cf217e1
  BLOCKED/IDEMPOTENCY_CONFLICT;
- unsafe import path 0eb7e584-4c1f-4146-8c58-4812df2123ed
  BLOCKED/FILE_NAME_NOT_ALLOWED;
- unsafe plan file 25bb4283-fc1b-4d93-9c09-26c8c3742b42
  BLOCKED/FILE_NAME_NOT_ALLOWED.

All these are existing browser_jobs targeted to the paired zmrzlina agent,
no remote Desktop Commander call to run individual jobs. After processing,
an independent PC readback confirmed only one running worker PID 58020,
task Running, saved receipt and output hashes exactly matching Supabase.

Outstanding requirements: Android-device-origin test is not independently
verifiable from this Windows/cloud session; lock/logon/reboot recovery needs
controlled separate validation. Real personal/project files and GUI app tasks
require owner-approved explicit scoped paths/action policy. Open-ended local
LLM planning is not verified, and Qwen 0.6b is not running resident due to
limited free RAM. Do not mark universal Windows agent complete.

## LIVE v4: fixed Windows app inspection and desktop entry points (09 Nov 2026)

Existing Windows zmrzlina Browser Bridge expanded with a **read-only** fixed
application-status mode. No new local agent, loopback listener, scheduled task,
Ollama model, Supabase table or paid service. New module:
`pc_desktop_v4.py` (pure Windows Win32 Toolhelp32 process list and
GlobalMemoryStatusEx metrics). Same existing `pc_operator` queue action:
- `{"mode":"app_status","app":"chrome"}` returns running/instances for an
  allowlisted app, without PIDs, usernames, command lines, window titles or
  arguments. Allowed app IDs: notepad, calculator, vscode, chrome, edge,
  python, ollama. Unknown app IDs denied.
- `{"mode":"machine_readiness"}` returns coarse RAM availability and whether
  there is >=1024 MiB available for any future GUI pilot. It **never**
  launches, terminates, clicks or controls any app. Launch requests are
  denied regardless of an untrusted owner's flag.

Local on actual Windows: `pc_desktop_v4.py --selftest` PASS 18/18 (path,
command, app whitelist and memory-range deny checks). Staged existing
Browser Bridge test `stage_pc_desktop_v4.py` PASS 11/11, source unmodified.
Controlled install changed only
`ChatGPT-Workspace/_shared/pc-agent/browser_bridge_adapter.py`, postinstall
SHA256 `c1c8c51c65b6a2812611476c02e35d178847e6d875947d5e6607a5c31c199c50`.
Existing `BrowserBridge/agent/browser_agent.py` unchanged SHA256
`22b8f9b1dc5506e8631089a83e3b29deebce6d13c0b7eb4edd56dd1e9cbf10f3`.
Pre-v4 adapter saved at `backups/browser_bridge_adapter.pre-v4.20261109.py`,
hash `88f1aa01cb006dd12486dccd26108d11f4885dc70b74c88564974a4b8e4b59a4`,
plus exact atomic replacement rollback copy. Existing Scheduled Task restarted
after closing only its dedicated Bridge Chromium window (old worker PID58020).
Readback: `Running`, one new Bridge worker PID57712. Other Chrome windows
and user sessions were not closed.

Actual targeted Supabase `browser_jobs` E2E (single paired agent;
no Desktop Commander per task), 7 queue jobs each DONE / attempts=1 /
worker error NULL:
- readiness 2f23fec9-9e42-4e75-aa6e-895bb23908e4: new mode DONE,
  available RAM 990MB, GUI pilot memory ready false;
- chrome app 2ca8ba7d-c248-47ab-8760-e9be509f979c: DONE, 99 running
  Chrome processes at measurement time (this is process count not tabs);
- notepad app 2b2d8639-b451-42ad-a865-dc06d2a19d30: DONE, 0;
- unknown app f00d44ff-1d8d-4998-af18-db685b93c80b:
  queue DONE but APPLICATION BLOCKED APP_NOT_ALLOWLISTED;
- cloud app launch c6b99f46-5667-4f0b-84de-e394f8113f7d:
  queue DONE but APPLICATION BLOCKED MODE_NOT_ALLOWED;
- old status 87b48f50-14be-462b-bd0e-57260a37284b:
  DONE/online=true;
- old v3 capabilities ecffe840-0e74-451c-9e47-7045f8e69a76:
  DONE, previous modes preserved.

Previous v3 non-sensitive file workflow also independently retested
through v4 adapter:
- plan a3baeb74-eddd-4c8f-973a-121266f5663b DONE/READY;
- execute c2388af9-2504-40b7-9715-c47d59fa16da DONE/2 steps,
  report SHA256 c8201a2a442cfbb1f943a7ed366826aac55c532c5175161c44be1d265d6f6562;
- fetch 7796d931-9a2b-450b-8e51-293e3326d780 DONE/actual report text
  and SHA match. Synthetic CSV test only.

Two reversible Windows Desktop shortcuts created, each target independently
verified (Desktop actual path is under `OneDrive - MUNI/Plocha`, so .lnk files
may sync, but source data remains in local protected workspace):
- `IMPERION Agent5 - Drop non-sensitive files.lnk` ->
  `pc_task_data/inbox`.
- `IMPERION Agent5 - Verified results.lnk` ->
  `pc_task_data/outbox`.
No personal or client records copied or read. Do not submit sensitive data
through remote Supabase queue or this workspace. Desktop files are linked, not
duplicated; user can remove shortcuts without deleting workspace data.

User Android acceptance step: open same ChatGPT conversation on Android
and issue "Агент №5, проверь Chrome на zmrzlina и покажи статус памяти".
Only once that message is sent from the physical device and the resulting
queue IDs/readback confirmed may Android-origin be marked VERIFIED.
Current chat/connector test is device-agnostic; user platform unverified.
System uptime and actual reboot/login survival require separate safe test.
Free RAM is volatile; it had fallen to 200-400 MiB before the update and
rose to ~990 MiB around the cloud measurement. No GUI automation was enabled.

## Known limits / do not silently promote

- The installed Codex CLI exists; do NOT run it with danger-full-access or paid API fallback.
- Initial Ollama qwen3:0.6b GPU path failed HTTP 500 with a CUDA llama-server crash.
  Use the existing CPU model and `num_gpu:0`; local CPU planner completed 4/4 twice.
- Desktop Commander itself currently has global allowedDirectories=[]: this is NOT
  a sandbox. This executor's bounded allowlist is the model-facing boundary.
- Owner-specific GO required before live file modifications, privileged PC automation,
  persistent agent listener changes, logon/reboot test, new remote permissions, posting,
  purchases or production Supabase SQL/Edge changes.
- All model output is untrusted. Existing Browser Bridge now polls unattended for bounded
  multi-step workspace tasks (files, reports, program probes) plus read-only diagnostics.
  Free-form general Windows control, owner-authorized real document changes, autonomous
  open-ended model planning, revenue outcome, Android-origin session, locked-screen UI
  and after-reboot recovery are NOT verified.
- Supabase public.browser_jobs has a UNIQUE partial index on non-NULL idempotency_key,
  reverified 08Nov2026; do not add a duplicate migration.

## Evidence

- Live Windows task engine --selftest 15/15, adapter candidate 13/13,
  staged real Browser Bridge integration 8/8 PASS.
- Seven cloud queue actions confirmed, with structured outputs, replay and conflict
  denial. Four generated artifacts independently checked by Windows SHA256.

- Local restricted_executor.py --selftest: 12/12 PASS.
- Local Ollama imperion-qwen3-cpu:0.6b -> limited executor: 4/4 PASS, repeated.
- On-demand CLI: read-only machine_status DONE; read_watchdog DONE; unauthorised
  write denied; synthetic write, hash, independent read, replay, conflict block,
  erase and missing-note readback verified.
- Existing Browser Bridge target Supabase jobs recorded and verified in 03 EXECUTION:
  status ffc5f337-6c14-4780-8e9c-78814039c4f3;
  open 0e7244db-cd2c-4250-81c9-f11cdaa19ad1;
  snapshot 4cee4572-fe47-4258-bb61-be0e874a8865.
- Existing 03 EXECUTION + 00 APPEND-ONLY are canonical receipts; this README
  is implementation documentation only, not a production completion claim.
