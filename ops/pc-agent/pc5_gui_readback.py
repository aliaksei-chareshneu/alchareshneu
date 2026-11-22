"""Independent read-only acceptance checker for existing Agent #5 GUI pilot.

Intentionally does not import pc5_gui_pilot, call a model, open a GUI, touch
Supabase, or accept arbitrary paths from remote commands. This checks actual
sandbox file bytes and the recorded local approval and receipt separately.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "pc_task_data"
TASK_RE = re.compile(r"^A5-GUI-[A-Z0-9-]{8,32}$")
FIXTURE = b"A5 GUI PILOT"
MAX_BYTES = 4096


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_exact(path: Path, max_size: int = MAX_BYTES) -> bytes:
    for candidate in (path, path.parent):
        if candidate.is_symlink() or (hasattr(candidate, "is_junction") and candidate.is_junction()):
            raise ValueError("UNSAFE_FILE_OR_DIRECTORY_LINK")
    if not path.is_file() or not 0 < path.stat().st_size <= max_size or path.stat().st_nlink != 1:
        raise ValueError("RECEIPT_OR_FILE_MISSING_OR_UNSAFE")
    raw = path.read_bytes()
    if len(raw) != path.stat().st_size:
        raise ValueError("FILE_CHANGED_DURING_CHECK")
    return raw


def verify_task(task_id: str, *, root: Path = ROOT, approvals: Path | None = None) -> dict:
    if not isinstance(task_id, str) or not TASK_RE.fullmatch(task_id):
        return {"status": "BLOCKED", "reason": "INVALID_TASK_ID"}
    root = Path(root)
    try:
        # No symlinked root, inbox, work or receipts; no arbitrary input files.
        if root.is_symlink() or (hasattr(root, "is_junction") and root.is_junction()):
            raise ValueError("UNSAFE_WORKSPACE_ROOT")
        inbox = read_exact(root / "inbox" / (task_id + ".txt"), 1024)
        if inbox != FIXTURE:
            raise ValueError("SOURCE_FIXTURE_CHANGED")
        saved = read_exact(root / "gui_work" / (task_id + ".txt"))
        try:
            normalized = saved.decode("utf-8-sig").replace("\r\n", "\n")
        except UnicodeDecodeError as e:
            raise ValueError("SAVED_DATA_NOT_UTF8") from e
        if normalized != "A5 GUI PILOT\nA5 GUI SAVED " + task_id:
            raise ValueError("SAVED_CONTENT_MISMATCH")
        r = read_exact(root / "receipts" / (task_id + ".gui.json"))
        body = json.loads(r)
        if not isinstance(body, dict):
            raise ValueError("RECEIPT_TYPE_INVALID")
        fields = {"schema", "task_id", "app", "action", "source_sha256", "output_sha256",
                  "output_bytes", "approval_sha256", "approval_ref", "window_verified",
                  "verified_at", "status"}
        if set(body) != fields:
            raise ValueError("RECEIPT_SCHEMA_INVALID")
        if (body["schema"] != "imperion.pc5.gui_pilot.v1" or body["task_id"] != task_id or
                body["app"] != "notepad" or body["action"] != "append_marker_save" or
                body["status"] != "DONE" or body["window_verified"] is not True or
                body["source_sha256"] != digest(FIXTURE) or body["output_sha256"] != digest(saved) or
                type(body["output_bytes"]) is not int or body["output_bytes"] != len(saved)):
            raise ValueError("RECEIPT_CONTENT_MISMATCH")
        if approvals is None:
            raise ValueError("LOCAL_APPROVAL_DIRECTORY_REQUIRED")
        claim = read_exact(Path(approvals) / (task_id + ".claimed"), 1300)
        if body["approval_sha256"] != digest(claim):
            raise ValueError("LOCAL_APPROVAL_MISMATCH")
        return {"status": "DONE", "task_id": task_id, "mode": "gui_readback_independent",
                "source_sha256": digest(inbox), "output_sha256": digest(saved),
                "receipt_sha256": digest(r), "approval_claim_sha256": digest(claim),
                "disk_content_verified": True}
    except (OSError, ValueError, TypeError, KeyError, UnicodeError, json.JSONDecodeError) as e:
        return {"status": "BLOCKED", "reason": str(e) if isinstance(e, ValueError) else "INDEPENDENT_READBACK_ERROR"}


def main(argv: list[str]) -> int:
    import argparse
    parser = argparse.ArgumentParser(description="Local read-only Agent #5 GUI pilot receipt check")
    parser.add_argument("--task-id", required=True)
    args = parser.parse_args(argv)
    approvals = (Path(__import__("os").environ["LOCALAPPDATA"]) / "IMPERION" / "Agent5" / "gui_approvals") \
        if __import__("os").environ.get("LOCALAPPDATA") else None
    outcome = verify_task(args.task_id, root=ROOT, approvals=approvals)
    print(json.dumps(outcome, ensure_ascii=True, sort_keys=True))
    return 0 if outcome["status"] == "DONE" else 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
