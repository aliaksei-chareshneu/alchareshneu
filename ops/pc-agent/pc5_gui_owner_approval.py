"""Local owner-only helper. NOT exposed through BrowserBridge or cloud queue.

Creating a ticket requires a user's direct confirmation in an interactive
Windows session; a ChatGPT job, page content or an email cannot mint one.
This is scoped workflow consent, not a defense against malicious same-user code.
"""
from __future__ import annotations

import ctypes
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

TASK_RE = re.compile(r"^A5-GUI-[A-Z0-9-]{8,32}$")
GO_RE = re.compile(r"^GO-[A-Z0-9-]{8,48}$")
FIXTURE = b"A5 GUI PILOT"
WORKSPACE = Path(__file__).resolve().parent / "pc_task_data"


def prepare(task_id: str, approval_ref: str, *, root: Path, now: datetime) -> dict:
    if (not isinstance(task_id, str) or not TASK_RE.fullmatch(task_id) or
        not isinstance(approval_ref, str) or not GO_RE.fullmatch(approval_ref)):
        raise ValueError("INVALID_TASK_OR_GO_REFERENCE")
    source = root / "inbox" / (task_id + ".txt")
    if (source.is_symlink() or not source.is_file() or source.stat().st_nlink != 1 or
            source.read_bytes() != FIXTURE):
        raise ValueError("APPROVED_SYNTHETIC_SOURCE_REQUIRED")
    if now.tzinfo is None:
        raise ValueError("TIMEZONE_REQUIRED")
    import hashlib
    return {"task_id": task_id, "app": "notepad", "action": "append_marker_save",
            "source_sha256": hashlib.sha256(FIXTURE).hexdigest(),
            "expires_at": (now.astimezone(timezone.utc)+timedelta(minutes=7)).isoformat(),
            "approval_ref": approval_ref}


def create(task_id: str, approval_ref: str, *, root: Path, approvals: Path,
           direct_human_confirmed: bool, now: datetime) -> dict:
    if direct_human_confirmed is not True:
        return {"status": "BLOCKED", "reason": "LOCAL_USER_CONFIRMATION_REQUIRED"}
    try:
        data = prepare(task_id, approval_ref, root=root, now=now)
        approvals = Path(approvals)
        # The installer must separately verify the Windows ACL before first use.
        for d in (approvals.parent.parent, approvals.parent, approvals):
            if d.is_symlink() or (hasattr(d, "is_junction") and d.is_junction()):
                raise ValueError("APPROVAL_DIRECTORY_LINK_DENIED")
            d.mkdir(parents=True, exist_ok=True)
        claim = approvals / (task_id + ".claimed")
        target = approvals / (task_id + ".json")
        if claim.exists() or claim.is_symlink() or target.exists() or target.is_symlink():
            raise ValueError("APPROVAL_ID_ALREADY_EXISTS")
        with target.open("xb") as f:
            f.write((json.dumps(data, ensure_ascii=True, sort_keys=True) + "\n").encode("ascii"))
            f.flush()
            os.fsync(f.fileno())
        return {"status": "DONE", "task_id": task_id, "app": "notepad",
                "expires_at": data["expires_at"], "approval_ref": approval_ref}
    except (ValueError, OSError, FileExistsError) as e:
        return {"status": "BLOCKED", "reason": str(e) if isinstance(e, ValueError) else "LOCAL_APPROVAL_WRITE_ERROR"}


def main(args: list[str]) -> int:
    import argparse
    parser = argparse.ArgumentParser(description="LOCAL, not cloud: one-use Notepad consent")
    parser.add_argument("--task-id", required=True)
    parser.add_argument("--approval-ref", required=True)
    opt=parser.parse_args(args)
    if sys.platform != "win32" or not os.environ.get("LOCALAPPDATA"):
        print('{"status":"BLOCKED","reason":"INTERACTIVE_WINDOWS_REQUIRED"}')
        return 2
    # Physical prompt. Never auto-click or simulate consent.
    msg = (f"Approve ONE fixed Notepad GUI test?\n\n"
           f"Task: {opt.task_id}\nApp: Notepad\nAction: append fixed marker to synthetic file, save\n"
           f"Only Agent5 scratch directory; no personal data\nGO ref: {opt.approval_ref}\n"
           "Expires in 7 minutes. This approval is spent once.\n\n"
           "Choose YES only after approving this exact local action.")
    result = ctypes.windll.user32.MessageBoxW(None, msg, "IMPERION Agent #5 - Local GUI Consent", 0x4 | 0x30)
    if result != 6:
        print('{"status":"BLOCKED","reason":"OWNER_DID_NOT_CONFIRM"}')
        return 2
    approvals = Path(os.environ["LOCALAPPDATA"]) / "IMPERION" / "Agent5" / "gui_approvals"
    output = create(opt.task_id, opt.approval_ref, root=WORKSPACE,
                    approvals=approvals, direct_human_confirmed=True,
                    now=datetime.now(timezone.utc))
    print(json.dumps(output, ensure_ascii=True))
    return 0 if output["status"] == "DONE" else 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
