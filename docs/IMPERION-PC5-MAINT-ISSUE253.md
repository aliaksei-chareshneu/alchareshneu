# IMPERION Agent #5 - Windows maintenance, Issue #253

Case: `IMP-PC5-MAINT-20261110`. Cost: 0 CZK. This is **review-only**
source for the **existing** Browser Bridge Agent #5. It is not a second agent,
new queue, scheduled task, service, remote shell or production deployment.

## Source of truth and installation gate

The already installed `Browser Bridge Agent` (Windows task) calls
`browser_agent.py`, which delegates `pc_operator` to the existing
`browser_bridge_adapter.py` in `%USERPROFILE%/ChatGPT-Workspace/_shared/pc-agent/`.
That adapter currently routes `app_status`/`machine_readiness` to
`pc_desktop_v4.py` and all other modes to `pc_operator_v3.py`.
The **reviewed** additions are `ops/pc-agent/pc5_maintenance.py`,
`pc5_audit.ps1` and `pc5_adapter_hook.py`; they MUST remain out of the
installed adapter until a separate owner-approved and tested deployment.

After scoped approval, a maintainer copies the **exact reviewed bytes** into
that existing trusted local adapter directory, checks hashes and tests, then
adds these lines **inside the existing `browser_bridge_adapter.dispatch` BEFORE
its `if action == 'pc_operator'` branch**:

```python
from pc5_adapter_hook import maybe_dispatch
new_result = maybe_dispatch(action, payload)
if new_result is not None:
    return new_result
```

Do not run code from issue text, create another listener, weaken RLS, or expose
local files through GitHub, an LLM, CI logs or public comments. Verify exact
existing owner authorization, Supabase service-role-only job insertion, target
agent UUID, fixed mode allowlist and queue idempotency before approval.
These guarantees are **not provided by the files alone**.

## Existing Supabase channel - example after authorized deployment

Only the already-existing `browser_jobs` target for `zmrzlina` may be used.
The request is structured, never a shell command:

```json
{"action":"pc_operator","payload":{"mode":"audit_pc","audit_id":"IMP-PC5-MAINT-20261110-A1"}}
```

Use existing queue's `idempotency_key`, `target_agent_id`, one claim, finite
`deadline_at`, and read back `browser_jobs` + `browser_job_events`; validate
`agent=IMPERION_AGENT5_RESTRICTED`, `result.status=DONE`, unique job and local
receipt SHA. The locally generated full JSON stays exclusively in the
current Windows user's `%LOCALAPPDATA%/IMPERION/Agent5/audits/`. Cloud readback
contains only a bounded summary and SHA-256, not PIDs, paths, arguments,
registry values, process titles, passwords, events or client files.

`mode=remediate_pc` with `dry_run=true` returns a **proposal only**. Actual
execution is intentionally **not implemented**, even if caller forges
`ownerGo=true`. Future implementation requires a separate explicit GO for
specific actions, verified pre-action baseline, exact target fingerprints,
minimal rights, per-action receipts, rollback capability and after-vs-before
independent measurements. No automatic antivirus scans, quarantine, deletions,
registry edits, app stops, restarts, service disable or Defender exclusions.

## Diagnostic coverage

Fixed, no-input PowerShell collectors cover RAM, CPU load, uptime, pagefile,
Chrome process count/working sets, top process groups, disks and SSD health,
services, registry Run/RunOnce **names only** (not values), Startup folder
file names, Task Scheduler names/states, Defender state/detections, signature
samples of up to 50 large processes, and recent system/application error
counts without private log messages. Exceptions are recorded as `UNAVAILABLE`,
not treated as proof of safety. Candidate signatures and TEMP location do
not, on their own, prove malware. Event counts are bounded samples.

Caveats: processor load is one OS sampling window; process memory working-set
sums include shared pages; Defender's empty detection list does not rule out
infections. The source collector is tested via synthetic Python fixtures on
non-Windows machines; the PowerShell runtime and installed adapter require
**real Windows staging plus independent installed-worker readback**.

## Private baseline and optimization approval

Real device RAM/process/Defender observations, file hashes, local audit paths,
workloads, private task names, live software inventory and diagnostic evidence
must remain **only on the Windows machine and in the existing private
03 EXECUTION log**. Do not copy real values to this public GitHub PR or CI.
Reviewable code and tests use unrelated synthetic values. The real baseline
was obtained independently of this reviewed code and does not prove
this extension is installed or operating.

Prior to any change, present the owner with a **private**, fresh list of
specific optional background apps and current measurements; check unsaved
work, dependencies, reversible startup settings and confirmed agent tasks.
Do not automatically stop applications or disable startup. Protected app
families include active browser/profile, Defender, IMPERION agents, Node,
Python, Ollama, Git, local model weights and workspace files.

## Local deterministic test

```bash
python -m unittest discover -s tests -p 'test_imperion_pc5_maintenance.py' -v
```

Test matrix includes exact-command allowlist, forged GO denial, no changes in
dry-run, protected objects, Windows/offline gate, Defender failure, idempotency,
stale lock, path redirects, Unicode paths, Windows script argument vector,
receipt hash, response redaction, injection, duplicate action and rollback
manifest. No network, paid model or real data in tests. CI outcome must be
reported using actual workflow logs, not inferred from a review branch.

## Progress statuses (never conflate)

- `TASK_LOGGED`: GitHub issue #253 exists.
- `CODE_READY`: reviewed code + deterministic tests + Draft PR (no install).
- `AGENT_ACCEPTED`: only after installed agent claims intended new-mode job.
- `AUDIT_DONE`: either direct/manual Windows audit explicitly labelled manual
  or new-agent audit after readback of the new-mode job. Do not interchange.
- `REMEDIATION_AWAITING_GO`: proposed changes only.
- `CLEANUP_DONE`: **not reached** until explicit per-action GO and verified
  Windows changes with rollback and independent benchmark.

`BLOCKED` when new-mode handler not installed: owner controls production GO;
executor only installs after approval, then performs one scoped check and
updates existing 03 EXECUTION. No background task created by this review PR.