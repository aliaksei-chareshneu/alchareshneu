# IMPERION DEV Agent — local Windows CPU fallback

**Owner:** Aliaksei. **Entity:** personal OSVČ; not Družina Moravy z.s. or a grant.  
**Case:** IMP-DEV-ZMRZLINA-20261108. **Status 8 Nov 2026:** limited local coder **verified**; unrestricted / always-on automation **not verified**.  
**Budget:** no paid model API, card, subscription or new CRM. Local CPU/electricity and operator time still have costs.

This is a *bounded executable component of the existing IMPERION DEV Agent*, not a second agent, CRM, cloud deployment, listener or service. It can be invoked from an authorized ChatGPT/Desktop Commander session on the already connected Windows device; Android-origin dispatch has **not** been independently end-to-end tested.

## Verified readbacks on zmrzlina

- Remote device online, existing Git/Node/Python/Ollama/Codex CLI detected. The existing website Git clone was clean.
- Local `imperion-qwen35:4b` Ollama `127.0.0.1:11434/api/generate` returned `DONE=True`, `LOCAL_OK` without a paid external API.
- First public synthetic Python task: baseline **1 failing test**; model generated code with 297 prompt / 35 completion tokens (17.825s model duration), validator applied one-function patch, **3/3** unittest PASS; independent readback **3/3** PASS. Proof on device: `%TEMP%\imperion-dev-agent-acceptance-20261108\local-coder-proof.json`.
- Second public synthetic Python task using **this reusable worker**: baseline 1 failing test (26 vs 69), model generated a loop-based solution using 262 prompt / 42 completion tokens (23.519s model duration); **3/3** PASS, independent readback **3/3** PASS. On device: `%TEMP%\imperion-dev-agent-qa-2-20261108\imperion-dev-proof.json`; status `LOCAL_MODEL_CODE_TEST_PASS`.
- The local safety suite has **5/5** PASS, including rejection of `public_only=false`, file path traversal, imports, attribute access, arbitrary Python calls, multiple functions, baseline-already-passing no-op, and mock-only successful edits.
- Codex CLI `--oss --local-provider ollama` was tried but **did not complete accepted coding**, with missing model metadata and effective read-only sandbox. Do not claim Codex CLI integration is READY or bypass its security controls.

## Trusted run (not persistent / no unattended monitor)

Run the script from this PR in a repository clone or use the already verified local copy at:

`C:\Users\chere\ChatGPT-Workspace\80-Digital-Platform-Automation\local-tools\dev-agent\safe_local_python_worker.py`

Prepare a new **public/synthetic only** scratch directory whose basename begins `imperion-dev-agent-` under Windows `%TEMP%`. Add source and trusted `unittest` test files. A manifest in that directory must contain exactly these fields:

```json
{
  "job_id": "IMP-DEV-EXAMPLE-20261108",
  "workspace": "C:\\Users\\<local-user>\\AppData\\Local\\Temp\\imperion-dev-agent-example",
  "source_file": "sample.py",
  "test_file": "test_sample.py",
  "function": "price_total",
  "requirement": "Compute total of unit_price multiplied by quantity for all rows.",
  "public_only": true
}
```

PowerShell (for a correctly prepared and authorized manifest):

```powershell
python scripts/imperion-local-python-worker.py --task "C:\Users\chere\AppData\Local\Temp\imperion-dev-agent-example\task.json"
python tests/imperion-local-python-worker.test.py scripts/imperion-local-python-worker.py
```

Expected independent proof: `<workspace>\imperion-dev-proof.json` plus a separate trusted unittest run. Codes: `LOCAL_MODEL_CODE_TEST_PASS`, `BASELINE_ALREADY_PASS_NO_EDIT`, or `BLOCKED` / `BLOCKED_MODEL_OR_TEST_FAILED_RESTORED`. Failure restores original source; proof must never be interpreted as GitHub PR, merge, publication, invoice or payment.

## Explicit technical boundary

- The model sees only two user-approved public/synthetic files in a Windows temp workspace. It can propose exactly one pure Python function; its AST is allowlisted and arbitrary calls/imports/attribute access are rejected.
- The trusted controller may edit only the task source in that temp workspace and execute a fixed `python -m unittest discover` command on trusted test code. It has **no GitHub write credentials**, customer database permissions, outbound integrations, production deploy, card, or paid API calls.
- This is **not** an operating-system sandbox. The tester is trusted and Windows has no enforced no-network jail here; never pass untrusted tests, third-party code, customer secrets or private work.
- General frontend/backend/Python coding, remote GitHub PR creation on Windows, scheduled local monitoring and a fully autonomous phone-triggered task loop are **not proven**. The separate issue-195 cloud workflow has documented real public-code generated commit and the draft child [PR #235](https://github.com/aliaksei-chareshneu/alchareshneu/pull/235), but Actions PR creation was denied by repository settings. Do not enable that permission or merge/deploy without a separate GO.

Primary tracking remains existing [issue #195](https://github.com/aliaksei-chareshneu/alchareshneu/issues/195) and [draft PR #231](https://github.com/aliaksei-chareshneu/alchareshneu/pull/231), plus IMPERION Project80 / 03 EXECUTION / append-only CHANGELOG.
