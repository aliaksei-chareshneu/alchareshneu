"""Stage Agent5 v2 Browser Bridge source WITHOUT changing the running instance.

Requires installed v1 to match exactly one action dispatch line, then validates
new pc_task route against the staged adapter and isolated temporary scratch.
"""
import asyncio
import hashlib
import importlib.util
import json
import sys
import tempfile
from pathlib import Path

from pc_task_engine import run_task

HOME = Path(__file__).resolve().parent
LIVE = Path.home() / "BrowserBridge" / "agent" / "browser_agent.py"
STAGED = HOME / "browser_agent_v2_staged.py"
OLD_LINE = 'if action in ("pc_machine_status", "pc_watchdog"):'
NEW_LINE = 'if action in ("pc_machine_status", "pc_watchdog", "pc_task"):'

class FakePage:
    url = "about:blank"
    async def title(self):
        return "Empty Browser"

async def verify():
    import browser_bridge_adapter_candidate as candidate
    old = sys.modules.get("browser_bridge_adapter")
    old_task = candidate.run_task
    checks=[]
    try:
        with tempfile.TemporaryDirectory(prefix="imperion-a5-bridgeqa-") as folder:
            candidate.run_task = lambda payload: run_task(payload, root=Path(folder)/"job")
            sys.modules["browser_bridge_adapter"]=candidate
            spec = importlib.util.spec_from_file_location("imperion_staged_browser", STAGED)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            p=FakePage()
            _,s = await module.execute(None,p,"status",{})
            checks.append(("legacy_status",s.get("online") is True))
            _,m = await module.execute(None,p,"pc_machine_status",{})
            checks.append(("machine_status",m.get("result",{}).get("status")=="DONE"))
            _,r = await module.execute(None,p,"pc_task",{"task_id":"A5-TEST-STAGED-0001","steps":[{"op":"system_status"},{"op":"write_report"}]})
            checks.append(("two_step_task",r.get("result",{}).get("executed_steps")==2))
            checks.append(("local_artifact",
                           (Path(folder)/"job"/"outbox"/"A5-TEST-STAGED-0001.report.md").is_file()))
            _,b=await module.execute(None,p,"pc_task",{"task_id":"A5-TEST-STAGED-0002","steps":[{"op":"shell"}]})
            checks.append(("shell_denied",b.get("result",{}).get("status")=="BLOCKED"))
            try:
                await module.execute(None,p,"cmd.exe",{})
                unknown_denied=False
            except ValueError:
                unknown_denied=True
            checks.append(("unknown_action_denied",unknown_denied))
    finally:
        candidate.run_task=old_task
        if old is None:
            sys.modules.pop("browser_bridge_adapter",None)
        else:
            sys.modules["browser_bridge_adapter"]=old
    return checks

def main():
    if LIVE.is_symlink() or not LIVE.is_file() or STAGED.is_symlink():
        raise SystemExit("SOURCE_OR_DESTINATION_INVALID")
    original=LIVE.read_bytes()
    text=original.decode("utf-8")
    if text.count(OLD_LINE)!=1 or "pc_task" in text.split("async def execute",1)[1].split("if action == \"status\":",1)[0]:
        raise SystemExit("UNEXPECTED_SOURCE_REVISION")
    patched=text.replace(OLD_LINE,NEW_LINE,1)
    compile(patched,str(STAGED),"exec")
    STAGED.write_text(patched,encoding="utf-8")
    checks=asyncio.run(verify())
    checks.append(("production_source_unchanged",hashlib.sha256(LIVE.read_bytes()).digest()==hashlib.sha256(original).digest()))
    checks.append(("single_action_route",patched.count(NEW_LINE)==1))
    good=all(v for _,v in checks)
    print(json.dumps({"status":"PASS" if good else "FAIL",
                      "passed":sum(v for _,v in checks),"total":len(checks),
                      "checks":checks,"live_source_sha256":hashlib.sha256(original).hexdigest(),
                      "staged_sha256":hashlib.sha256(STAGED.read_bytes()).hexdigest(),
                      "live_process_not_restarted":True}))
    return 0 if good else 3

if __name__=="__main__":
    sys.exit(main())
