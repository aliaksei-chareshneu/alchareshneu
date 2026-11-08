"""Stage (never install) the existing Browser Bridge diagnostic integration.

Reads original local browser_agent.py, writes ONLY a separate staged copy in
the Agent5 shared workspace, then tests its execute() without launching Chromium
or touching the live process. Deployment is an owner gate.
"""
import asyncio
import hashlib
import importlib.util
import json
from pathlib import Path

LOCAL = Path(__file__).resolve().parent
SOURCE = Path.home() / "BrowserBridge" / "agent" / "browser_agent.py"
DEST = LOCAL / "browser_agent_staged.py"

ANCHOR = 'async def execute(context, page, action: str, payload: dict[str, Any]):\n'
INSERTION = '''async def execute(context, page, action: str, payload: dict[str, Any]):
    # IMPERION Agent5: read-only diagnostics, never a model-facing shell.
    if action in ("pc_machine_status", "pc_watchdog"):
        import sys
        local_adapter = Path.home() / "ChatGPT-Workspace" / "_shared" / "pc-agent"
        if local_adapter.is_symlink() or not local_adapter.is_dir():
            raise RuntimeError("AGENT5_ADAPTER_UNAVAILABLE")
        if str(local_adapter) not in sys.path:
            sys.path.insert(0, str(local_adapter))
        from browser_bridge_adapter import dispatch as dispatch_readonly
        return page, dispatch_readonly(action, payload)
'''

class FakePage:
    url = "about:blank"
    async def title(self):
        return "Empty Page"

async def validate_stage():
    spec = importlib.util.spec_from_file_location("agent5_staged_bridge", DEST)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    page = FakePage()
    checked = []
    _, result = await module.execute(None, page, "pc_machine_status", {})
    checked.append(("readonly_machine", result.get("result", {}).get("status") == "DONE"))
    _, result = await module.execute(None, page, "pc_watchdog", {})
    checked.append(("readonly_watchdog", result.get("result", {}).get("status") in ("DONE", "BLOCKED")))
    _, result = await module.execute(None, page, "pc_machine_status", {"command": "whoami"})
    checked.append(("payload_injection_denied", result == {"status": "BLOCKED", "reason": "PAYLOAD_NOT_ALLOWED"}))
    _, result = await module.execute(None, page, "status", {})
    checked.append(("existing_status_unchanged", result.get("online") is True and result.get("url") == "about:blank"))
    try:
        await module.execute(None, page, "run_powershell", {"command": "whoami"})
        rejected = False
    except ValueError:
        rejected = True
    checked.append(("unrecognized_shell_denied", rejected))
    return checked

def main():
    if not SOURCE.is_file() or SOURCE.is_symlink() or DEST.is_symlink():
        print(json.dumps({"status":"BLOCKED","reason":"INVALID_SOURCE_OR_DESTINATION"}))
        return 2
    original = SOURCE.read_bytes()
    source_hash = hashlib.sha256(original).hexdigest()
    text = original.decode("utf-8")
    if text.count(ANCHOR) != 1 or "IMPERION Agent5: read-only diagnostics" in text:
        print(json.dumps({"status":"BLOCKED","reason":"SOURCE_ANCHOR_CHANGED_OR_ALREADY_PATCHED"}))
        return 3
    staged = text.replace(ANCHOR, INSERTION, 1)
    compile(staged, str(DEST), "exec")
    DEST.write_text(staged, encoding="utf-8")
    checks = asyncio.run(validate_stage())
    checks.append(("original_untouched", hashlib.sha256(SOURCE.read_bytes()).hexdigest() == source_hash))
    checks.append(("staged_marker_once", staged.count("IMPERION Agent5: read-only diagnostics") == 1))
    success = all(v for _, v in checks)
    print(json.dumps({"status":"PASS" if success else "FAIL",
        "passed":sum(v for _, v in checks),"total":len(checks),
        "checks":checks,"production_source_untouched":True,
        "running_browser_agent_not_restarted":True,"ready_for_review_only":True}))
    return 0 if success else 4

if __name__ == "__main__":
    raise SystemExit(main())
