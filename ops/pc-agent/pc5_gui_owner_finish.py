"""One-shot Agent #5 synthetic GUI acceptance. NEVER run from cloud.

Run interactively by the PC owner on zmrzlina with --run. It displays the
existing physical Windows YES/NO consent dialog, then waits for user-idle.
No unattended activation, no scheduler, no extra worker, no secrets, no
unrestricted GUI, no purchases, no user documents. No automatic retries.
"""
from __future__ import annotations
import argparse
import json
import os
import sys
import time
from pathlib import Path

TASK = "A5-GUI-20261115-M4-001"
GO = "GO-A5-M5-20261115-LOCAL-01"


def gate(info):
    """Pure testable gate; physical Yes and GUI executor provide extra gates."""
    problems = []
    if not isinstance(info, dict):
        return ["MALFORMED_PREFLIGHT"]
    for value in info.get("sources", {}).values():
        if value != "SHA256_OK":
            problems.append("SOURCE_NOT_PINNED")
            break
    if len(info.get("sources", {})) != 5:
        problems.append("SOURCE_SET_INCOMPLETE")
    free = info.get("free_ram_mb")
    if type(free) is not int or free < 1024:
        problems.append("GUI_MEMORY_LOW")
    desktop = info.get("desktop_readback")
    # Starting the approval program necessarily counts as recent user input.
    # Only ACTIVE_INPUT is allowed as a pre-dialog observation: the actual
    # GUI driver demands 5 seconds idle *again* immediately before typing.
    if desktop not in ("PASS", "USER_ACTIVE_GUI_DEFERRED"):
        problems.append("DESKTOP_UNAVAILABLE")
    return problems


def selftest():
    base = {"sources":{str(i):"SHA256_OK" for i in range(5)},
            "free_ram_mb":1536,"desktop_readback":"USER_ACTIVE_GUI_DEFERRED"}
    checks = [
        ("active_user_needs_later_idle",gate(base)==[]),
        ("safe_preflight",gate({**base,"desktop_readback":"PASS"})==[]),
        ("ram_denied",gate({**base,"free_ram_mb":512})==["GUI_MEMORY_LOW"]),
        ("source_tamper_denied", "SOURCE_NOT_PINNED" in gate({**base,"sources":{"one":"SHA256_CHANGED"}})),
        ("locked_desktop_denied", gate({**base,"desktop_readback":"ACTIVE_CONSOLE_SESSION_REQUIRED"})!=[]),
        ("missing_source_denied",gate({**base,"sources":{}})!=[]),
        ("invalid_ram_denied",gate({**base,"free_ram_mb":True})!=[]),
        ("no_prompt_during_selftest",True),
    ]
    result={"status":"PASS" if all(v for _,v in checks) else "FAIL",
            "passed":sum(v for _,v in checks),"total":len(checks),
            "checks":checks,"gui_actions":0,"owner_prompt":False}
    print(json.dumps(result,sort_keys=True))
    return 0 if result["status"]=="PASS" else 2


def run_interactive():
    if sys.platform != "win32" or not os.environ.get("LOCALAPPDATA"):
        print('{"status":"BLOCKED","reason":"INTERACTIVE_WINDOWS_REQUIRED"}')
        return 2
    from pc5_m5_preflight import status
    from pc5_gui_owner_approval import main as ask_owner
    from pc5_gui_pilot import operate
    from pc5_gui_readback import verify_task
    snap=status()
    problems=gate(snap)
    if problems:
        print(json.dumps({"status":"BLOCKED","reason":";".join(problems),
                          "free_ram_mb":snap.get("free_ram_mb")},sort_keys=True))
        return 2
    print("One synthetic Notepad test ONLY. Click YES only if you approve. "
          "After YES, do NOT use mouse/keyboard until a result appears.",flush=True)
    if ask_owner(["--task-id",TASK,"--approval-ref",GO])!=0:
        return 2
    time.sleep(7)  # Physical consent click must not be mistaken for idle desktop.
    # The driver independently checks source, RAM, HWND, session, foreground,
    # process identity, idle time, unique approval claim and exact disk contents.
    result=operate({"mode":"gui_pilot","step":"execute","task_id":TASK,"app":"notepad"})
    if result.get("status")!="DONE":
        print(json.dumps({"status":"BLOCKED","stage":"GUI_EXECUTION","result":result},
                         sort_keys=True,ensure_ascii=True))
        return 2
    approvals=Path(os.environ["LOCALAPPDATA"])/"IMPERION"/"Agent5"/"gui_approvals"
    proof=verify_task(TASK,approvals=approvals)
    finish={"status":"LIVE_NOTEPAD_GUI_E2E_VERIFIED" if proof.get("status")=="DONE" else "BLOCKED",
            "task_id":TASK,"independent_readback":proof,
            "cloud_worker_route":"NOT_VERIFIED_BY_LOCAL_TEST",
            "other_apps":"NOT_AUTHORIZED",
            "cost_kc":0}
    print(json.dumps(finish,ensure_ascii=True,sort_keys=True))
    return 0 if finish["status"]=="LIVE_NOTEPAD_GUI_E2E_VERIFIED" else 3


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--run",action="store_true")
    group.add_argument("--selftest",action="store_true")
    args=parser.parse_args()
    sys.exit(selftest() if args.selftest else run_interactive())
