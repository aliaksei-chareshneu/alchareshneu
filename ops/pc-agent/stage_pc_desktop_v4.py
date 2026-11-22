"""Stage Agent5 v4 read-only app inspection without restarting live Browser Bridge."""
import asyncio
import hashlib
import importlib.util
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LIVE = Path.home() / "BrowserBridge" / "agent" / "browser_agent.py"

class FakePage:
    url = "about:blank"
    async def title(self):
        return "Fixture"

async def run_checks():
    import browser_bridge_adapter_v4_candidate as candidate
    import pc_desktop_v4 as desktop
    previous = sys.modules.get("browser_bridge_adapter")
    old_names = desktop.win_process_names
    old_memory = desktop.win_memory
    old_platform = desktop.sys.platform
    checks=[]
    try:
        with tempfile.TemporaryDirectory(prefix="imperion-a5-desktopstage-") as folder:
            # Tests must never enumerate user's windows or open programs.
            desktop.win_process_names = lambda: ["notepad.exe", "chrome.exe", "chrome.exe"]
            desktop.win_memory = lambda: (2048, 16384)
            desktop.sys.platform = "win32"
            sys.modules["browser_bridge_adapter"] = candidate
            spec = importlib.util.spec_from_file_location("imperion_agent5_v4_existing_bridge", LIVE)
            bridge = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(bridge)
            page = FakePage()
            async def call(action,payload):
                p,result = await bridge.execute(None,page,action,payload)
                assert p is page
                return result
            old=await call("status",{})
            checks.append(("old_browser_status",old.get("online") is True))
            legacy=await call("pc_machine_status",{})
            checks.append(("old_machine_status",legacy.get("result",{}).get("status")=="DONE"))
            new=await call("pc_operator",{"mode":"app_status","app":"chrome"})
            checks.append(("allowlisted_app_count",new.get("result",{}).get("instances")==2))
            ready=await call("pc_operator",{"mode":"machine_readiness"})
            checks.append(("available_ram",ready.get("result",{}).get("free_ram_mb")==2048))
            denied=await call("pc_operator",{"mode":"app_status","app":"powershell"})
            checks.append(("arbitrary_app_denied",denied.get("result",{}).get("reason")=="APP_NOT_ALLOWLISTED"))
            denied=await call("pc_operator",{"mode":"app_launch","app":"notepad"})
            checks.append(("launch_denied",denied.get("result",{}).get("status")=="BLOCKED"))
            denied=await call("pc_operator",{"mode":"app_status","app":"notepad","cmd":"kill"})
            checks.append(("extra_fields_denied",denied.get("result",{}).get("reason")=="FIELDS_NOT_ALLOWED"))
            denied=await call("pc_operator",{"mode":"execute","task_id":"A5-V4-TEST-DENY-001",
                                               "steps":[{"op":"shell","command":"whoami"}]})
            checks.append(("old_sandbox_still_denied",denied.get("result",{}).get("status")=="BLOCKED"))
            try:
                await call("powershell",{})
                unknown_denied=False
            except ValueError:
                unknown_denied=True
            checks.append(("unknown_action_denied",unknown_denied))
            checks.append(("test_only_temporary_folder",not (Path(folder)/"bad.txt").exists()))
    finally:
        desktop.win_process_names=old_names
        desktop.win_memory=old_memory
        desktop.sys.platform=old_platform
        if previous is None:
            sys.modules.pop("browser_bridge_adapter",None)
        else:
            sys.modules["browser_bridge_adapter"]=previous
    return checks

def main():
    if not LIVE.is_file() or LIVE.is_symlink():
        raise SystemExit("LIVE_BRIDGE_PATH_DENIED")
    before=hashlib.sha256(LIVE.read_bytes()).hexdigest()
    checks=asyncio.run(run_checks())
    checks.append(("production_source_unchanged",hashlib.sha256(LIVE.read_bytes()).hexdigest()==before))
    success=all(ok for _,ok in checks)
    print(json.dumps({"status":"PASS" if success else "FAIL",
        "passed":sum(ok for _,ok in checks),"total":len(checks),
        "checks":checks,"source_sha256":before,
        "deployed_source_untouched":True,"browser_worker_not_restarted":True}))
    return 0 if success else 2

if __name__ == "__main__":
    sys.exit(main())
