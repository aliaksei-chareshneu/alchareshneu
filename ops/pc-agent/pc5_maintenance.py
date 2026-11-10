"""Review-only Agent #5 Windows audit/remediation gate for the EXISTING Browser Bridge.

Deploy beside existing browser_bridge_adapter.py only after scoped owner GO.
Queue must remain the existing Supabase browser_jobs -> Browser Bridge route.
No model-selected shell, external URL, privileged scan, or mutation is supported.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from typing import Callable

AUDIT_ID = re.compile(r"\AIMP-PC5-[A-Z0-9-]{4,64}\Z")
ACTION_IDS = {
    "startup.comet": ("Comet", "Optional", "Re-enable in Windows Startup Apps"),
    "startup.discord": ("Discord", "Optional", "Re-enable in Windows Startup Apps"),
    "startup.teams": ("Teams", "Optional", "Re-enable in Windows Startup Apps"),
    "startup.viber": ("Viber", "Optional", "Re-enable in Windows Startup Apps"),
    "startup.edge_autolaunch": ("Edge AutoLaunch", "Check browser dependence", "Re-enable in Windows Startup Apps"),
    "startup.winzip_preloader": ("WinZip Preloader", "Optional", "Re-enable in Windows Startup Apps"),
}
SCRIPT_NAME = "pc5_audit.ps1"
MAX_RESULT_BYTES = 4096
MAX_AUDIT_BYTES = 1024 * 1024
MAX_ACTIONS = 8
MIN_AUDIT_FREE_MB = 1536  # fail closed before expensive collection
AUDIT_SUBPROCESS_TIMEOUT_S = 60


def block(reason: str) -> dict:
    return {"status": "BLOCKED", "reason": reason}


def strict_payload(payload: object) -> tuple[str, str | None]:
    if not isinstance(payload, dict) or not isinstance(payload.get("mode"), str):
        raise ValueError("PAYLOAD_NOT_OBJECT")
    try:
        if len(json.dumps(payload, ensure_ascii=True)) > 1024:
            raise ValueError("PAYLOAD_TOO_LARGE")
    except (TypeError, OverflowError):
        raise ValueError("BAD_PAYLOAD") from None
    mode = payload["mode"]
    if mode == "audit_pc":
        if set(payload) != {"mode", "audit_id"}:
            raise ValueError("FIELDS_NOT_ALLOWED")
        ident = payload["audit_id"]
        if not isinstance(ident, str) or not AUDIT_ID.fullmatch(ident):
            raise ValueError("INVALID_AUDIT_ID")
        return mode, ident
    if mode == "remediate_pc":
        if set(payload) != {"mode", "dry_run", "action_ids"}:
            raise ValueError("FIELDS_NOT_ALLOWED")
        if payload["dry_run"] is not True:
            raise ValueError("OWNER_GO_AND_IMPLEMENTATION_REQUIRED")
        acts = payload["action_ids"]
        if not isinstance(acts, list) or len(acts) > MAX_ACTIONS or any(
            not isinstance(a, str) or a not in ACTION_IDS for a in acts
        ) or len(acts) != len(set(acts)):
            raise ValueError("ACTION_NOT_ALLOWLISTED_OR_DUPLICATED")
        return mode, None
    raise ValueError("MODE_NOT_ALLOWED")


def private_root(env: dict | None = None) -> Path:
    env = os.environ if env is None else env
    local = env.get("LOCALAPPDATA")
    if not local or not Path(local).is_absolute():
        raise ValueError("WINDOWS_PRIVATE_ROOT_UNAVAILABLE")
    return Path(local) / "IMPERION" / "Agent5" / "audits"


def checked_directory(path: Path) -> Path:
    # Reject junction/reparse redirects as well as symbolic links. Do not follow
    # an attacker-created directory into a project, browser profile or cloud sync.
    cur = path
    while cur != cur.parent:
        if cur.exists() and (cur.is_symlink() or (hasattr(cur, "is_junction") and cur.is_junction())):
            raise ValueError("PRIVATE_FOLDER_REDIRECT_DENIED")
        cur = cur.parent
    path.mkdir(parents=True, exist_ok=True)
    return path


def checked_file(root: Path, name: str) -> Path:
    if not re.fullmatch(r"audit-pc-IMP-PC5-[A-Z0-9-]{4,64}\.json", name):
        raise ValueError("AUDIT_FILE_NAME_DENIED")
    out = root / name
    if out.is_symlink() or (hasattr(out, "is_junction") and out.is_junction()):
        raise ValueError("AUDIT_FILE_REDIRECT_DENIED")
    if not out.is_file() or out.stat().st_size > MAX_AUDIT_BYTES:
        raise ValueError("AUDIT_FILE_MISSING_OR_TOO_LARGE")
    if not out.resolve().is_relative_to(root.resolve()):
        raise ValueError("AUDIT_PATH_OUTSIDE_PRIVATE_ROOT")
    return out


def safe_summary(doc: dict) -> dict:
    # Exact field selection: never return user paths, command lines, browser URLs,
    # registry values, device serial numbers, security logs or user documents.
    data = doc.get("summary")
    if not isinstance(data, dict):
        raise ValueError("SUMMARY_MISSING")
    numeric = ("ram_total_mb", "ram_available_mb", "cpu_load_pct",
               "chrome_process_count", "chrome_working_set_mb", "startup_count",
               "scheduled_task_count", "suspicious_candidate_count")
    summary = {}
    for key in numeric:
        value = data.get(key)
        if not isinstance(value, (int, float)) or isinstance(value, bool) or not (0 <= value <= 1000000):
            raise ValueError("SUMMARY_FIELD_INVALID")
        summary[key] = value
    if summary["ram_available_mb"] > summary["ram_total_mb"]:
        raise ValueError("RAM_METRICS_INCONSISTENT")
    defender = data.get("defender")
    if not isinstance(defender, dict) or defender.get("status") not in ("AVAILABLE", "UNAVAILABLE"):
        raise ValueError("DEFENDER_SCHEMA_INVALID")
    summary["defender_status"] = defender["status"]
    summary["defender_realtime"] = defender.get("realtime") if defender.get("realtime") in (True, False, None) else None
    summary["defender_detections"] = defender.get("detections_count") if isinstance(defender.get("detections_count"), int) else None
    disks = data.get("disks")
    if not isinstance(disks, list) or len(disks) > 32:
        raise ValueError("DISKS_INVALID")
    summary["disks"] = []
    for disk in disks:
        if not isinstance(disk, dict):
            raise ValueError("DISKS_INVALID")
        label, free = disk.get("drive"), disk.get("free_gb")
        if not isinstance(label, str) or not re.fullmatch(r"[A-Z]:", label) or not isinstance(free, (int, float)):
            raise ValueError("DISKS_INVALID")
        summary["disks"].append({"drive": label, "free_gb": round(free, 1)})
    return summary


def _audit_receipt(path: Path, file_sha256: str, summary: dict, replay: bool) -> dict:
    return {
        "status": "DONE", "mode": "audit_pc", "scope": "READ_ONLY_PRIVATE_LOCAL_JSON",
        "file_name": path.name, "sha256": file_sha256,
        "summary": summary, "replay": replay, "cleanup_performed": False,
        "owner_go_required_for_changes": True,
        "no_public_process_paths": True,
    }


def audit_pc(ident: str, *, root: Path, runner: Callable, script: Path) -> dict:
    checked_directory(root)
    filename = "audit-pc-" + ident + ".json"
    receipt_path = root / (ident + ".receipt.json")
    existing = root / filename
    if existing.exists() and not receipt_path.exists():
        raise ValueError("AUDIT_SNAPSHOT_WITHOUT_RECEIPT")
    if receipt_path.exists():
        if receipt_path.is_symlink() or receipt_path.stat().st_size > MAX_RESULT_BYTES:
            raise ValueError("RECEIPT_UNSAFE")
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        payload = checked_file(root, filename).read_bytes()
        sha = hashlib.sha256(payload).hexdigest()
        if receipt.get("sha256") != sha:
            raise ValueError("REPLAY_EVIDENCE_MISMATCH")
        doc = json.loads(payload.decode("utf-8-sig"))
        if doc.get("case_id") != "IMP-PC5-MAINT-20261110" or doc.get("audit_id") != ident:
            raise ValueError("AUDIT_ID_MISMATCH")
        return _audit_receipt(existing, sha, safe_summary(doc), True)
    lock = root / (ident + ".lock")
    if lock.exists():
        raise ValueError("AUDIT_ALREADY_RUNNING_OR_STALE_LOCK")
    fd = os.open(str(lock), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    try:
        if not script.is_file() or script.is_symlink() or script.name != SCRIPT_NAME:
            raise ValueError("TRUSTED_AUDIT_SCRIPT_MISSING")
        if not script.resolve().is_relative_to(Path(__file__).resolve().parent):
            raise ValueError("AUDIT_SCRIPT_OUTSIDE_INSTALL_DIR")
        try:
            result = runner([
                "powershell.exe", "-NoProfile", "-NonInteractive", "-File",
                str(script), "-AuditId", ident
            ], capture_output=True, text=True, timeout=AUDIT_SUBPROCESS_TIMEOUT_S, check=False)
        except subprocess.TimeoutExpired:
            raise ValueError("AUDIT_TIMEOUT_NO_AUTO_RETRY") from None
        if result.returncode != 0 or len(result.stdout) > MAX_RESULT_BYTES:
            raise ValueError("LOCAL_AUDIT_EXECUTION_FAILED")
        line = result.stdout.strip()
        readback = json.loads(line)
        if not isinstance(readback, dict) or readback.get("status") != "LOCAL_AUDIT_SAVED":
            raise ValueError("LOCAL_AUDIT_NOT_SAVED")
        if readback.get("file_name") != filename:
            raise ValueError("AUDIT_NAME_MISMATCH")
        raw = checked_file(root, filename).read_bytes()
        sha = hashlib.sha256(raw).hexdigest()
        if sha != readback.get("sha256"):
            raise ValueError("AUDIT_HASH_MISMATCH")
        doc = json.loads(raw.decode("utf-8-sig"))
        if doc.get("case_id") != "IMP-PC5-MAINT-20261110" or doc.get("audit_id") != ident:
            raise ValueError("AUDIT_ID_MISMATCH")
        clean = safe_summary(doc)
        receipt = {"sha256": sha, "file": filename, "status": "DONE"}
        temp_receipt = root / (ident + ".receipt.tmp")
        temp_receipt.write_text(json.dumps(receipt, sort_keys=True), encoding="utf-8")
        os.replace(temp_receipt, receipt_path)
        return _audit_receipt(root / filename, sha, clean, False)
    finally:
        lock.unlink(missing_ok=True)


def remediate_preview(actions: list[str]) -> dict:
    return {
        "status": "DRY_RUN_ONLY", "mode": "remediate_pc",
        "changes_applied": 0, "reboots": 0,
        "owner_go_required": True, "execution_handler_installed": False,
        "actions": [
            {"id": action, "target": ACTION_IDS[action][0], "risk": ACTION_IDS[action][1],
             "rollback": ACTION_IDS[action][2],
             "state": "PROPOSED_NOT_EXECUTED", "requires_fresh_baseline": True}
            for action in actions
        ]
    }


def operate(payload: object, *, platform: str | None = None,
            runner: Callable = subprocess.run, root: Path | None = None,
            script: Path | None = None, memory_reader: Callable | None = None) -> dict:
    try:
        mode, ident = strict_payload(payload)
        if mode == "remediate_pc":
            return remediate_preview(payload["action_ids"])
        if (sys.platform if platform is None else platform) != "win32":
            return block("WINDOWS_REQUIRED")
        if memory_reader is None:
            from pc_desktop_v4 import win_memory
            memory_reader = win_memory
        try:
            free_mb, total_mb = memory_reader()
            if (not isinstance(free_mb, int) or not isinstance(total_mb, int)
                or total_mb <= 0 or free_mb < 0 or free_mb > total_mb):
                return block("AUDIT_MEMORY_PREFLIGHT_UNAVAILABLE")
        except (OSError, TypeError, ValueError, RuntimeError, AttributeError):
            return block("AUDIT_MEMORY_PREFLIGHT_UNAVAILABLE")
        if free_mb < MIN_AUDIT_FREE_MB:
            return block("AUDIT_LOW_MEMORY_NO_EXECUTION")
        path = private_root() if root is None else root
        source = Path(__file__).resolve().with_name(SCRIPT_NAME) if script is None else script
        return audit_pc(ident, root=path, runner=runner, script=source)
    except (ValueError, OSError, RuntimeError, subprocess.SubprocessError, UnicodeError, KeyError, TypeError) as exc:
        # No filesystem paths, Defender errors, command lines or user data leave the host.
        reason = str(exc)
        if reason not in {
            "PAYLOAD_NOT_OBJECT", "PAYLOAD_TOO_LARGE", "BAD_PAYLOAD", "FIELDS_NOT_ALLOWED",
            "INVALID_AUDIT_ID", "OWNER_GO_AND_IMPLEMENTATION_REQUIRED",
            "ACTION_NOT_ALLOWLISTED_OR_DUPLICATED", "MODE_NOT_ALLOWED", "WINDOWS_REQUIRED",
            "WINDOWS_PRIVATE_ROOT_UNAVAILABLE", "PRIVATE_FOLDER_REDIRECT_DENIED",
            "AUDIT_FILE_NAME_DENIED", "AUDIT_FILE_REDIRECT_DENIED",
            "AUDIT_FILE_MISSING_OR_TOO_LARGE", "AUDIT_PATH_OUTSIDE_PRIVATE_ROOT",
            "SUMMARY_MISSING", "SUMMARY_FIELD_INVALID", "RAM_METRICS_INCONSISTENT",
            "DEFENDER_SCHEMA_INVALID", "DISKS_INVALID", "RECEIPT_UNSAFE",
            "REPLAY_EVIDENCE_MISMATCH", "AUDIT_ALREADY_RUNNING_OR_STALE_LOCK",
            "TRUSTED_AUDIT_SCRIPT_MISSING", "AUDIT_SCRIPT_OUTSIDE_INSTALL_DIR",
            "LOCAL_AUDIT_EXECUTION_FAILED", "LOCAL_AUDIT_NOT_SAVED", "AUDIT_NAME_MISMATCH",
            "AUDIT_HASH_MISMATCH", "AUDIT_ID_MISMATCH", "AUDIT_SNAPSHOT_WITHOUT_RECEIPT",
            "AUDIT_MEMORY_PREFLIGHT_UNAVAILABLE", "AUDIT_LOW_MEMORY_NO_EXECUTION",
            "AUDIT_TIMEOUT_NO_AUTO_RETRY"
        }:
            reason = "AUDIT_RUNTIME_BLOCKED"
        return block(reason)