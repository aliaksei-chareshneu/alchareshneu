"""OFFLINE, post-GO-only reversible HKCU startup remediation for existing Agent5.

NOT routed by Browser Bridge, DEV comments, Supabase, or an LLM. A trusted
operator who has separately verified precise owner GO may call this module
locally; merely passing an approval dict is NOT proof of owner identity.
No process termination, Windows services, HKLM, Defender, caches or files.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
from typing import Any

from pc5_maintenance import (
    AUDIT_ID, _verified_preview_baseline, checked_directory, block
)

CASE_ID = "IMP-PC5-MAINT-20261110"
HKCU_RUN = r"Software\Microsoft\Windows\CurrentVersion\Run"
# Single-user, reversible startup entries ONLY. Do not broaden to glob/paths.
SUPPORTED = {
    "startup.comet": "Comet",
    "startup.discord": "Discord",
    "startup.teams": "Teams",
    "startup.viber": "Viber",
}
WIN_REG_SZ = 1
WIN_REG_EXPAND_SZ = 2
APPROVAL_SOURCE = "TRUSTED_OPERATOR_AFTER_EXPLICIT_OWNER_GO"


def _sha(obj: dict[str, Any]) -> str:
    raw = json.dumps(obj, sort_keys=True, separators=(",", ":"),
                     ensure_ascii=True).encode("ascii")
    return hashlib.sha256(raw).hexdigest()


class HKCURunRegistry:
    def __init__(self) -> None:
        if sys.platform != "win32":
            raise ValueError("WINDOWS_REQUIRED")
        import winreg
        self.wr = winreg

    def get(self, name: str) -> tuple[str, int]:
        with self.wr.OpenKey(self.wr.HKEY_CURRENT_USER, HKCU_RUN, 0,
                             self.wr.KEY_QUERY_VALUE) as key:
            value, kind = self.wr.QueryValueEx(key, name)
        return value, kind

    def remove(self, name: str) -> None:
        with self.wr.OpenKey(self.wr.HKEY_CURRENT_USER, HKCU_RUN, 0,
                             self.wr.KEY_SET_VALUE) as key:
            self.wr.DeleteValue(key, name)

    def restore(self, name: str, value: str, kind: int) -> None:
        with self.wr.OpenKey(self.wr.HKEY_CURRENT_USER, HKCU_RUN, 0,
                             self.wr.KEY_SET_VALUE) as key:
            self.wr.SetValueEx(key, name, 0, kind, value)


def _present(snapshot: dict, entry: str) -> bool:
    # Recorded source must have included exact HKCU startup name.
    rows = snapshot.get("registry_autostart", [])
    return isinstance(rows, list) and any(
        isinstance(x, dict)
        and x.get("name", "").casefold() == entry.casefold()
        and str(x.get("key", "")).casefold().startswith("hkcu:")
        for x in rows
    )


def prepare(audit_id: str, action_id: str, *, audit_root: Path,
            registry: Any = None) -> dict:
    """No changes. Returns only hashes and fixed labels, not Run command lines."""
    if not isinstance(audit_id, str) or not AUDIT_ID.fullmatch(audit_id):
        raise ValueError("INVALID_AUDIT_ID")
    if action_id not in SUPPORTED:
        raise ValueError("ACTION_NOT_EXECUTABLE")
    snapshot, snapshot_sha = _verified_preview_baseline(audit_root, audit_id)
    name = SUPPORTED[action_id]
    if not _present(snapshot, name):
        raise ValueError("BASELINE_MISSING_HKCU_TARGET")
    agent = HKCURunRegistry() if registry is None else registry
    value, kind = agent.get(name)
    if not isinstance(value, str) or kind not in (WIN_REG_SZ, WIN_REG_EXPAND_SZ):
        raise ValueError("TARGET_TYPE_NOT_SUPPORTED")
    value_sha = _sha({"name": name, "kind": kind, "value": value})
    plan_id = _sha({"case_id": CASE_ID, "action": action_id,
                    "audit_sha": snapshot_sha, "entry_sha": value_sha})
    return {
        "status": "GO_REQUIRED", "case_id": CASE_ID, "audit_id": audit_id,
        "action_id": action_id, "target": name,
        "audit_sha256": snapshot_sha, "target_sha256": value_sha,
        "plan_id": plan_id, "expected_released_ram_mb": None,
        "does_not_close_running_processes": True,
        "effect": "DISABLE_THIS_USER_AUTORUN_ON_NEXT_LOGIN_ONLY",
        "rollback": "RESTORE_EXACT_HKCU_RUN_VALUE_FROM_PRIVATE_RECEIPT",
        "no_public_command_value": True,
    }


def _approval_ok(approval: object, plan_id: str) -> None:
    if not isinstance(approval, dict):
        raise ValueError("TRUSTED_OPERATOR_GO_MISSING")
    if (set(approval) != {"source", "go", "plan_id", "expires_utc"}
        or approval.get("source") != APPROVAL_SOURCE
        or approval.get("go") is not True
        or approval.get("plan_id") != plan_id):
        raise ValueError("TRUSTED_OPERATOR_GO_MISSING")
    try:
        expires = datetime.fromisoformat(approval["expires_utc"])
        now = datetime.now(timezone.utc)
        if (expires.tzinfo is None or expires <= now or
            (expires - now).total_seconds() > 86400):
            raise ValueError
    except (TypeError, ValueError, OverflowError):
        raise ValueError("GO_EXPIRED_OR_INVALID") from None


def _ensure_private(path: Path) -> None:
    checked_directory(path)
    # checked_directory rejects junctions and symlinks on the whole path.


def _receipt(root: Path, plan_id: str) -> Path:
    return root / ("startup-" + plan_id + ".private.json")


def apply_approved(audit_id: str, action_id: str, *, audit_root: Path,
                   approval: object, registry: Any = None) -> dict:
    """Local only; after explicit user GO checked by the trusted operator."""
    plan = prepare(audit_id, action_id, audit_root=audit_root,
                   registry=registry)
    _approval_ok(approval, plan["plan_id"])
    store = audit_root / "remediations"
    _ensure_private(store)
    receipt = _receipt(store, plan["plan_id"])
    if receipt.exists():
        if receipt.is_symlink():
            raise ValueError("RECEIPT_REDIRECT_DENIED")
        record = json.loads(receipt.read_text(encoding="utf-8"))
        if record.get("plan_id") != plan["plan_id"]:
            raise ValueError("RECEIPT_TAMPERED")
        if record.get("status") == "APPLIED":
            return {"status":"ALREADY_APPLIED", "plan_id":plan["plan_id"],
                    "changes_applied":0}
        raise ValueError("RECEIPT_REQUIRES_MANUAL_RECONCILIATION")
    agent = HKCURunRegistry() if registry is None else registry
    name = SUPPORTED[action_id]
    original, kind = agent.get(name)
    if _sha({"name":name,"kind":kind,"value":original}) != plan["target_sha256"]:
        raise ValueError("TARGET_CHANGED_SINCE_PREVIEW")
    # The original Run command may contain secrets. Keep backup local and
    # NEVER return it to cloud, logger, GitHub or chat.
    record = {
        "schema":"PC5-LOCAL-STARTUP-1", "status":"PREPARED",
        "case_id":CASE_ID, "plan_id":plan["plan_id"],
        "action":action_id, "entry":name, "kind":kind,
        "original":original, "target_sha256":plan["target_sha256"],
        "audit_sha256":plan["audit_sha256"],
    }
    fd = os.open(receipt, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as out:
        json.dump(record, out, ensure_ascii=True)
        out.flush()
        os.fsync(out.fileno())
    try:
        agent.remove(name)
        try:
            agent.get(name)
            raise ValueError("AUTORUN_STILL_PRESENT")
        except FileNotFoundError:
            pass
        record["status"] = "APPLIED"
        temp = receipt.with_suffix(".tmp")
        with temp.open("x", encoding="utf-8") as out:
            json.dump(record, out, ensure_ascii=True)
            out.flush()
            os.fsync(out.fileno())
        os.replace(temp, receipt)
    except Exception:
        # Immediate rollback on any failed readback, before reporting failure.
        try:
            agent.restore(name, original, kind)
        finally:
            # Preserve PREPARED receipt for forensic reconciliation.
            pass
        raise
    return {"status":"APPLIED", "action_id":action_id,
            "plan_id":plan["plan_id"], "changes_applied":1,
            "running_processes_closed":0, "windows_rebooted":False,
            "requires_next_login_for_effect":True,
            "rollback_receipt_saved_privately":True}


def rollback_approved(plan_id: str, *, audit_root: Path,
                      approval: object, registry: Any = None) -> dict:
    """Exact reversal, not general registry edit. Also requires owner GO."""
    _approval_ok(approval, plan_id)
    if not isinstance(plan_id, str) or len(plan_id) != 64 or any(
        ch not in "0123456789abcdef" for ch in plan_id):
        raise ValueError("INVALID_PLAN_ID")
    receipt = _receipt(audit_root / "remediations", plan_id)
    if not receipt.is_file() or receipt.is_symlink():
        raise ValueError("RECEIPT_NOT_FOUND_OR_REDIRECTED")
    record = json.loads(receipt.read_text(encoding="utf-8"))
    if (record.get("plan_id") != plan_id or
        record.get("schema") != "PC5-LOCAL-STARTUP-1" or
        record.get("entry") != SUPPORTED.get(record.get("action")) or
        record.get("status") != "APPLIED"):
        raise ValueError("RECEIPT_TAMPERED")
    entry, original, kind = record["entry"], record["original"], record["kind"]
    if _sha({"name":entry,"kind":kind,"value":original}) != record.get("target_sha256"):
        raise ValueError("RECEIPT_TAMPERED")
    agent = HKCURunRegistry() if registry is None else registry
    try:
        agent.get(entry)
        raise ValueError("TARGET_CHANGED_SINCE_APPLY")
    except FileNotFoundError:
        pass
    agent.restore(entry, original, kind)
    value, newkind = agent.get(entry)
    if value != original or newkind != kind:
        raise ValueError("ROLLBACK_READBACK_FAILED")
    record["status"] = "ROLLED_BACK"
    temp = receipt.with_suffix(".tmp")
    with temp.open("x", encoding="utf-8") as out:
        json.dump(record, out, ensure_ascii=True)
        out.flush()
        os.fsync(out.fileno())
    os.replace(temp, receipt)
    return {"status":"ROLLED_BACK", "plan_id":plan_id,
            "restored_exact_original_value":True, "changes_applied":1}


def safe_result(operation, *args, **kwargs) -> dict:
    try:
        return operation(*args, **kwargs)
    except Exception as exc:
        # Never leak original registry value, path or environment information.
        reasons = {"INVALID_AUDIT_ID","ACTION_NOT_EXECUTABLE",
                   "BASELINE_MISSING_HKCU_TARGET","TARGET_TYPE_NOT_SUPPORTED",
                   "TRUSTED_OPERATOR_GO_MISSING","GO_EXPIRED_OR_INVALID",
                   "RECEIPT_REDIRECT_DENIED","RECEIPT_TAMPERED",
                   "RECEIPT_REQUIRES_MANUAL_RECONCILIATION",
                   "TARGET_CHANGED_SINCE_PREVIEW","AUTORUN_STILL_PRESENT",
                   "INVALID_PLAN_ID","RECEIPT_NOT_FOUND_OR_REDIRECTED",
                   "TARGET_CHANGED_SINCE_APPLY","ROLLBACK_READBACK_FAILED"}
        return block(str(exc) if str(exc) in reasons else "REMEDIATION_BLOCKED_PRIVATE_ERROR")
