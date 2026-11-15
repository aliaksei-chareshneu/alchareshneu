"""IMPERION Agent #5 M5 one-shot, read-only readiness check.

No GUI action, no keyboard/mouse, no process stop/restart, no provider tokens,
no new background worker, no files written. All results are observational.
Cloud loaded-adapter version and queue-idle state require separate Supabase
readback; local import never proves the existing worker has reloaded.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

SOURCE_SHA256 = {
    "browser_bridge_adapter.py": "0165f97785044b0d2ca030665d0016ead8a39edf54f273644e319fc102e2804f",
    "pc5_gui_pilot.py": "06bec3a63819d5d627620adc7388eda37f18e8f2336b5b97a1114991b988d705",
    "pc5_gui_owner_approval.py": "70a413cff50de67e1ef1d74d84cfa095cc70258dfedec21517a3922baaccba10",
    "pc5_gui_readback.py": "57c403e814c78e9a7a0bb2b8c1e58fcc0e0e945153acb25877a4d3c477668a5e",
    "pc5_model_router.py": "6f307be8fcab7b6ff30a70611eb1538dadfa464c87d5d30dc1cfab3b50c6c230",
}
GUI_MIN_FREE_MB = 1024
LLM_MIN_FREE_MB = 5120


def evaluate(*, source_ok, windows, free_ram_mb, desktop_result, installed_adapter_ok):
    """Pure policy check used by simulated tests; never grants actions."""
    blockers = []
    if not source_ok or not installed_adapter_ok:
        blockers.append("SOURCE_MISSING_OR_CHANGED")
    if not windows:
        blockers.append("WINDOWS_REQUIRED")
    if type(free_ram_mb) is not int or free_ram_mb < GUI_MIN_FREE_MB:
        blockers.append("GUI_LOW_RAM")
    if desktop_result != "PASS":
        blockers.append("DESKTOP_" + str(desktop_result))
    return {
        "status": "LOCAL_PREFLIGHT_READY" if not blockers else "BLOCKED",
        "blockers": blockers,
        "gui_memory_ready": type(free_ram_mb) is int and free_ram_mb >= GUI_MIN_FREE_MB,
        "local_4b_model_memory_ready": type(free_ram_mb) is int and free_ram_mb >= LLM_MIN_FREE_MB,
        "worker_cloud_version": "UNVERIFIED_SEPARATE_QUEUE_READBACK_REQUIRED",
        "queue_idle": "UNVERIFIED_SEPARATE_QUEUE_READBACK_REQUIRED",
        "local_owner_gui_approval": "NOT_REQUESTED_BY_PREFLIGHT",
        "may_execute_gui": False,
        "worker_restarted": False,
        "gui_input_sent": False,
        "cloud_cost_kc": 0,
    }


def status(root=None):
    root = Path(root) if root is not None else Path(__file__).resolve().parent
    sources = {}
    for name, expected in SOURCE_SHA256.items():
        path = root / name
        if not path.is_file() or path.is_symlink():
            sources[name] = "MISSING_OR_LINKED"
            continue
        try:
            actual = hashlib.sha256(path.read_bytes()).hexdigest()
        except OSError:
            sources[name] = "CANNOT_READ"
            continue
        sources[name] = "SHA256_OK" if actual == expected else "SHA256_CHANGED"
    source_ok = all(v == "SHA256_OK" for v in sources.values())
    adapter_ok = sources.get("browser_bridge_adapter.py") == "SHA256_OK"
    free = None
    total = None
    desktop = "NOT_CHECKED"
    windows = sys.platform == "win32"
    if windows:
        try:
            from pc_desktop_v4 import win_memory
            free, total = win_memory()
        except (OSError, RuntimeError, TypeError, ValueError):
            desktop = "MEMORY_READBACK_ERROR"
        if type(free) is int and free >= GUI_MIN_FREE_MB:
            try:
                from pc5_gui_pilot import Win32NotepadDriver, Denied
                Win32NotepadDriver().preflight()  # read-only, never opens windows
                desktop = "PASS"
            except Denied as error:
                desktop = error.args[0] if error.args else "DENIED"
            except (OSError, RuntimeError, ValueError):
                desktop = "WINDOWS_API_UNAVAILABLE"
        elif desktop == "NOT_CHECKED":
            desktop = "NOT_CHECKED_LOW_RAM"
    result = evaluate(source_ok=source_ok, windows=windows, free_ram_mb=free,
                      desktop_result=desktop, installed_adapter_ok=adapter_ok)
    result.update({"mode":"pc5_m5_readiness","sources":sources,
                   "free_ram_mb":free,"total_ram_mb":total,
                   "desktop_readback":desktop,
                   "evidence_class":"LOCAL_READ_ONLY",
                   "instruction":"Require separately verified idle Supabase queue, owner-scoped worker restart and one-use physical GUI consent."})
    return result


def selftest():
    checks = []
    def check(name, test):
        checks.append((name, bool(test)))
    base = dict(source_ok=True,windows=True,free_ram_mb=6144,
                desktop_result="PASS",installed_adapter_ok=True)
    r = evaluate(**base)
    check("ready_does_not_execute",r["status"] == "LOCAL_PREFLIGHT_READY" and r["may_execute_gui"] is False)
    check("4b_ram_ready",r["local_4b_model_memory_ready"])
    check("queue_unverified",r["queue_idle"].startswith("UNVERIFIED"))
    check("no_gui_input",r["gui_input_sent"] is False)
    check("no_worker_restart",r["worker_restarted"] is False)
    check("source_change_denied",evaluate(**{**base,"source_ok":False})["status"] == "BLOCKED")
    check("adapter_change_denied",evaluate(**{**base,"installed_adapter_ok":False})["status"] == "BLOCKED")
    check("linux_denied",evaluate(**{**base,"windows":False})["status"] == "BLOCKED")
    check("low_gui_ram_denied",evaluate(**{**base,"free_ram_mb":700})["status"] == "BLOCKED")
    check("model_ram_not_guaranteed",not evaluate(**{**base,"free_ram_mb":1100})["local_4b_model_memory_ready"])
    check("user_active_denied",evaluate(**{**base,"desktop_result":"USER_ACTIVE_GUI_DEFERRED"})["status"] == "BLOCKED")
    check("locked_desktop_denied",evaluate(**{**base,"desktop_result":"ACTIVE_CONSOLE_SESSION_REQUIRED"})["status"] == "BLOCKED")
    check("missing_ram_denied",evaluate(**{**base,"free_ram_mb":None})["status"] == "BLOCKED")
    check("fake_boolean_ram_denied",evaluate(**{**base,"free_ram_mb":True})["status"] == "BLOCKED")
    success = all(v for _, v in checks)
    return {"status":"PASS" if success else "FAIL",
            "passed":sum(v for _,v in checks),"total":len(checks),
            "checks":checks,"external_actions":0}


if __name__ == "__main__":
    ap=argparse.ArgumentParser()
    group=ap.add_mutually_exclusive_group(required=True)
    group.add_argument("--status",action="store_true")
    group.add_argument("--selftest",action="store_true")
    args=ap.parse_args()
    result=selftest() if args.selftest else status()
    print(json.dumps(result,sort_keys=True,ensure_ascii=True))
    sys.exit(0 if result["status"] in ("PASS","LOCAL_PREFLIGHT_READY","BLOCKED") else 2)
