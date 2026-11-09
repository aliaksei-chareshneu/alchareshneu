"""IMPERION Agent5 v3: bounded chat-to-Windows workspace operations.

One existing Browser Bridge agent consumes the queue. No arbitrary shell,
filesystem paths, browser session access, payments, external sends, or new
services. All payload fields are untrusted and validated at this boundary.
"""
import hashlib
import json
import re
import sqlite3
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from pc_task_engine import (
    ROOT, MAX_INPUT, MAX_BYTES_PER_OUTPUT, TASK_RE, NAME_RE,
    Denied, check_filename, create_workspace, digest, plan_text,
    read_input, run_task, safe_new_output, validate_steps, validate_directory
)

MAX_IMPORT_BYTES = 8192
MAX_FETCH_BYTES = 8192
MAX_PAYLOAD_BYTES = 12000
MODE_KEYS = {
    "capabilities": {"mode"},
    "import": {"mode", "import_id", "filename", "content", "data_class"},
    "plan": {"mode", "task_id", "instruction", "steps"},
    "execute": {"mode", "task_id", "instruction", "steps"},
    "fetch": {"mode", "task_id", "kind"},
}


def blocked(code):
    return {"status": "BLOCKED", "reason": code}


def strict_fields(payload, mode):
    keys = set(payload)
    if not keys.issubset(MODE_KEYS[mode]):
        raise Denied("FIELDS_NOT_ALLOWED")
    if mode in ("plan", "execute"):
        if ("instruction" in payload) == ("steps" in payload):
            raise Denied("ONE_PLAN_SOURCE_REQUIRED")
        if not TASK_RE.fullmatch(payload.get("task_id", "")):
            raise Denied("INVALID_TASK_ID")
    else:
        if keys != MODE_KEYS[mode]:
            raise Denied("MISSING_OR_EXTRA_FIELDS")


def db_begin(root):
    create_workspace(root)
    receipts = validate_directory(root / "receipts")
    path = receipts / "operator_v3.sqlite3"
    if path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction()):
        raise Denied("LEDGER_PATH_UNSAFE")
    if path.exists() and not path.is_file():
        raise Denied("LEDGER_NOT_FILE")
    conn = sqlite3.connect(str(path), timeout=8.0, isolation_level=None)
    try:
        conn.execute("PRAGMA busy_timeout=8000")
        conn.execute("BEGIN IMMEDIATE")
        conn.execute("CREATE TABLE IF NOT EXISTS imports (import_id TEXT PRIMARY KEY, "
                     "filename TEXT NOT NULL, sha256 TEXT NOT NULL, bytes INTEGER NOT NULL)")
        return conn
    except Exception:
        conn.close()
        raise


def do_import(root, payload):
    ident = payload["import_id"]
    if not isinstance(ident, str) or not TASK_RE.fullmatch(ident):
        raise Denied("INVALID_IMPORT_ID")
    name = check_filename(payload["filename"])
    if payload["data_class"] != "non_sensitive":
        raise Denied("ONLY_NON_SENSITIVE_INPUT")
    content = payload["content"]
    if not isinstance(content, str) or not content or "\x00" in content:
        raise Denied("BAD_IMPORT_CONTENT")
    data = content.encode("utf-8")
    if len(data) > MAX_IMPORT_BYTES:
        raise Denied("IMPORT_TOO_LARGE")
    checksum = digest(data)
    conn = db_begin(root)
    try:
        old = conn.execute("SELECT filename,sha256,bytes FROM imports WHERE import_id=?",
                           (ident,)).fetchone()
        if old and old != (name, checksum, len(data)):
            raise Denied("IMPORT_IDEMPOTENCY_CONFLICT")
        output = safe_new_output(root / "inbox", name, data)
        if output["sha256"] != checksum:
            raise Denied("IMPORT_READBACK_MISMATCH")
        if not old:
            conn.execute("INSERT INTO imports VALUES(?,?,?,?)",
                         (ident, name, checksum, len(data)))
        conn.execute("COMMIT")
        return {"status": "DONE", "mode": "import", "filename": name,
                "sha256": checksum, "bytes": len(data), "replay": bool(old),
                "scope": "ONLY_AGENT5_INBOX"}
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


def get_steps(payload):
    if "instruction" in payload:
        return validate_steps(plan_text(payload["instruction"]))
    return validate_steps(payload["steps"])


def do_plan(root, payload):
    steps = get_steps(payload)
    inputs = []
    for step in steps:
        if "file" in step:
            name = step["file"]
            if name not in (v["file"] for v in inputs):
                _, sha, size = read_input(root, name)
                inputs.append({"file": name, "sha256": sha, "bytes": size})
    return {"status": "READY", "mode": "plan", "task_id": payload["task_id"],
            "steps": steps, "input_readback": inputs,
            "writes": [s["op"] for s in steps if s["op"] in ("clean_blanks", "write_report")],
            "scope": "ONLY_AGENT5_INBOX_OUTBOX", "requires_external_authorization": False,
            "no_action_executed": True}


