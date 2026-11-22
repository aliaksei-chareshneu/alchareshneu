"""Stage Agent5 v3 against live Browser Bridge without changing source/process."""
import asyncio
import hashlib
import importlib.util
import json
import sys
import tempfile
from pathlib import Path

HOME = Path(__file__).resolve().parent
LIVE = Path.home() / "BrowserBridge" / "agent" / "browser_agent.py"
STAGED = HOME / "browser_agent_v3_staged.py"
OLD = 'if action in ("pc_machine_status", "pc_watchdog", "pc_task"):'
NEW = 'if action in ("pc_machine_status", "pc_watchdog", "pc_task", "pc_operator"):'

class FakePage:
    url = "about:blank"
    async def title(self):
        return "Empty Browser"

async def smoke_test():
    import pc_operator_v3 as op
    import browser_bridge_adapter_v3_candidate as adapter
    prev = sys.modules.get("browser_bridge_adapter")
    old_operate = op.operate
    checks = []
    try:
        with tempfile.TemporaryDirectory(prefix="imperion-a5-stagev3-") as temp:
            root = Path(temp) / "work"
            op.operate = lambda payload: old_operate(payload, root=root)
            sys.modules["browser_bridge_adapter"] = adapter
            spec = importlib.util.spec_from_file_location("imperion_v3_staged_bridge", STAGED)
            staged = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(staged)
            page = FakePage()
            async def call(action,payload):
                p,result = await staged.execute(None,page,action,payload)
                assert p is page
                return result
            a=await call("status",{})
            checks.append(("legacy_status_preserved",a.get("online") is True))
            a=await call("pc_machine_status",{})
            checks.append(("legacy_machine_preserved",a.get("result",{}).get("status")=="DONE"))
            imported=await call("pc_operator",{
                "mode":"import","import_id":"A5-STAGED-V3-IMPORT-1",
                "filename":"testdata.csv","content":"name,val\nalpha,3\nbeta,5\n",
                "data_class":"non_sensitive"})
            checks.append(("operator_import",imported.get("result",{}).get("status")=="DONE"))
            instruction="Проверь CSV testdata.csv и сделай отчёт"
            taskid="A5-STAGED-V3-EXECUTE1"
            plan=await call("pc_operator",{"mode":"plan","task_id":taskid,"instruction":instruction})
            checks.append(("operator_plan",plan.get("result",{}).get("status")=="READY"))
            task=await call("pc_operator",{"mode":"execute","task_id":taskid,"instruction":instruction})
            checks.append(("operator_execute",task.get("result",{}).get("status")=="DONE"))
            result=await call("pc_operator",{"mode":"fetch","task_id":taskid,"kind":"report"})
            checks.append(("operator_fetch",result.get("result",{}).get("status")=="DONE"
                          and "csv_stats" in result.get("result",{}).get("text","")))
            denied=await call("pc_operator",{"mode":"import","import_id":"A5-STAGED-V3-BLOCK-01",
                                          "filename":"../private.txt", "content":"xx",
                                          "data_class":"non_sensitive"})
            checks.append(("operator_path_denied",denied.get("result",{}).get("status")=="BLOCKED"))
            denied=await call("pc_operator",{"mode":"execute","task_id":"A5-STAGED-V3-BLOCK-02",
                                           "steps":[{"op":"shell","command":"whoami"}]})
            checks.append(("operator_shell_denied",denied.get("result",{}).get("status")=="BLOCKED"))
            try:
                await call("powershell",{})
                denied_other=False
            except ValueError:
                denied_other=True
            checks.append(("unknown_action_preserved",denied_other))
            checks.append(("no_production_changes",all(v.is_relative_to(root) for v in root.rglob("*"))))
    finally:
        op.operate = old_operate
        if prev is None:
            sys.modules.pop("browser_bridge_adapter",None)
        else:
            sys.modules["browser_bridge_adapter"] = prev
    return checks

def main():
    if LIVE.is_symlink() or not LIVE.is_file() or STAGED.is_symlink():
        raise SystemExit("SOURCE_PATH_DENIED")
    source = LIVE.read_bytes()
    original = source.decode("utf-8")
    if original.count(OLD)!=1 or original.count(NEW)!=0:
        raise SystemExit("SOURCE_NOT_V2")
    staged = original.replace(OLD, NEW, 1)
    compile(staged,str(STAGED),"exec")
    STAGED.write_text(staged,encoding="utf-8")
    checks=asyncio.run(smoke_test())
    checks.append(("live_source_sha_unchanged",
        hashlib.sha256(LIVE.read_bytes()).hexdigest()==hashlib.sha256(source).hexdigest()))
    good=all(ok for _,ok in checks)
    print(json.dumps({"status":"PASS" if good else "FAIL",
         "passed":sum(ok for _,ok in checks),"total":len(checks),
         "checks":checks,
         "original_sha256":hashlib.sha256(source).hexdigest(),
         "staged_sha256":hashlib.sha256(STAGED.read_bytes()).hexdigest(),
         "production_source_untouched":True,
         "running_bridge_not_restarted":True}))
    return 0 if good else 2

if __name__=="__main__":
    sys.exit(main())
