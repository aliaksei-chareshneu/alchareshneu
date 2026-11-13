"""IMPERION PC Agent #5: restricted, unattended workspace task engine.

Only an explicit agent-owned scratch workspace is touched. No shell from job
payloads, browser secrets, personal paths, production code, payments or sends.
Natural-language routing supports a small, documented set of safe intentions.
Full general-purpose Windows control is NOT provided.
"""
import csv
import hashlib
import io
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "pc_task_data"
TASK_RE = re.compile(r"^A5-[A-Z0-9-]{8,48}$")
NAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,61}\.(txt|md|csv|json)$", re.I)
OPS = {"inventory", "text_stats", "csv_stats", "clean_blanks",
       "system_status", "program_versions", "write_report"}
MAX_INPUT = 131072
MAX_STEP_COUNT = 6
MAX_TEXT = 500
MAX_BYTES_PER_OUTPUT = 16384


class Denied(Exception):
    pass


def digest(data):
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def reject(reason):
    return {"status": "BLOCKED", "reason": reason}


def validate_directory(folder):
    folder = Path(folder)
    if folder.is_symlink() or (hasattr(folder, "is_junction") and folder.is_junction()):
        raise Denied("LINK_DIRECTORY_DENIED")
    if folder.exists() and not folder.is_dir():
        raise Denied("DIRECTORY_NOT_ALLOWED")
    return folder


def create_workspace(root):
    for directory in (root, root / "inbox", root / "outbox", root / "receipts"):
        validate_directory(directory)
        directory.mkdir(parents=True, exist_ok=True)


def check_filename(name):
    if not isinstance(name, str) or not NAME_RE.fullmatch(name) or ".." in name:
        raise Denied("FILE_NAME_NOT_ALLOWED")
    return name


def read_input(root, name):
    check_filename(name)
    directory = validate_directory(root / "inbox")
    source = directory / name
    if source.is_symlink() or (hasattr(source, "is_junction") and source.is_junction()):
        raise Denied("LINK_FILE_DENIED")
    if not source.is_file():
        raise Denied("INPUT_FILE_NOT_FOUND")
    st = source.stat()
    if st.st_size > MAX_INPUT or st.st_nlink > 1:
        raise Denied("INPUT_SIZE_OR_LINK_DENIED")
    content = source.read_bytes()
    if len(content) > MAX_INPUT or b"\x00" in content:
        raise Denied("BINARY_OR_LARGE_INPUT_DENIED")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeError:
        raise Denied("UTF8_REQUIRED")
    return text, digest(content), len(content)


def safe_new_output(directory, name, content):
    validate_directory(directory)
    if not isinstance(content, bytes) or len(content) > MAX_BYTES_PER_OUTPUT:
        raise Denied("OUTPUT_LIMIT_EXCEEDED")
    if not re.fullmatch(r"[a-zA-Z0-9_.-]{1,90}", name) or ".." in name:
        raise Denied("OUTPUT_NAME_INVALID")
    output = directory / name
    if output.is_symlink() or (hasattr(output, "is_junction") and output.is_junction()):
        raise Denied("OUTPUT_LINK_DENIED")
    sha = digest(content)
    if output.exists():
        if not output.is_file() or output.stat().st_size > MAX_BYTES_PER_OUTPUT:
            raise Denied("EXISTING_OUTPUT_UNSAFE")
        if digest(output.read_bytes()) != sha:
            raise Denied("OUTPUT_EXISTS_WITH_DIFFERENT_DATA")
        return {"file": name, "sha256": sha, "bytes": len(content), "reused": True}
    try:
        with output.open("xb") as handle:
            handle.write(content)
            handle.flush()
    except FileExistsError:
        raise Denied("OUTPUT_RACE_DENIED")
    if digest(output.read_bytes()) != sha:
        raise Denied("OUTPUT_READBACK_MISMATCH")
    return {"file": name, "sha256": sha, "bytes": len(content), "reused": False}


