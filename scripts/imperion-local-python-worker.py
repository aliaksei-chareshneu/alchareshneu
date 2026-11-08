"""IMPERION DEV AGENT: constrained local Python coding fallback.

Not a background service. Only owner-authored synthetic/public work under %TEMP%.
The model has NO GitHub token, write rights outside the temp workspace, or paid API.
"""
import argparse
import ast
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.request import Request, urlopen

MODEL = "imperion-qwen35:4b"
ENDPOINT = "http://127.0.0.1:11434/api/generate"
ALLOWED_AST = {
    ast.Module, ast.FunctionDef, ast.arguments, ast.arg, ast.Return, ast.Call,
    ast.Name, ast.Load, ast.Store, ast.Constant, ast.GeneratorExp, ast.ListComp,
    ast.comprehension, ast.Subscript, ast.BinOp, ast.Add, ast.Mult, ast.Sub,
    ast.Assign, ast.AugAssign, ast.For, ast.Expr, ast.If, ast.Compare,
    ast.Eq, ast.NotEq, ast.IfExp, ast.UnaryOp, ast.USub, ast.Pass,
}

def trusted_task(path):
    task = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    if set(task) != {"job_id", "workspace", "source_file", "test_file",
                     "function", "requirement", "public_only"}:
        raise ValueError("TASK_SCHEMA_REJECTED")
    if task["public_only"] is not True:
        raise ValueError("PRIVATE_INPUT_REJECTED")
    if not re.fullmatch(r"IMP-DEV-[A-Za-z0-9-]{4,70}", task["job_id"]):
        raise ValueError("JOB_ID_REJECTED")
    if not re.fullmatch(r"[A-Za-z_]\w{0,60}", task["function"]):
        raise ValueError("FUNCTION_NAME_REJECTED")
    if not isinstance(task["requirement"], str) or not 10 <= len(task["requirement"]) <= 600:
        raise ValueError("REQUIREMENT_BOUNDS")
    temp = Path(os.environ["TEMP"]).resolve()
    workspace = Path(task["workspace"]).resolve()
    if not workspace.is_relative_to(temp) or not workspace.name.startswith("imperion-dev-agent-"):
        raise ValueError("ONLY_TEMP_PUBLIC_WORKSPACE_ALLOWED")
    for field in ("source_file", "test_file"):
        basename = task[field]
        if not isinstance(basename, str) or not re.fullmatch(r"[A-Za-z0-9_-]+\.py", basename):
            raise ValueError("FILE_PATH_RESTRICTED")
        p = workspace / basename
        if not p.is_file() or p.is_symlink() or p.stat().st_size > 12000:
            raise ValueError("EXPECTED_PUBLIC_FILE_MISSING")
    if not (workspace / task["source_file"]).resolve().is_relative_to(workspace):
        raise ValueError("SYMLINK_REJECTED")
    return task, workspace

def candidate_is_safe(text, function):
    if not isinstance(text, str) or not 25 <= len(text) <= 1600:
        raise ValueError("MODEL_TEXT_BOUNDS")
    parsed = ast.parse(text)
    if len(parsed.body) != 1 or type(parsed.body[0]) is not ast.FunctionDef:
        raise ValueError("EXACTLY_ONE_PURE_FUNCTION_REQUIRED")
    fn = parsed.body[0]
    if fn.name != function or fn.decorator_list or fn.args.vararg or fn.args.kwarg:
        raise ValueError("MODEL_FUNCTION_MISMATCH")
    for part in ast.walk(parsed):
        if type(part) not in ALLOWED_AST:
            raise ValueError("MODEL_AST_DISALLOWED_" + type(part).__name__)
        if isinstance(part, ast.Name) and part.id.startswith("__"):
            raise ValueError("MODEL_MAGIC_NAME_REJECTED")
        if isinstance(part, ast.Call) and not (
            isinstance(part.func, ast.Name) and part.func.id in ("sum", "len")
        ):
            raise ValueError("MODEL_FUNCTION_CALL_REJECTED")
    return text.rstrip() + "\n"

