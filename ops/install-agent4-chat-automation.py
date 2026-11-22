"""Surgically add Chat Automation to EXISTING Agent4 listener. NEVER start a new poller.

Defaults to dry-run. Refuses unknown source anchors or pre-existing adapters.
Source only; deployment to sole OCI service is a separate verified step.
"""
import argparse
from pathlib import Path
import hashlib
import shutil
import time

SIGNATURE = "# IMPERION_CHAT_AUTOMATION_PASHA_20261115"
NEW_UPDATES = '["message", "business_connection", "business_message", "edited_business_message", "deleted_business_messages"]'


def patch(source):
    if SIGNATURE in source:
        return source
    anchors = [
        ("import net\n",
         "import net\nimport agent4_business_connection as chat_automation  " + SIGNATURE + "\n"),
        ('    m = update.get("message", {})\n',
         '    if any(k in update for k in chat_automation.BUSINESS_UPDATES):\n'
         '        return chat_automation.handle_update(\n'
         '            db, update, setting, put, net.enqueue, net.event)\n'
         '    m = update.get("message", {})\n'),
        ('    if exact_go != "SEND:" + str(job_id) + ":" + row["peer"][-4:]:\n',
         '    if str(row["external_id"]).startswith("biz:"):\n'
         '        return chat_automation.approved_send(\n'
         '            db, job_id, exact_go, setting, api, net.telegram_send_approved)\n'
         '    if exact_go != "SEND:" + str(job_id) + ":" + row["peer"][-4:]:\n'),
        ('"allowed_updates": ["message"], "limit": 60',
         '"allowed_updates": ' + NEW_UPDATES + ', "limit": 60')
    ]
    result = source
    for old, new in anchors:
        if result.count(old) != 1:
            raise ValueError("Refused: listener source differs from reviewed Agent4")
        result = result.replace(old, new, 1)
    compile(result, "agent4_telegram.py", "exec")
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--go", default="")
    args = parser.parse_args()
    target = args.target.resolve()
    if target.name != "agent4_telegram.py" or not target.is_file():
        raise ValueError("Existing Agent4 listener path required")
    source = target.read_text(encoding="utf-8")
    changed = patch(source)
    print("ORIGINAL_SHA256=" + hashlib.sha256(source.encode()).hexdigest())
    print("PATCH_SHA256=" + hashlib.sha256(changed.encode()).hexdigest())
    if not args.apply:
        print("DRY_RUN_NO_CHANGES")
        return
    if args.go != "GO_AGENT4_CHAT_AUTOMATION_TECH_ONLY":
        raise ValueError("Exact technical authorization required")
    if changed == source:
        print("NO_CHANGE_ALREADY_PATCHED")
        return
    adapter = Path(__file__).with_name("agent4_business_connection.py")
    if not adapter.is_file():
        raise ValueError("Missing reviewed adapter")
    dest = target.with_name(adapter.name)
    if dest.exists():
        raise ValueError("Refusing to overwrite existing adapter")
    backup = target.with_name(target.name + ".pre-chat-automation-" + time.strftime("%Y%m%d-%H%M%S"))
    shutil.copy2(target, backup)
    shutil.copy2(adapter, dest)
    try:
        target.write_text(changed, encoding="utf-8")
        compile(target.read_text(encoding="utf-8"), str(target), "exec")
        print("SOURCE_PATCHED_NO_RESTART_NO_SEND")
        print("BACKUP=" + str(backup))
    except BaseException:
        shutil.copy2(backup, target)
        dest.unlink(missing_ok=True)
        raise


if __name__ == "__main__":
    main()
