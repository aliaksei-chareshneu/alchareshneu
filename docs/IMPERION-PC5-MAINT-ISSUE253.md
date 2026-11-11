# IMPERION Agent #5 — Windows maintenance (Issue #253)

**Case:** `IMP-PC5-MAINT-20261110` · **Budget:** 0 CZK new expenses · **Entity:** personal Windows PC `zmrzlina` · **Owner:** Aliaksei.

This is an extension to the **existing** authenticated Browser Bridge Agent #5 and Supabase `browser_jobs` channel, not another agent, service, queue, CRM, cloud API or general-purpose remote shell. All operations fail closed when the host is unavailable.

## Source and deployment truth

- **Installed earlier with narrow owner GO:** the existing private `browser_bridge_adapter.py` routes `pc_operator` with `mode=audit_pc` to `pc5_maintenance.py`. Verified real **new** host audit via existing Supabase queue 11 Nov 2026 with one claim and `replay=false`; locally stored evidence and hash matched the cloud's bounded summary. Also verified immutable replay `replay=true` and low-RAM fail-closed behaviour.
- **Proposed additional mode, not assumed live:** `remediate_pc` requires `dry_run=true` and a strict allowlist. It **only constructs a preview** with rollback instructions; no execution API exists. Enabling the preview route in the installed adapter requires a separate scoped GO for that deployment; *no actual system remediation is implied by this source code*.
- **No merge:** keep this PR in DRAFT and unmerged until specifically authorized. A merge or a green CI does not imply deployment.
- The code in `ops/pc-agent/pc5_adapter_hook.py` specifies the only proposed new modes. The existing private adapter is the production entrypoint; it is **not copied into the public repository**.

## Authenticated owner command path

A trusted operator submits a fixed, validated payload to the **existing** `browser_jobs` queue for the known `target_agent_id`, using one unique `idempotency_key`, short `deadline_at`, `max_attempts=1`, and readback of both `browser_jobs` and `browser_job_events`.

`audit pc` is the human-facing name; the queue's strict machine mode is `audit_pc`, e.g.:

```json
{"action":"pc_operator","payload":{"mode":"audit_pc","audit_id":"IMP-PC5-MAINT-20261110-EXAMPLE01"}}
```

`remediate pc` (dry-run only) is `remediate_pc`, e.g.:

```json
{"action":"pc_operator","payload":{"mode":"remediate_pc","dry_run":true,"action_ids":["startup.comet","startup.discord"],"audit_id":"IMP-PC5-MAINT-20261110-EXAMPLE01"}}
```

- `audit_id` is optional **for a generic planning template**, but supplying it requires a previously saved local audit and matching SHA-256 receipt; then the proposed action receives a *historical working-set observation* from that private baseline. **Working-set bytes are never a guarantee of RAM released.**
- `dry_run=false`, `approved=true`, arbitrary command/path fields, unknown actions, and duplicate action IDs are all **blocked**. No network shell command can be passed as an action. The GH Issue #195 DEV command poller is a separate system; a GH comment **does not** authorize Windows commands.
- The authenticated queue and source-of-authority checks belong to the existing Browser Bridge deployment and trusted owner/operator tooling. This Python module does not independently authenticate arbitrary JSON; never expose it on a public HTTP endpoint or route user-created GitHub comments to it.

## Diagnostics (private evidence)

`pc5_audit.ps1` is a **fixed** no-input PowerShell script with a validated `-AuditId` (never caller-selected shell). Its private, size-bounded JSON is stored in `%LOCALAPPDATA%/IMPERION/Agent5/audits/`. A second local receipt contains the SHA-256, and immutable replay rejects mismatches.

Host JSON includes CPU, memory, uptime, pagefile, disk free/health and disk performance snapshot, Chrome process/window counts, top process groups and per-process PID/accumulated CPU and RAM, processes' signature sampling, services, registry Run/RunOnce **names only** (not values), Startup folders, Task Scheduler names/states, installed apps **via read-only uninstall registry**, and Defender state, signature date, detection count and **quick-scan command availability only**. No `Win32_Product`, no quick/full scan, no quarantine. OS and application warning/error IDs are limited to counts; private message contents are not exported.