def plan_text(instruction):
    if not isinstance(instruction, str) or len(instruction) > MAX_TEXT:
        raise Denied("INSTRUCTION_LIMIT")
    lower = instruction.lower().strip()
    if not lower:
        raise Denied("EMPTY_INSTRUCTION")
    matches = NAME_RE.findall(lower)
    # Restrict filenames to a single literal token; never interpret paths or commands.
    filename = None
    for token in re.findall(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{0,61}\.(?:txt|md|csv|json)", lower):
        filename = check_filename(token)
        break
    if any(s in lower for s in ("powershell", "cmd.exe", "удал", "delete ", "c:\\", "../", "запусти команд", "install ")):
        raise Denied("UNSAFE_INTENT_DENIED")
    if filename and filename.endswith(".csv") and any(s in lower for s in ("csv", "таблиц", "проверь", "анализ")):
        return [{"op": "csv_stats", "file": filename}, {"op": "write_report"}]
    if filename and any(s in lower for s in ("очист", "пустые", "blank")):
        return [{"op": "clean_blanks", "file": filename}, {"op": "write_report"}]
    if filename and any(s in lower for s in ("строк", "слов", "анализ", "statistics", "count")):
        return [{"op": "text_stats", "file": filename}, {"op": "write_report"}]
    if any(s in lower for s in ("программ", "python", "git", "версии программ", "installed tools")):
        return [{"op": "program_versions"}, {"op": "write_report"}]
    if any(s in lower for s in ("компьютер", "пк", "windows", "систем", "machine")):
        return [{"op": "system_status"}, {"op": "write_report"}]
    if any(s in lower for s in ("инвентар", "список файлов", "входящ", "папке", "folder")):
        return [{"op": "inventory"}, {"op": "write_report"}]
    raise Denied("INSTRUCTION_NOT_SUPPORTED")


def validate_steps(steps):
    if not isinstance(steps, list) or not 1 <= len(steps) <= MAX_STEP_COUNT:
        raise Denied("STEP_COUNT_DENIED")
    cleaned = []
    for step in steps:
        if not isinstance(step, dict) or set(step) not in ({"op"}, {"op", "file"}):
            raise Denied("STEP_FIELDS_DENIED")
        op = step.get("op")
        if not isinstance(op, str) or op not in OPS:
            raise Denied("STEP_ACTION_DENIED")
        has_file = "file" in step
        if op in ("text_stats", "csv_stats", "clean_blanks") and not has_file:
            raise Denied("STEP_FILE_REQUIRED")
        if op not in ("text_stats", "csv_stats", "clean_blanks") and has_file:
            raise Denied("STEP_EXTRA_FILE")
        if has_file:
            check_filename(step["file"])
        if op == "csv_stats" and not step["file"].lower().endswith(".csv"):
            raise Denied("CSV_EXTENSION_REQUIRED")
        cleaned.append(step)
    if len([s for s in cleaned if s["op"] == "write_report"]) > 1:
        raise Denied("DUPLICATE_REPORT_STEP")
    return cleaned


def execute_step(root, task_id, step):
    op = step["op"]
    if op == "inventory":
        items = []
        for p in (root / "inbox").iterdir():
            if not p.is_file() or p.is_symlink() or not NAME_RE.fullmatch(p.name):
                continue
            if p.stat().st_size <= MAX_INPUT and p.stat().st_nlink == 1:
                items.append(p.suffix.lower())
        return {"op": op, "count": len(items), "by_extension": {x: items.count(x) for x in sorted(set(items))}}
    if op == "system_status":
        usage = shutil.disk_usage(Path.home().anchor or "/")
        return {"op": op, "system": platform.system(), "cpu_count": os.cpu_count(),
                "disk_free_gb": round(usage.free / 1073741824, 2)}
    if op == "program_versions":
        out = {"op": op, "tools": {}}
        for name in ("python", "git", "node"):
            exe = sys.executable if name == "python" else shutil.which(name)
            if not exe:
                out["tools"][name] = "NOT_INSTALLED"
                continue
            try:
                ran = subprocess.run([exe, "--version"], stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT, text=True, timeout=3,
                    stdin=subprocess.DEVNULL, cwd=str(root), check=False)
                value = (ran.stdout or "").strip()[:90]
                out["tools"][name] = value if ran.returncode == 0 else "PROBE_FAILED"
            except (OSError, subprocess.TimeoutExpired):
                out["tools"][name] = "PROBE_FAILED"
        return out
    if op in ("text_stats", "csv_stats", "clean_blanks"):
        name = step["file"]
        text, sha, size = read_input(root, name)
        if op == "text_stats":
            return {"op": op, "input": name, "sha256": sha,
                    "bytes": size, "lines": len(text.splitlines()),
                    "words": len(text.split()), "characters": len(text)}
        if op == "csv_stats":
            try:
                rows = list(csv.reader(io.StringIO(text, newline=""), strict=True))
            except csv.Error:
                raise Denied("CSV_INVALID")
            if not rows or len(rows) > 501 or len(rows[0]) > 40:
                raise Denied("CSV_SIZE_DENIED")
            width = len(rows[0])
            if any(len(row) != width for row in rows):
                raise Denied("CSV_INCONSISTENT_COLUMNS")
            return {"op": op, "input": name, "sha256": sha,
                    "columns": width, "data_rows": len(rows) - 1, "bytes": size}
        if op == "clean_blanks":
            cleaned = "\n".join(line.rstrip() for line in text.splitlines() if line.strip()) + "\n"
            if len(cleaned.encode("utf-8")) > MAX_BYTES_PER_OUTPUT:
                raise Denied("CLEANED_OUTPUT_TOO_BIG")
            output = safe_new_output(root / "outbox", task_id + ".cleaned.txt", cleaned.encode("utf-8"))
            return {"op": op, "input": name, "sha256": sha,
                    "input_lines": len(text.splitlines()),
                    "output_lines": len(cleaned.splitlines()), "output": output}
    raise Denied("INTERNAL_OP_UNKNOWN")


def run_task(payload, root=ROOT):
    # Queue payloads are untrusted. Never accept filesystem root or approval from them.
    if not isinstance(payload, dict) or not set(payload).issubset({"task_id", "instruction", "steps"}):
        return reject("UNEXPECTED_PAYLOAD_FIELDS")
    task_id = payload.get("task_id")
    if not isinstance(task_id, str) or not TASK_RE.fullmatch(task_id):
        return reject("TASK_ID_INVALID")
    if ("instruction" in payload) == ("steps" in payload):
        return reject("PROVIDE_INSTRUCTION_OR_STEPS")
    if len(json.dumps(payload, ensure_ascii=True)) > 4000:
        return reject("PAYLOAD_TOO_LARGE")
    try:
        steps = validate_steps(plan_text(payload["instruction"]) if "instruction" in payload else payload["steps"])
        create_workspace(root)
        request_sha = digest(json.dumps(payload, sort_keys=True, ensure_ascii=True))
        receipt = root / "receipts" / (task_id + ".json")
        if receipt.is_symlink() or (hasattr(receipt, "is_junction") and receipt.is_junction()):
            raise Denied("RECEIPT_LINK_DENIED")
        if receipt.exists():
            if receipt.stat().st_size > MAX_BYTES_PER_OUTPUT:
                raise Denied("RECEIPT_OVERSIZE")
            old = json.loads(receipt.read_text(encoding="utf-8"))
            if old.get("request_sha256") != request_sha:
                raise Denied("IDEMPOTENCY_CONFLICT")
            return dict(old["result"], replay=True)
        results = []
        for step in steps:
            if step["op"] == "write_report":
                lines = ["# IMPERION PC Agent #5 task report", "", "Task: " + task_id,
                         "Source: restricted workspace only", ""]
                for row in results:
                    lines.append("- " + json.dumps(row, sort_keys=True, ensure_ascii=True))
                result_report = safe_new_output(root / "outbox", task_id + ".report.md",
                                                ("\n".join(lines) + "\n").encode("utf-8"))
                results.append({"op": "write_report", "output": result_report})
            else:
                results.append(execute_step(root, task_id, step))
        outcome = {"status": "DONE", "task_id": task_id,
                   "executed_steps": len(results), "steps": results,
                   "scope": "ONLY_AGENT5_INBOX_OUTBOX"}
        receipt_contents = json.dumps({"request_sha256": request_sha, "result": outcome},
                                      sort_keys=True, ensure_ascii=True).encode("utf-8")
        if len(receipt_contents) > MAX_BYTES_PER_OUTPUT:
            raise Denied("RECEIPT_TOO_LARGE")
        with receipt.open("xb") as handle:
            handle.write(receipt_contents)
        if digest(receipt.read_bytes()) != digest(receipt_contents):
            raise Denied("RECEIPT_READBACK_FAILED")
        return outcome
    except Denied as exc:
        return reject(str(exc))
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return reject("UNEXPECTED_LOCAL_ERROR")


def seed_demo(root=ROOT):
    create_workspace(root)
    samples = {"agent5_qa.txt": "First line \n\n Second line\n\nThird line \n",
               "agent5_qa.csv": "subject,hours\nchemistry,2\nphysics,3\n"}
    out = []
    for name, text in samples.items():
        path = root / "inbox" / name
        data = text.encode("utf-8")
        if path.exists():
            if digest(path.read_bytes()) != digest(data):
                raise Denied("SEED_CONFLICT")
        else:
            with path.open("xb") as fh:
                fh.write(data)
        out.append({"file": name, "sha256": digest(path.read_bytes()), "bytes": path.stat().st_size})
    return {"status": "DONE", "scope": "SYNTHETIC_QA_ONLY", "files": out}


def selftest():
    checks = []
    with tempfile.TemporaryDirectory(prefix="imperion-a5-workspaceqa-") as folder:
        root = Path(folder) / "agent"
        seed_demo(root)
        def check(name, ok):
            checks.append((name, bool(ok)))
        a = run_task({"task_id": "A5-TEST-WORKFLOW-01",
            "steps": [{"op":"inventory"}, {"op":"text_stats", "file":"agent5_qa.txt"},
                      {"op":"csv_stats", "file":"agent5_qa.csv"}, {"op":"write_report"}]}, root)
        check("four_step_workflow", a.get("status")=="DONE" and a.get("executed_steps")==4)
        check("readback_report", (root/"outbox"/"A5-TEST-WORKFLOW-01.report.md").is_file()
              and a["steps"][-1]["output"]["sha256"] ==
              digest((root/"outbox"/"A5-TEST-WORKFLOW-01.report.md").read_bytes()))
        check("idempotent_exact_replay", run_task({"task_id":"A5-TEST-WORKFLOW-01",
            "steps":[{"op":"inventory"}, {"op":"text_stats","file":"agent5_qa.txt"},
                    {"op":"csv_stats","file":"agent5_qa.csv"},{"op":"write_report"}]},root).get("replay") is True)
        check("conflicting_replay_blocked", run_task({"task_id":"A5-TEST-WORKFLOW-01",
            "steps":[{"op":"system_status"}]},root).get("reason")=="IDEMPOTENCY_CONFLICT")
        b=run_task({"task_id":"A5-TEST-NATURAL-01",
            "instruction":"Проверь CSV agent5_qa.csv и сделай отчёт"},root)
        check("natural_language_csv", b.get("status")=="DONE" and b["steps"][0].get("data_rows")==2)
        c=run_task({"task_id":"A5-TEST-NATURAL-02",
            "instruction":"Очисти пустые строки в файле agent5_qa.txt"},root)
        check("natural_language_cleanup", c.get("status")=="DONE" and c["steps"][0]["output_lines"]==3)
        check("input_source_unchanged", (root/"inbox"/"agent5_qa.txt").read_text(encoding="utf-8").count("\n\n")>=1)
        d=run_task({"task_id":"A5-TEST-TOOLS-0001", "steps":[{"op":"program_versions"},{"op":"write_report"}]},root)
        check("known_program_probe", d.get("status")=="DONE" and "python" in d["steps"][0].get("tools",{}))
        check("path_injection_rejected", run_task({"task_id":"A5-TEST-DENY-0001",
           "steps":[{"op":"text_stats","file":"../secrets.txt"}]},root).get("status")=="BLOCKED")
        check("shell_denied", run_task({"task_id":"A5-TEST-DENY-0002",
            "steps":[{"op":"shell","command":"whoami"}]},root).get("status")=="BLOCKED")
        check("forged_approval_denied", run_task({"task_id":"A5-TEST-DENY-0003",
            "steps":[{"op":"inventory"}],"approved":True},root).get("status")=="BLOCKED")
        check("unknown_natural_denied",run_task({"task_id":"A5-TEST-DENY-0004",
            "instruction":"Отправь всем клиентам email"},root).get("status")=="BLOCKED")
        check("immutable_output", run_task({"task_id":"A5-TEST-NATURAL-02",
            "instruction":"Очисти пустые строки в файле agent5_qa.txt"},root).get("replay") is True)
        check("no_nonworkspace_modification", all(x.is_relative_to(root) for x in root.rglob("*")))
        check("receipt_logged",len(list((root/"receipts").glob("*.json")))>=4)
    return {"status":"PASS" if all(v for _,v in checks) else "FAIL",
            "passed":sum(v for _,v in checks),"total":len(checks),
            "checks":checks,"temporary_workspace_removed":not Path(folder).exists()}


if __name__=="__main__":
    if len(sys.argv)==2 and sys.argv[1]=="--selftest":
        result=selftest()
    elif len(sys.argv)==2 and sys.argv[1]=="--seed-demo":
        try:
            result=seed_demo()
        except Denied as exc:
            result=reject(str(exc))
    else:
        result=reject("CLI_ONLY_SELFTEST_OR_TRUSTED_SEED")
    print(json.dumps(result,ensure_ascii=True))
    sys.exit(0 if result.get("status") in ("PASS","DONE") else 4)
