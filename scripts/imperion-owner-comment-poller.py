"""IMPERION DEV Agent: owner-only GitHub issue-comment trigger on zmrzlina.

PUBLIC, allowlisted and bounded. This script is not an autonomous GitHub writer.
No tokens, no customer data, no private repo access, no shell execution from comments.
Windows Task Scheduler can invoke --once; no new CRM, API provider or HTTP server.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import tempfile
from urllib.request import Request, urlopen
from urllib.parse import parse_qs, urlsplit

OWNER = "aliaksei-chareshneu"
REPO = OWNER + "/alchareshneu"
ISSUE = 195
URL = "https://api.github.com/repos/" + REPO + "/issues/195/comments?per_page=100&page=1"
COMMAND = re.compile(r"\A/imperion-dev (ping|smoke)\Z")
WORKER = Path(__file__).with_name("safe_local_python_worker.py")
if not WORKER.is_file():
    WORKER = Path(__file__).with_name("imperion-local-python-worker.py")
STATE = Path(__file__).with_name("state")
POLL_ID = "IMP-DEV-POLL-20261108"
USER_AGENT = "IMPERION-DEV-Owner-Poller/1.0"
MAX_RESPONSE = 350000
MAX_COMMANDS_PER_TICK = 2

def utc_now():
    return datetime.now(timezone.utc).isoformat()

def safe_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_name(path.name + ".tmp")
    temp_path.write_text(json.dumps(obj, ensure_ascii=True, indent=2) + "\n", encoding="utf8")
    os.replace(temp_path, path)

def record(status, *, comment_id=None, job_id=None, extra=None):
    obj = {"case_id": POLL_ID, "owner": OWNER, "entity": "PERSONAL_OSVC",
           "timestamp_utc": utc_now(), "status": status, "comment_id": comment_id,
           "job_id": job_id, "external_paid_api_czk": 0, "new_crm": False,
           "production_change": False, "model_can_merge": False}
    if extra:
        obj.update(extra)
    safe_json(STATE / "status.json", obj)
    if comment_id is not None and job_id is not None:
        safe_json(STATE / "last_job.json", obj)
    with (STATE / "events.jsonl").open("a", encoding="utf8") as file:
        file.write(json.dumps(obj, ensure_ascii=True) + "\n")
    return obj

def _api_get(url):
    request = Request(url, headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": USER_AGENT,
        "Cache-Control": "no-cache"
    })
    with urlopen(request, timeout=12) as response:
        if response.status != 200:
            raise ValueError("ISSUE_API_HTTP_NOT_200")
        raw = response.read(MAX_RESPONSE + 1)
        if len(raw) > MAX_RESPONSE:
            raise ValueError("PUBLIC_API_TOO_LARGE")
        result = json.loads(raw)
        if not isinstance(result, list) or len(result) > 100:
            raise ValueError("UNEXPECTED_ISSUE_COMMENT_SCHEMA")
        return result, response.headers.get("Link", "")

def get_comments():
    comments, link = _api_get(URL)
    m = re.search(r'<(https://api\.github\.com/[^>]+)>;\s*rel="last"', link)
    if m:
        last = m.group(1)
        parsed = urlsplit(last)
        query = parse_qs(parsed.query)
        page = query.get("page", ["1"])[0]
        if (parsed.scheme != "https" or parsed.netloc != "api.github.com" or
            parsed.path != "/repos/" + REPO + "/issues/195/comments" or
            not page.isdigit() or not 1 <= int(page) <= 100):
            raise ValueError("UNEXPECTED_PUBLIC_PAGINATION")
        if int(page) > 1:
            comments, _ = _api_get(last)
    ids = [c.get("id") for c in comments]
    if any(not isinstance(i, int) or i <= 0 for i in ids):
        raise ValueError("INVALID_COMMENT_IDS")
    return sorted(comments, key=lambda c: c["id"])

def owner_command(comment):
    user = comment.get("user") or {}
    if (user.get("login") != OWNER or
        comment.get("author_association") != "OWNER" or
        user.get("type") != "User"):
        return None
    body = comment.get("body")
    if not isinstance(body, str) or len(body) > 100:
        return None
    match = COMMAND.fullmatch(body.strip())
    return match.group(1) if match else None

def check_local_model():
    request = Request("http://127.0.0.1:11434/api/tags", headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=4) as response:
        if response.status != 200:
            raise ValueError("OLLAMA_HTTP_FAILED")
        doc = json.loads(response.read(30000))
    available = {x.get("name") for x in doc.get("models", []) if isinstance(x, dict)}
    if "imperion-qwen35:4b" not in available:
        raise ValueError("REQUIRED_LOCAL_MODEL_MISSING")
    return {"model": "imperion-qwen35:4b", "loopback_model_available": True,
            "device": socket.gethostname()}

def run_smoke(comment_id):
    if not WORKER.is_file() or WORKER.name not in ("safe_local_python_worker.py", "imperion-local-python-worker.py"):
        raise ValueError("VERIFIED_EXISTING_WORKER_NOT_FOUND")
    temp = Path(tempfile.mkdtemp(prefix="imperion-dev-agent-issue195-"))
    filename = "sample.py"
    (temp / filename).write_text(
        "def price_total(items):\n"
        "    \"\"\"Sum unit_price multiplied by quantity.\"\"\"\n"
        "    return sum(item['unit_price'] for item in items)\n",
        encoding="utf8")
    (temp / "test_sample.py").write_text(
        "import unittest\nfrom sample import price_total\n"
        "class Smoke(unittest.TestCase):\n"
        "    def test_empty(self): self.assertEqual(price_total([]), 0)\n"
        "    def test_quantity(self): self.assertEqual(price_total([{'unit_price':7,'quantity':3}]),21)\n"
        "    def test_multiple(self): self.assertEqual(price_total([{'unit_price':11,'quantity':2},{'unit_price':4,'quantity':5}]),42)\n",
        encoding="utf8")
    job_id = "IMP-DEV-ISSUE195-" + str(comment_id)
    manifest = {
        "job_id": job_id, "workspace": str(temp), "source_file": filename,
        "test_file": "test_sample.py", "function": "price_total",
        "requirement": "Multiply each item's unit_price and quantity before summing. Prefer exactly: return sum(item['unit_price'] * item['quantity'] for item in items). No dict.get(), imports, exceptions, boolean operators or helpers.",
        "public_only": True
    }
    safe_json(temp / "task.json", manifest)
    env = dict(os.environ)
    env["PYTHONNOUSERSITE"] = "1"
    process = subprocess.run(
        [sys.executable, str(WORKER), "--task", str(temp / "task.json")],
        cwd=str(temp), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, timeout=250, env=env)
    proof_path = temp / "imperion-dev-proof.json"
    if not proof_path.is_file():
        raise ValueError("NO_MODEL_TEST_PROOF")
    proof = json.loads(proof_path.read_text(encoding="utf8"))
    if (process.returncode != 0 or proof.get("status") != "LOCAL_MODEL_CODE_TEST_PASS" or
        proof.get("baseline_exit") == 0 or proof.get("job_id") != job_id):
        raise ValueError("MODEL_CODE_OR_TEST_FAILED")
    verify = subprocess.run(
        [sys.executable, "-m", "unittest", "discover", "-s", str(temp),
         "-p", "test_sample.py", "-v"],
        cwd=str(temp), capture_output=True, text=True, timeout=25, env=env)
    if verify.returncode != 0 or "Ran 3 tests" not in (verify.stdout + verify.stderr):
        raise ValueError("INDEPENDENT_READBACK_FAILED")
    modified = (temp / filename).read_bytes()
    if proof.get("after_sha256") != hashlib.sha256(modified).hexdigest():
        raise ValueError("READBACK_HASH_MISMATCH")
    return {"smoke_verified": True, "model_test_status": proof["status"],
            "test_count": 3, "independent_test_exit": verify.returncode,
            "model": proof.get("model"), "attempts": len(proof.get("attempts", [])),
            "proof_path": str(proof_path), "source_sha256": proof["after_sha256"]}

def execute(command, comment_id):
    if command == "ping":
        return check_local_model()
    if command == "smoke":
        return run_smoke(comment_id)
    raise ValueError("COMMAND_NOT_ALLOWLISTED")

def poll(comments=None, state_dir=None, executor=None):
    global STATE
    if state_dir is not None:
        STATE = Path(state_dir)
    STATE.mkdir(parents=True, exist_ok=True)
    lock = STATE / "poll.lock"
    try:
        handle = os.open(str(lock), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        os.close(handle)
    except FileExistsError:
        return {"status": "BLOCKED_ALREADY_RUNNING", "lock_path": str(lock)}
    try:
        current = comments if comments is not None else get_comments()
        current = sorted(current, key=lambda x: x["id"])
        cursor_path = STATE / "cursor.json"
        if not cursor_path.exists():
            maximum = max((x["id"] for x in current), default=0)
            safe_json(cursor_path, {"last_seen_comment_id": maximum})
            return record("INITIALIZED_OLD_COMMENTS_NOT_REPLAYED", extra={"last_seen_comment_id": maximum})
        seen = json.loads(cursor_path.read_text(encoding="utf8")).get("last_seen_comment_id")
        if not isinstance(seen, int) or seen < 0:
            raise ValueError("CORRUPT_COMMENT_CURSOR")
        pending = [x for x in current if x["id"] > seen]
        commands = 0
        for comment in pending:
            if commands >= MAX_COMMANDS_PER_TICK:
                break
            number = comment["id"]
            cmd = owner_command(comment)
            # Durable ACK BEFORE model run prevents repeated charges/work on crashes.
            safe_json(cursor_path, {"last_seen_comment_id": number})
            if cmd is None:
                continue
            commands += 1
            record("STARTED", comment_id=number, job_id=cmd)
            try:
                result = (executor or execute)(cmd, number)
                record("PASS", comment_id=number, job_id=cmd, extra=result)
            except Exception as exc:
                record("BLOCKED", comment_id=number, job_id=cmd,
                       extra={"reason": str(exc)[:160], "retry_automatic": False})
        if commands == 0:
            return record("IDLE_NO_NEW_OWNER_COMMAND",
                          extra={"last_seen_comment_id": json.loads(cursor_path.read_text()).get("last_seen_comment_id")})
        return json.loads((STATE / "status.json").read_text())
    finally:
        try:
            lock.unlink()
        except FileNotFoundError:
            pass

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    if not args.once:
        parser.error("Only --once is allowed; run with existing OS scheduler")
    try:
        result = poll()
        print(json.dumps(result, ensure_ascii=True))
        return 0 if result.get("status") not in ("BLOCKED", "BLOCKED_ALREADY_RUNNING") else 2
    except Exception as exc:
        result = record("BLOCKED", extra={"reason": str(exc)[:160], "retry_automatic": False})
        print(json.dumps(result, ensure_ascii=True))
        return 2

if __name__ == "__main__":
    sys.exit(main())
