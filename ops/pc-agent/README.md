# IMPERION PC Automation Agent #5 — safe Windows runtime

Owner: existing IMPERION project. Canonical Job_ID: JOB-IMP-PC-AUTOMATION-20261108-05.
Status: LIVE unattended restricted PC workspace tasks AND read-only diagnostics
through existing Browser Bridge, plus locally tested optional CPU Ollama pilot.
This is not unrestricted Windows control or an autonomous business-outcome agent.

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
