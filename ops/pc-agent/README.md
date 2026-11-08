# IMPERION PC Automation Agent #5 — safe Windows runtime

Owner: existing IMPERION project. Canonical Job_ID: JOB-IMP-PC-AUTOMATION-20261108-05.
Status: working restricted **on-demand** executor + locally tested CPU Ollama plan.
This is not an always-on unrestricted AI, and is NOT an autonomous business-outcome agent.

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

## Known limits / do not silently promote

- The installed Codex CLI exists; do NOT run it with danger-full-access or paid API fallback.
- Initial Ollama qwen3:0.6b GPU path failed HTTP 500 with a CUDA llama-server crash.
  Use the existing CPU model and `num_gpu:0`; local CPU planner completed 4/4 twice.
- Desktop Commander itself currently has global allowedDirectories=[]: this is NOT
  a sandbox. This executor's bounded allowlist is the model-facing boundary.
- Owner-specific GO required before live file modifications, privileged PC automation,
  persistent agent listener changes, logon/reboot test, new remote permissions, posting,
  purchases or production Supabase SQL/Edge changes.
- All model output is untrusted. Structured planning is bounded to fixed synthetic actions.
  No verified general-purpose agent planner, unattended job intake, business outcome,
  real Android-origin session, locked-screen UI or after-reboot recovery test yet.
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
