# IMPERION PC Automation Agent #5 — safe Windows runtime

Owner: existing IMPERION project. Canonical Job_ID: JOB-IMP-PC-AUTOMATION-20261108-05.
Status: LIVE read-only diagnostics through existing Browser Bridge, plus working
restricted **on-demand** executor and locally tested CPU Ollama plan.
This is not an unrestricted AI or an autonomous business-outcome agent.

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

## Known limits / do not silently promote

- The installed Codex CLI exists; do NOT run it with danger-full-access or paid API fallback.
- Initial Ollama qwen3:0.6b GPU path failed HTTP 500 with a CUDA llama-server crash.
  Use the existing CPU model and `num_gpu:0`; local CPU planner completed 4/4 twice.
- Desktop Commander itself currently has global allowedDirectories=[]: this is NOT
  a sandbox. This executor's bounded allowlist is the model-facing boundary.
- Owner-specific GO required before live file modifications, privileged PC automation,
  persistent agent listener changes, logon/reboot test, new remote permissions, posting,
  purchases or production Supabase SQL/Edge changes.
- All model output is untrusted. Structured planning remains bounded to fixed synthetic actions.
  Existing Browser Bridge now polls and executes two read-only PC diagnostics unattended.
  General-purpose autonomous planning, consequential job execution, business outcome,
  real Android-origin session, locked-screen UI and after-reboot recovery are NOT verified.
- Supabase public.browser_jobs has a UNIQUE partial index on non-NULL idempotency_key,
  reverified 08Nov2026; do not add a duplicate migration.

## Evidence

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