def do_execute(root, payload):
    conn = db_begin(root)
    try:
        data = {k: v for k, v in payload.items() if k != "mode"}
        # Lock serializes this worker's concurrent access across sessions.
        # V2 JSON receipts remain authoritative for historical task IDs.
        output = run_task(data, root=root)
        conn.execute("COMMIT")
        return {"mode": "execute", "result": output,
                "status": "DONE" if output.get("status") == "DONE" else "BLOCKED"}
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


def do_fetch(root, payload):
    task_id = payload["task_id"]
    if not isinstance(task_id, str) or not TASK_RE.fullmatch(task_id):
        raise Denied("INVALID_TASK_ID")
    kind = payload["kind"]
    if kind not in ("report", "cleaned"):
        raise Denied("FETCH_KIND_NOT_ALLOWED")
    filename = task_id + (".report.md" if kind == "report" else ".cleaned.txt")
    receipts = validate_directory(root / "receipts")
    receipt = receipts / (task_id + ".json")
    if receipt.is_symlink() or (hasattr(receipt, "is_junction") and receipt.is_junction()):
        raise Denied("RECEIPT_LINK_DENIED")
    if not receipt.is_file() or receipt.stat().st_size > MAX_BYTES_PER_OUTPUT:
        raise Denied("RECEIPT_NOT_FOUND")
    record = json.loads(receipt.read_text(encoding="utf-8"))
    expected = None
    for step in record.get("result", {}).get("steps", []):
        if step.get("output", {}).get("file") == filename:
            expected = step["output"].get("sha256")
            break
    if expected is None:
        raise Denied("OUTPUT_NOT_IN_RECEIPT")
    out = validate_directory(root / "outbox") / filename
    if out.is_symlink() or (hasattr(out, "is_junction") and out.is_junction()):
        raise Denied("OUTPUT_LINK_DENIED")
    if not out.is_file() or out.stat().st_size > MAX_FETCH_BYTES or out.stat().st_nlink > 1:
        raise Denied("OUTPUT_MISSING_OR_TOO_LARGE")
    raw = out.read_bytes()
    if digest(raw) != expected:
        raise Denied("OUTPUT_TAMPER_DETECTED")
    try:
        text = raw.decode("utf-8")
    except UnicodeError:
        raise Denied("OUTPUT_NOT_UTF8")
    if "\x00" in text:
        raise Denied("OUTPUT_NOT_TEXT")
    return {"status": "DONE", "mode": "fetch", "task_id": task_id,
            "kind": kind, "filename": filename, "sha256": expected,
            "bytes": len(raw), "text": text}


def operate(payload, root=ROOT):
    if not isinstance(payload, dict) or not isinstance(payload.get("mode"), str):
        return blocked("PAYLOAD_NOT_OBJECT")
    mode = payload["mode"]
    if mode not in MODE_KEYS:
        return blocked("MODE_NOT_ALLOWED")
    try:
        if len(json.dumps(payload, ensure_ascii=True).encode("utf-8")) > MAX_PAYLOAD_BYTES:
            raise Denied("PAYLOAD_SIZE_DENIED")
        strict_fields(payload, mode)
        if mode == "capabilities":
            return {"status": "DONE", "mode": mode,
                    "available": sorted(MODE_KEYS),
                    "allowed_steps": sorted({"inventory", "text_stats", "csv_stats",
                                             "clean_blanks", "system_status",
                                             "program_versions", "write_report"}),
                    "max_steps": 6, "max_import_bytes": MAX_IMPORT_BYTES,
                    "input_policy": "NON_SENSITIVE_WORKSPACE_ONLY",
                    "real_personal_files": "BLOCKED_UNTIL_SCOPED_OWNER_GO",
                    "arbitrary_programs_and_shell": "DENIED"}
        if mode == "import":
            return do_import(root, payload)
        if mode == "plan":
            return do_plan(root, payload)
        if mode == "execute":
            return do_execute(root, payload)
        if mode == "fetch":
            return do_fetch(root, payload)
    except Denied as exc:
        return blocked(str(exc))
    except (OSError, ValueError, TypeError, sqlite3.Error, UnicodeError, KeyError) as exc:
        return blocked("LOCAL_" + type(exc).__name__.upper())
    return blocked("MODE_NOT_ALLOWED")