def model_candidate(task, source, tests, feedback):
    prompt = (
        "You repair exactly one function in a PUBLIC synthetic Python test workspace. "
        "Return only a JSON object with exactly {replacement_function:string}. "
        "The replacement must contain a single function definition for "
        + task["function"] + " and NO imports, decorators, attribute access, "
        "file, network, subprocess, hidden names, or external calls. "
        "Use pure Python and permitted sum()/len() only. "
        "Requirement: " + task["requirement"] +
        "\nCurrent code:\n" + source +
        "\nTrusted unittest source:\n" + tests +
        "\nPrevious safe-test error: " + feedback
    )
    body = json.dumps({
        "model": MODEL, "prompt": prompt, "format": "json",
        "stream": False, "think": False,
        "options": {"num_gpu": 0, "num_predict": 300, "num_ctx": 2048, "temperature": 0.1}
    }).encode("utf8")
    req = Request(ENDPOINT, data=body, method="POST",
                  headers={"Content-Type": "application/json"})
    with urlopen(req, timeout=110) as response:
        answer = json.loads(response.read(9000))
    if answer.get("done") is not True or answer.get("model") != MODEL:
        raise ValueError("MODEL_COMPLETION_UNVERIFIED")
    response_text = answer.get("response")
    if not isinstance(response_text, str) or len(response_text) > 3000:
        raise ValueError("MODEL_OUTPUT_BOUNDS")
    result = json.loads(response_text)
    if not isinstance(result, dict) or set(result) != {"replacement_function"}:
        raise ValueError("MODEL_SCHEMA_REJECTED")
    return candidate_is_safe(result["replacement_function"], task["function"]), {
        "prompt_tokens": answer.get("prompt_eval_count"),
        "completion_tokens": answer.get("eval_count"),
        "duration_ns": answer.get("total_duration"),
    }

def run_tests(workspace, test_file):
    env = os.environ.copy()
    env["PYTHONNOUSERSITE"] = "1"
    r = subprocess.run(
        [sys.executable, "-m", "unittest", "discover", "-s", str(workspace),
         "-p", test_file, "-v"], cwd=workspace,
        text=True, capture_output=True, timeout=30, env=env
    )
    return r.returncode, (r.stdout + r.stderr)[-1200:]

def run(task_path):
    task, workspace = trusted_task(task_path)
    source_path = workspace / task["source_file"]
    tests_path = workspace / task["test_file"]
    before = source_path.read_text(encoding="utf-8-sig")
    tests = tests_path.read_text(encoding="utf-8-sig")
    tree = ast.parse(before)
    functions = [item for item in tree.body if isinstance(item, ast.FunctionDef)
                 and item.name == task["function"]]
    if len(functions) != 1 or len(tree.body) != 1:
        raise ValueError("EXISTING_SOURCE_NOT_SINGLE_FUNCTION")
    proof = {
        "job_id": task["job_id"], "model": MODEL, "public_only": True,
        "status": "PENDING", "external_paid_api_czk": 0,
        "model_can_commit": False, "model_can_deploy": False,
        "workspace": str(workspace),
        "source_file": task["source_file"],
        "before_sha256": hashlib.sha256(before.encode()).hexdigest(),
        "timestamp_utc": datetime.now(timezone.utc).isoformat(), "attempts": []
    }
    baseline, tail = run_tests(workspace, task["test_file"])
    proof["baseline_exit"] = baseline
    if baseline == 0:
        proof["status"] = "BASELINE_ALREADY_PASS_NO_EDIT"
    else:
        feedback = ""
        for i in range(1, 3):
            try:
                candidate, metrics = model_candidate(task, before, tests, feedback)
                source_path.write_text(candidate, encoding="utf-8")
                result, output = run_tests(workspace, task["test_file"])
                proof["attempts"].append({"n": i, "test_exit": result, **metrics})
                if result == 0:
                    proof["status"] = "LOCAL_MODEL_CODE_TEST_PASS"
                    proof["after_sha256"] = hashlib.sha256(candidate.encode()).hexdigest()
                    proof["code"] = candidate
                    break
                feedback = "Test failed: " + output[-500:]
            except Exception as exc:
                feedback = str(exc)[:160]
                proof["attempts"].append({"n": i, "rejection": feedback})
            finally:
                if proof["status"] != "LOCAL_MODEL_CODE_TEST_PASS":
                    source_path.write_text(before, encoding="utf-8")
        if proof["status"] != "LOCAL_MODEL_CODE_TEST_PASS":
            proof["status"] = "BLOCKED_MODEL_OR_TEST_FAILED_RESTORED"
    proof_path = workspace / "imperion-dev-proof.json"
    proof_path.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k:v for k,v in proof.items() if k != "code"}))
    return proof["status"] in ("LOCAL_MODEL_CODE_TEST_PASS", "BASELINE_ALREADY_PASS_NO_EDIT")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--task", required=True)
    opts = parser.parse_args()
    try:
        sys.exit(0 if run(opts.task) else 2)
    except Exception as exc:
        print(json.dumps({"status":"BLOCKED", "reason":str(exc)[:200]}))
        sys.exit(2)
