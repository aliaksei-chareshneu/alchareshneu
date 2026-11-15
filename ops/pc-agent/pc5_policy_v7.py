"""IMPERION Agent #5 v7: deterministic recovery status and audit-backed advice.

Never executes instructions, invokes a model, reads arbitrary paths,
restarts a worker, changes Defender/startup, deletes data or sends a message.
A recovery plan is a reviewable recommendation, not an action or a diagnosis.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path
from pc5_maintenance import AUDIT_ID, audit_pc, private_root

MAX_JSON = 280
GUI_THRESHOLD_MB = 1024
MODEL_THRESHOLD_MB = 5120


def block(reason: str) -> dict:
    return {"status": "BLOCKED", "mode": "pc5_policy", "reason": reason,
            "changes_applied": 0, "worker_restarted": False}


def interpret_audit(summary: dict) -> list[dict]:
    """Make a small prioritised owner checklist from a vetted audit summary."""
    items = []

    def advise(priority: str, code: str, owner_step: str):
        items.append({"priority": priority, "code": code,
                      "owner_step": owner_step, "auto_action_allowed": False})

    defender = summary.get("defender_status")
    if defender == "AVAILABLE" and summary.get("defender_realtime") is False:
        advise("P0", "DEFENDER_REVIEW", "Review Windows Security status manually; do not disable protections")
    elif defender == "UNAVAILABLE":
        advise("P1", "DEFENDER_NOT_VERIFIED", "Check Windows Security or third-party antivirus manually")

    ram = summary.get("ram_available_mb")
    if isinstance(ram, (int, float)) and not isinstance(ram, bool) and ram < GUI_THRESHOLD_MB:
        advise("P1", "MEMORY_PRESSURE", "Review unused high-memory programs before a GUI pilot")

    disks = summary.get("disks", [])
    if any(isinstance(d, dict) and isinstance(d.get("free_gb"), (int, float))
           and not isinstance(d.get("free_gb"), bool) and d["free_gb"] < 10 for d in disks):
        advise("P1", "LOW_DISK_FREE", "Inspect disk space manually; preserve user files and backups")

    flagged = summary.get("suspicious_candidate_count", 0)
    if isinstance(flagged, int) and not isinstance(flagged, bool) and flagged > 0:
        advise("P1", "UNVERIFIED_CANDIDATES", "Review evidence before treating a process as malicious")

    startup = summary.get("startup_count", 0)
    if isinstance(startup, int) and not isinstance(startup, bool) and startup > 15:
        advise("P2", "STARTUP_REVIEW", "Consider optional startup entries only after owner review")
    return sorted(items, key=lambda x: (x["priority"], x["code"]))


def _never_run(*_args, **_kwargs):
    raise RuntimeError("UNEXPECTED_SUBPROCESS_DENIED")


def operate(payload: object, *, platform: str | None = None, root: Path | None = None,
            memory_reader=None) -> dict:
    if not isinstance(payload, dict) or type(payload.get("mode")) is not str:
        return block("BAD_PAYLOAD")
    try:
        if len(json.dumps(payload, ensure_ascii=True).encode("utf-8")) > MAX_JSON:
            return block("PAYLOAD_TOO_LARGE")
    except (TypeError, ValueError, UnicodeError):
        return block("BAD_PAYLOAD")
    mode = payload["mode"]
    if mode == "continuity_status":
        if set(payload) != {"mode"}:
            return block("FIELDS_NOT_ALLOWED")
        if (sys.platform if platform is None else platform) != "win32":
            return block("WINDOWS_REQUIRED")
        try:
            if memory_reader is None:
                from pc_desktop_v4 import win_memory
                memory_reader = win_memory
            free, total = memory_reader()
        except (OSError, RuntimeError, TypeError, ValueError, AttributeError):
            return block("MEMORY_UNAVAILABLE")
        if type(free) is not int or type(total) is not int or total <= 0 or free < 0 or free > total:
            return block("MEMORY_INVALID")
        return {
            "status": "DONE", "mode": mode, "read_only": True,
            "free_ram_mb": free, "total_ram_mb": total,
            "gui_memory_ready": free >= GUI_THRESHOLD_MB,
            "local_4b_memory_ready": free >= MODEL_THRESHOLD_MB,
            "cloud_worker_alive": "ONLY_IF_RETURNED_FROM_EXISTING_BROWSER_QUEUE",
            "recovery_after_reboot": "UNVERIFIED",
            "can_restart_worker": False, "worker_restarted": False,
            "auto_close_apps": False, "model_may_authorize_actions": False,
            "changes_applied": 0,
        }
    if mode != "maintenance_plan" or set(payload) != {"mode", "audit_id"}:
        return block("FIELDS_NOT_ALLOWED")
    ident = payload["audit_id"]
    if type(ident) is not str or not AUDIT_ID.fullmatch(ident):
        return block("INVALID_AUDIT_ID")
    if (sys.platform if platform is None else platform) != "win32":
        return block("WINDOWS_REQUIRED")
    try:
        folder = Path(root) if root is not None else private_root()
        receipt = folder / (ident + ".receipt.json")
        # Never start a scan: only independently check an existing SHA receipt.
        if receipt.is_symlink() or not receipt.is_file():
            return block("AUDIT_NOT_VERIFIED")
        script = Path(__file__).resolve().with_name("pc5_audit.ps1")
        saved = audit_pc(ident, root=folder, runner=_never_run, script=script)
        if saved.get("status") != "DONE" or saved.get("replay") is not True:
            return block("AUDIT_NOT_VERIFIED")
        checklist = interpret_audit(saved["summary"])
    except (OSError, RuntimeError, ValueError, KeyError, TypeError):
        return block("AUDIT_READBACK_FAILED")
    return {
        "status": "REVIEW_REQUIRED" if checklist else "DONE", "mode": mode,
        "audit_id": ident, "audit_sha256": saved["sha256"],
        "recommendations": checklist, "auto_remediation": False,
        "changes_applied": 0, "worker_restarted": False,
        "source": "INDEPENDENT_REPLAY_OF_LOCAL_SHA256_RECEIPT",
        "scope": "DETERMINISTIC_OWNER_REVIEW_ONLY",
    }