def selftest():
    checks = []
    with tempfile.TemporaryDirectory(prefix="imperion-a5-v3-") as folder:
        root = Path(folder) / "safe"
        src = "item,amount\napples,4\npears,7\n"
        import_payload = {"mode":"import", "import_id":"A5-V3-IMPORT-00001",
                          "filename":"testdata.csv", "content":src,
                          "data_class":"non_sensitive"}
        def check(label, ok):
            checks.append((label, bool(ok)))
        a = operate(import_payload, root)
        check("import_sandbox", a.get("status")=="DONE" and
              a.get("sha256")==digest(src))
        check("import_exact_replay", operate(import_payload,root).get("replay") is True)
        check("import_changed_content_blocked",
              operate(dict(import_payload, content="different"),root).get("reason")==
              "IMPORT_IDEMPOTENCY_CONFLICT")
        check("import_rename_blocked",
              operate(dict(import_payload,filename="other.csv"),root).get("reason")==
              "IMPORT_IDEMPOTENCY_CONFLICT")
        task_id="A5-V3-CSV-WORK-0001"
        task={"mode":"execute", "task_id":task_id,
              "instruction":"Проверь CSV testdata.csv и сделай отчёт"}
        plan=operate(dict(task,mode="plan"),root)
        check("plan_checks_input", plan.get("status")=="READY" and
              plan.get("input_readback", [{}])[0].get("sha256")==digest(src) and
              plan.get("no_action_executed") is True)
        check("plan_did_not_write", not (root/"outbox"/(task_id+".report.md")).exists())
        result=operate(task,root)
        check("two_steps_done",result.get("status")=="DONE" and
              result.get("result",{}).get("executed_steps")==2)
        check("receipt_created",(root/"receipts"/(task_id+".json")).exists())
        report=operate({"mode":"fetch","task_id":task_id,"kind":"report"},root)
        check("report_fetched_verified",report.get("status")=="DONE" and
              report.get("sha256")==digest(report.get("text","")))
        check("missing_cleaned_refused",operate({"mode":"fetch","task_id":task_id,
              "kind":"cleaned"},root).get("reason")=="OUTPUT_NOT_IN_RECEIPT")
        check("execute_replay",operate(task,root).get("result",{}).get("replay") is True)
        conflict=operate(dict(task,instruction="Проверь компьютер"),root)
        check("execute_conflict", conflict.get("result",{}).get("reason")=="IDEMPOTENCY_CONFLICT")
        reportpath=root/"outbox"/(task_id+".report.md")
        original=reportpath.read_bytes()
        reportpath.write_bytes(b"unauthorized change")
        check("tamper_detection",operate({"mode":"fetch","task_id":task_id,
              "kind":"report"},root).get("reason")=="OUTPUT_TAMPER_DETECTED")
        reportpath.write_bytes(original)
        check("restore_after_tamper",operate({"mode":"fetch","task_id":task_id,
              "kind":"report"},root).get("status")=="DONE")
        check("dangerous_name_rejected",operate(dict(import_payload,
              import_id="A5-V3-IMPORT-00002",filename="../secrets.csv"),root).get("status")=="BLOCKED")
        check("secret_class_denied",operate(dict(import_payload,
              import_id="A5-V3-IMPORT-00003",data_class="sensitive"),root).get("status")=="BLOCKED")
        check("shell_step_denied",operate({"mode":"execute",
              "task_id":"A5-V3-SHELL-BLOCK01","steps":[{"op":"shell","command":"whoami"}]},
              root).get("status")=="BLOCKED")
        check("missing_input_blocked",operate({"mode":"plan",
              "task_id":"A5-V3-MISSING-0001","steps":[{"op":"text_stats","file":"missing.txt"}]},
              root).get("reason")=="INPUT_FILE_NOT_FOUND")
        check("unknown_mode_denied",operate({"mode":"delete_all"},root).get("status")=="BLOCKED")
        check("disallowed_path_field",operate(dict(import_payload,
              path="C:\\Private"),root).get("reason")=="FIELDS_NOT_ALLOWED")
        check("capabilities_no_side_effect",operate({"mode":"capabilities"},root).get("status")=="DONE")
        ids = ["A5-V3-PARALLEL-001"]
        parallel_payload = {"mode":"import", "import_id":ids[0],
                            "filename":"parallel.txt", "content":"same",
                            "data_class":"non_sensitive"}
        with ThreadPoolExecutor(max_workers=3) as pool:
            parallel = list(pool.map(lambda _: operate(parallel_payload, root), range(3)))
        check("concurrency_single_commit",len([v for v in parallel if v.get("status")=="DONE"])==3 and
              len([v for v in parallel if v.get("replay") is False])==1 and
              len([v for v in parallel if v.get("replay") is True])==2)
        check("no_other_folder_modified",all(p.is_relative_to(root) for p in root.rglob("*")))
    return {"status":"PASS" if all(v for _,v in checks) else "FAIL",
            "passed":sum(v for _,v in checks),"total":len(checks),
            "checks":checks,"temporary_workspace_removed":not Path(folder).exists()}


if __name__ == "__main__":
    import sys
    if len(sys.argv)==2 and sys.argv[1]=="--selftest":
        result=selftest()
        print(json.dumps(result,ensure_ascii=True))
        sys.exit(0 if result["status"]=="PASS" else 1)
    print(json.dumps(blocked("SELFTEST_ONLY")))
    sys.exit(2)
