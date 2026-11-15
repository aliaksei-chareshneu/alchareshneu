# Agent #5 — owner handoff to the existing Windows worker (15 Nov 2026)
Status: **READY FOR LOCAL RELOAD, NOT YET LIVE GUI**. Owner: OSVČ. New spending: **0 Kč**. No new agent, new task, secret or PowerShell deployment.

## Why the intervention is needed

The current `zmrzlina` heartbeat is online and the existing `public.browser_jobs` queue has no `queued`/`claimed` jobs at the last readback. A fresh synthetic `pc_operator` job `f51019f2-d708-4687-8ebf-303390793edb`, idempotency `IMP-PC5-M12-RUNTIME-20261115-01`, was **queue DONE, nested BLOCKED MODE_NOT_ALLOWED**. The long-lived Windows process still imports its older adapter, even though `pc5_m5_preflight.py` and newer `browser_bridge_adapter.py` have been installed and local SHA verified on disk in previous checks. A source update is not the same as a Python module reload.

Main-branch existing canonical operator runbook is `ops/bridge-public-ai/README.md`, which identifies precisely one existing Windows **Task Scheduler** entry named **`Browser Bridge Agent`**. Keep and reload only that task, never create another worker or kill unrelated `python.exe` processes.

## Safe owner-only manual reload (without requiring an extra 1 GB RAM)

**Only when the owner is physically using the computer and no other Agent4/Social/BrowserBridge operation is pending.** Check the existing Supabase queue immediately before restart; do not rely on the previous timestamp. If queue is not empty, **BLOCKED; defer**. Do not use the local GUI pilot to reload the worker.

1. Press `Win+R` and run `taskschd.msc` (Task Scheduler). In Task Scheduler Library, locate the existing task named **Browser Bridge Agent**. Inspect its **Actions**; it must be the already installed `BrowserBridge` agent, not a similarly named task. If more than one matching task or an unexpected action exists, STOP — do not restart.
2. With the existing queue confirmed idle, right-click the **existing** task -> **End** (if running), allow it to stop, then right-click **Run** exactly once. Do **not** add a new scheduled task, change triggers, reboot Windows, terminate arbitrary Python processes, disable Defender, install new runtimes, or copy any Supabase/Groq key to the PC.
3. Check Task Scheduler task state. Confirm that only the existing BrowserBridge process is active, then separately query `public.browser_agents` for a fresh heartbeat and insert exactly **one** cloud `pc_operator` `{"mode":"runtime_probe"}` with new idempotency key and `max_attempts=1`. Only nested `status="DONE"`, `generation="M7-20261115"`, `source_loaded=true` proves the new adapter is active. If nested `BLOCKED MODE_NOT_ALLOWED`, STOP: the task starts a different source/old import; inspect its installation path rather than restarting it repeatedly. Do not mark LIVE.
4. After fresh `runtime_probe` proof, send one cloud `pc_operator` `{"mode":"audit_light"}` and independently inspect nested `DONE`, fixed read-only coarse RAM/process counters and zero changes. M6 full audit requires its own 1 GB RAM threshold and may remain BLOCKED; do not bypass.

**If desktop is unavailable:** do not remotely restart the Windows task by bypassing an exhausted tool quota. Wait for authorized device access / explicit owner operation. Cloud-only maintenance scripts cannot legitimately claim the Windows running process was reloaded.

## Physical GUI Notepad acceptance is a DIFFERENT gate

Only after the Windows worker is proven fresh **and** zmrzlina has sustained >= 1024 MB free RAM for the protective GUI gate:

- Press `Win+R`, run the **already installed** `C:\Users\chere\ChatGPT-Workspace\_shared\pc-agent\IMPERION-PC5-Notepad-Approve.cmd`.
- Read the single-test physical consent dialog. Press YES only if choosing to authorize *this exact* synthetic Notepad task. After YES, leave mouse/keyboard alone until the script finishes. There is NO remote/cloud approval substitute.
- Success requires `LIVE_NOTEPAD_GUI_E2E_VERIFIED` and independent on-disk evidence. Read it locally with `python -B C:\Users\chere\ChatGPT-Workspace\_shared\pc-agent\pc5_gui_readback.py --task-id A5-GUI-20261115-M4-001`. Demand `DONE` and output SHA matching the primary receipt. **Do not repeat the consumed approval.** If denied/failed, log the failure rather than bypass.
- This validates only Notepad; Chrome/Excel/Word still require separate allowlisted, owner-approved E2E drivers and cannot be marked LIVE by inheriting the Notepad result.

## Cloud model acceptance is separate from the worker

- Existing `imperion-free-inference` is v6 ACTIVE, JWT and server-role auth preserved. Cloud-to-Windows deterministic synthetic file I/O is independently LIVE.
- Existing GitHub `GROQ_API_KEY` authenticated in a zero-inference metadata-only CI call and `openai/gpt-oss-120b` was listed. No GitHub `OPENROUTER_API_KEY`. **Current Groq Free vs Developer billing was not confirmed by that metadata test.**
- Never copy cloud service-role credentials to Windows, public CI logs or chat. Require current provider Free entitlement or documented no-charge budget before an actual headless model call. No paid API fallback, no private inputs to the free external model.
- New cloud code's `QUEUED_PENDING` is NOT actual execution; only nested `VERIFIED_DONE` is real. Limit to non-sensitive/synthetic fixed read-only intents.

## Verification checklist to close this case

- [x] Windows PC heartbeat + existing queue: recent online, queue was idle at readback (volatile)
- [x] Existing old worker executed four-stage synthetic CSV workflow with matching SHA256
- [x] Hosted native Windows and Linux CI passed
- [x] Supabase cloud gateway v6 ACTIVE with secret isolation, previous rollback source
- [ ] Owner manually reloaded *the single existing* Browser Bridge Agent task, post-reload heartbeat and nested runtime generation readback
- [ ] Owner physically approved Notepad once, independent file/receipt SHA readback
- [ ] Exact current model API Free entitlement and headless inference receipt with **0 Kč** charge
- [ ] Extra allowlisted GUI programs, controlled browser tasks, reboot recovery and independent E2E evidence

**Do not merge PR #237 as complete** or state universal autonomous computer control until those acceptance gates actually pass. Current status: `PARTIAL`.