The **cloud result** is restricted to a numeric summary, fixed status/reason codes, filename and file SHA-256. It never returns PIDs, command lines, registry values, full file paths, browser tabs/URLs, cookies, tokens, installed-app titles or security event texts. This source does not claim to identify all malware; high RAM or an unsigned executable is insufficient for a malware determination.

**Low-memory safety:** new heavy audits are denied below 1024 MB free RAM, with `AUDIT_LOW_MEMORY_NO_EXECUTION` and no new snapshot. Immutable replay of an existing checked audit remains available even under low RAM. PowerShell collection has a 60-second timeout and no auto retry; a transient infrastructure failure is not recorded as a completed audit.

## Remediation safety contract

Only a **proposal** exists for these allowlisted candidate startup entries: Comet, Discord, Teams, Viber, Edge autolaunch and WinZip Preloader. The output records target, risk, reversible action description, `needs_explicit_per_action_go=true`, expected freed RAM **unknown**, and `changes_applied=0`.

Actual mutation of any startup key, app/service/task, cache, file, Defender setting, or browser session requires a **separate explicit item-specific owner GO**, fresh baseline, unsaved-work check, actor authority, tamper-protected exact target verification, private backup, atomic or reversible change, independent after-vs-before measurements, receipt and readback. **No mutation handler is remotely exposed or implemented in this PR**, even when the caller forges a GO flag. The protected default list includes IMPERION agents, Browser Bridge, Ollama, Python, Node.js, Git, current browsers/sessions, workspaces, Defender, CRM, user files, keys and client data.

## Reproducible deployment / rollback (GO required)

`pc5_adapter_install.py` is an **offline** narrowly scoped helper for the existing local adapter. Default operation is `--check` and reports only hashes and whether the adapter needs the dry-run route. It requires the **exact reviewed core Git blob hash** and the unchanged previously authorized audit-only anchor.

With a separate explicit deployment GO, an operator can run `--apply` **locally** and supply the exact current adapter SHA-256 and the fixed confirmation phrase. The installer writes a uniquely named private backup and atomically replaces **only** the reviewed `audit_pc` route with the fixed `audit_pc` + `remediate_pc` (preview-only) route, then checks the result. It never restarts a worker. The confirmation phrase is a fail-closed local friction check, **not authentication or proof of owner GO**. If the adapter has drifted, the core hash differs, paths are redirected, or the installer is interrupted, abort and review/restore the backup; never invent a new adapter or launch a second Bridge process.

Do **not** restart a running Bridge worker while a job is claimed, when its browser/profile has visible unsaved work, or while the machine is under substantial RAM pressure. An operator with explicit GO first verifies the existing task and performs a single controlled restart, preserving profiles, then checks one `remediate_pc` dry-run queue job (never any actual cleanup). To roll back, restore the exact saved adapter backup only after comparing installed/backup hashes and confirming no concurrent changes, then restart the same existing task under the same safety checks.

## Tests and acceptance

```bash
python -m unittest discover -s tests -p 'test_imperion_pc5_maintenance.py' -v
```

Dedicated `pc5-maintenance` CI job runs synthetic/no-network Python tests, Windows PowerShell syntax parsing via `pwsh`, and the adapter/installer gates, **independent of unrelated site quality**. Check the actual GitHub run before saying PASS. No real Windows cleanup is run in CI, and synthetic SUCCESS is not a Windows installation receipt.

- `TASK_LOGGED`: existing Issue #253.
- `CODE_READY`: reviewed code and test run in existing Draft PR.
- `AGENT_ACCEPTED`: live existing agent claimed a fixed owner-routed job.
- `AUDIT_DONE`: fresh `replay=false` local JSON and independent receipt/hash/Supabase event readback.
- `REMEDIATION_AWAITING_GO`: specific, reversible candidates; **not applied**.
- `CLEANUP_DONE`: only after a **separate, specifically approved mutation** and verified before/after evidence.
- `BLOCKED`: cause, owner, next allowed action and resume trigger are written to existing 03 EXECUTION.

The private canonical case log is maintained in **03 IMPERION — AUTOMATION & EXECUTION**. Keep private identity, complete local security logs, app paths, documents, credentials and all user content out of this public repository.
