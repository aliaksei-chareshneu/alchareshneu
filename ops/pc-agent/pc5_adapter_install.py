"""Narrow, reversible local adapter update for the EXISTING Agent5 Browser Bridge.

The default is inspection only. An explicit, separate owner-authorized local
deployment is required to use --apply. This script NEVER restarts the worker,
merges a PR, edits startup/Defender, or performs Windows remediation.
Remote queue payloads cannot invoke this installer.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import time

OLD = '''        # PC5_AUDIT_ONLY_20261110: scoped owner GO; fixed, read-only mode.
        if payload.get("mode") == "audit_pc":
            from pc5_maintenance import operate as run_pc5_fixed_audit
            return {"agent": "IMPERION_AGENT5_RESTRICTED",
                    "requested": "pc_operator",
                    "result": run_pc5_fixed_audit(payload)}
'''

NEW = '''        # PC5_FIXED_READONLY_AND_PREVIEW_20261111: audit + dry-run ONLY.
        if payload.get("mode") in ("audit_pc", "remediate_pc"):
            from pc5_maintenance import operate as run_pc5_fixed_maintenance
            return {"agent": "IMPERION_AGENT5_RESTRICTED",
                    "requested": "pc_operator",
                    "result": run_pc5_fixed_maintenance(payload)}
'''

# Exact review-branch core object (GitHub blob SHA-1) required on the host.
PINNED_CORE_BLOB = "685f636b2e757760e8681dbad4e56c49354b25a0"
APPROVAL = "APPROVE_DRY_RUN_ROUTE_ONLY"  # Not authentication; owner GO is external.


def patch_text(source: str) -> tuple[str, bool]:
    """Patch just the existing reviewed audit route, preserving other modes."""
    if not isinstance(source, str):
        raise ValueError("ADAPTER_NOT_TEXT")
    if source.count(NEW) == 1 and source.count(OLD) == 0:
        return source, False
    if (source.count(OLD) != 1 or NEW in source or
        source.count('def dispatch(action, payload=None):') != 1 or
        source.count('if action == "pc_operator":') != 1):
        raise ValueError("ADAPTER_ANCHOR_CHANGED")
    return source.replace(OLD, NEW, 1), True


def _blob_sha(data: bytes) -> str:
    """Git-compatible blob SHA, independent of an installed git executable."""
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def _safe_file(file: Path) -> None:
    # Do not trust a redirected path; protect workspace, browser profiles etc.
    cur = file
    while cur != cur.parent:
        if cur.exists() and (cur.is_symlink() or
                             (hasattr(cur, "is_junction") and cur.is_junction())):
            raise ValueError("REPARSE_PATH_DENIED")
        cur = cur.parent


def inspect(adapter: Path, core: Path) -> dict:
    _safe_file(adapter)
    _safe_file(core)
    if not adapter.is_file() or not core.is_file():
        raise ValueError("INSTALLED_ADAPTER_OR_CORE_MISSING")
    raw = adapter.read_bytes()
    source = raw.decode("utf-8-sig")
    patched, would_change = patch_text(source)
    core_sha = _blob_sha(core.read_bytes())
    if core_sha != PINNED_CORE_BLOB:
        raise ValueError("UNREVIEWED_CORE_REJECTED")
    return {"status": "READY_FOR_OWNER_GO", "would_change": would_change,
            "adapter_sha256": hashlib.sha256(raw).hexdigest(),
            "core_blob_verified": True, "change_kind": "ADD_DRYRUN_ROUTE_ONLY",
            "windows_settings_changed": False,
            "current_worker_restarted": False,
            "patched_text": patched}


def apply(adapter: Path, core: Path, backup_root: Path, *,
          expected_adapter_sha256: str, owner_approval: str) -> dict:
    if owner_approval != APPROVAL:
        raise ValueError("SEPARATE_OWNER_GO_REQUIRED")
    review = inspect(adapter, core)
    if review["adapter_sha256"] != expected_adapter_sha256:
        raise ValueError("ADAPTER_CONCURRENT_CHANGE")
    if not review["would_change"]:
        return {"status": "ALREADY_PATCHED", "new_sha256": expected_adapter_sha256,
                "worker_restart_required": False}
    _safe_file(backup_root)
    backup_root.mkdir(parents=True, exist_ok=True)
    _safe_file(backup_root)
    backup = backup_root / ("pc5_adapter." + time.strftime("%Y%m%dT%H%M%S") + ".bak")
    _safe_file(backup)
    if backup.exists():
        raise ValueError("BACKUP_COLLISION")
    shutil.copy2(adapter, backup)
    candidate = adapter.with_suffix(adapter.suffix + ".pc5.pending")
    _safe_file(candidate)
    if candidate.exists():
        raise ValueError("PENDING_FILE_COLLISION")
    try:
        with candidate.open("x", encoding="utf-8", newline="\n") as handle:
            handle.write(review["patched_text"])
        compile(review["patched_text"], str(adapter.name), "exec")
        os.replace(candidate, adapter)
        digest = hashlib.sha256(adapter.read_bytes()).hexdigest()
        if digest == expected_adapter_sha256:
            raise ValueError("ADAPTER_NOT_CHANGED")
    except Exception:
        candidate.unlink(missing_ok=True)
        # Use the verified backup; never touch another user's files.
        shutil.copy2(backup, adapter)
        raise
    return {"status": "LOCAL_DRYRUN_ROUTE_STAGED", "old_sha256": expected_adapter_sha256,
            "new_sha256": digest, "backup_filename": backup.name,
            "worker_restart_required": True, "windows_settings_changed": False}


def main() -> int:
    cli = argparse.ArgumentParser()
    cli.add_argument("--apply", action="store_true", help="Owner-GO only, no restart")
    cli.add_argument("--expected-adapter-sha256", default="")
    cli.add_argument("--owner-approval", default="")
    args = cli.parse_args()
    adapter = Path.home() / "ChatGPT-Workspace" / "_shared" / "pc-agent" / "browser_bridge_adapter.py"
    core = adapter.with_name("pc5_maintenance.py")
    backups = Path(os.environ.get("LOCALAPPDATA", "")) / "IMPERION" / "Agent5" / "backups"
    try:
        if args.apply:
            output = apply(adapter, core, backups,
                           expected_adapter_sha256=args.expected_adapter_sha256,
                           owner_approval=args.owner_approval)
        else:
            output = inspect(adapter, core)
        # Never print private paths, code, user document names or tokens.
        output.pop("patched_text", None)
        print(json.dumps(output, sort_keys=True))
        return 0
    except (ValueError, OSError, UnicodeError, SyntaxError) as err:
        known = {"ADAPTER_NOT_TEXT", "ADAPTER_ANCHOR_CHANGED", "REPARSE_PATH_DENIED",
                 "INSTALLED_ADAPTER_OR_CORE_MISSING", "UNREVIEWED_CORE_REJECTED",
                 "SEPARATE_OWNER_GO_REQUIRED", "ADAPTER_CONCURRENT_CHANGE",
                 "BACKUP_COLLISION", "PENDING_FILE_COLLISION", "ADAPTER_NOT_CHANGED"}
        reason = str(err) if str(err) in known else "LOCAL_INSTALL_BLOCKED"
        print(json.dumps({"status": "BLOCKED", "reason": reason}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
