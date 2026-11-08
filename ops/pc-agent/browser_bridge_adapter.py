"""Read-only IMPERION Agent5 adapter for an EXISTING Browser Bridge agent.

Staged, not installed into the running browser agent.
The caller may only dispatch two diagnostics; no browser state, shell or user data
is forwarded into this module. The result is a bounded JSON dictionary.
"""
import json
import secrets
import sys
import tempfile
from pathlib import Path

from restricted_executor import executor

KNOWN = {
    "pc_machine_status": "machine_status",
    "pc_watchdog": "read_watchdog",
}


def dispatch(action, payload=None):
    if not isinstance(action, str) or action not in KNOWN:
        return {"status": "BLOCKED", "reason": "ACTION_NOT_ALLOWED"}
    if payload is not None and (not isinstance(payload, dict) or payload):
        return {"status": "BLOCKED", "reason": "PAYLOAD_NOT_ALLOWED"}
    with tempfile.TemporaryDirectory(prefix="imperion-a5-browser-") as folder:
        job = {
            "action": KNOWN[action],
            "key": "AUD-BRIDGE-" + secrets.token_hex(8),
        }
        result = executor(job, write_granted=False, root=Path(folder) / "sandbox")
    # Result is already fixed-field and sanitized by restricted_executor.
    # Preserve an explicit denied state for the caller to treat as failure.
    return {"agent": "IMPERION_AGENT5_RESTRICTED", "requested": action, "result": result}


def selftest():
    results = []
    machine = dispatch("pc_machine_status")
    results.append(("machine_status", machine.get("result", {}).get("status") == "DONE"))
    report = dispatch("pc_watchdog")
    results.append(("watchdog_safely_bounded",
                    report.get("result", {}).get("status") in ("DONE", "BLOCKED")))
    results.append(("path_arg_denied", dispatch("pc_machine_status", {"path": "C:/Private"}) ==
                    {"status": "BLOCKED", "reason": "PAYLOAD_NOT_ALLOWED"}))
    results.append(("owner_gate_fake_denied", dispatch("pc_watchdog", {"ownerApproved": True}) ==
                    {"status": "BLOCKED", "reason": "PAYLOAD_NOT_ALLOWED"}))
    results.append(("shell_denied", dispatch("shell", {"command": "whoami"}).get("status") ==
                    "BLOCKED"))
    results.append(("write_denied", dispatch("write_note", {"text": "abc"}).get("status") ==
                    "BLOCKED"))
    results.append(("unknown_denied", dispatch("pc_unknown", {}).get("status") ==
                    "BLOCKED"))
    results.append(("browser_fields_not_relayed",
                    set(machine) == {"agent", "requested", "result"} and
                    all(s not in json.dumps(machine).lower()
                        for s in ("cookie", "token", "password", "authorization"))))
    good = all(ok for _, ok in results)
    return {"status": "PASS" if good else "FAIL",
            "passed": sum(ok for _, ok in results), "total": len(results),
            "checks": results, "installed_into_running_bridge": False}


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--selftest":
        report = selftest()
        print(json.dumps(report, ensure_ascii=True))
        sys.exit(0 if report["status"] == "PASS" else 1)
    print(json.dumps({"status": "BLOCKED", "reason": "SELFTEST_ONLY"}))
    sys.exit(2)
