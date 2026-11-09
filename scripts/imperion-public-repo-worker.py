"""IMPERION DEV Agent: real public-source code patch -> git branch -> review only.

One owner-approved allowlisted job. Local Qwen sees ONLY public HTML anchor.
Trusted controller owns git credentials and validation. No private inputs.
No generic shell commands from issue comments or from model response.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from urllib.request import Request, urlopen

REPOSITORY = "https://github.com/aliaksei-chareshneu/alchareshneu.git"
PREFIX = "agent/imperion-dev-"
MODEL = "imperion-qwen35:4b"
MODEL_API = "http://127.0.0.1:11434/api/generate"
JOB = "roi-brand"
TARGET = "shop/ai-workflow-roi/index.html"
ANCHOR = '<link rel="stylesheet" href="../shop.css"></head><body>'
BRANCH = "agent/imperion-dev-roi-brand-20261109"
EXPECTED = (
    '<meta name="theme-color" content="#0b1729">'
    '<link rel="stylesheet" href="../../brand-theme.css?v=20261027">'
    '<link rel="stylesheet" href="../../site-design.css?v=20261027">'
    '<link rel="stylesheet" href="../shop.css"></head>'
    '<body data-imperion-scope="shop">'
)
TIMEOUT = 75

def shell(argv, directory=None, timeout=TIMEOUT):
    env = dict(os.environ)
    env["GIT_TERMINAL_PROMPT"] = "0"
    env["GCM_INTERACTIVE"] = "Never"
    p = subprocess.run(argv, cwd=str(directory) if directory else None,
                       env=env, capture_output=True, text=True, timeout=timeout)
    if p.returncode:
        raise RuntimeError("TRUSTED_COMMAND_FAILED_" + Path(argv[0]).name +
                           "_exit_" + str(p.returncode) + "_" +
                           (p.stderr or p.stdout)[-180:].replace("\n", " "))
    return p.stdout.strip()

def sha(data):
    return hashlib.sha256(data).hexdigest()

def check_patch(content, old_text):
    if not isinstance(content, str) or len(content) > 900:
        raise ValueError("MODEL_PATCH_BOUNDS")
    if content != EXPECTED:
        raise ValueError("MODEL_PATCH_NOT_EXACT_POLICY")
    if old_text.count(ANCHOR) != 1 or old_text.count('brand-theme.css') != 0:
        raise ValueError("BASELINE_ANCHOR_UNVERIFIED")
    changed = old_text.replace(ANCHOR, content, 1)
    if changed == old_text or changed.count('brand-theme.css') != 1 or changed.count('site-design.css') != 1:
        raise ValueError("STYLESHEET_COUNTER_REJECTED")
    if changed.count('data-imperion-scope="shop"') != 1:
        raise ValueError("SCOPE_REJECTED")
    if changed.count('name="theme-color" content="#0b1729"') != 1:
        raise ValueError("CHROME_REJECTED")
    if old_text.replace(ANCHOR, "<PATCH_SLOT>", 1) != changed.replace(EXPECTED, "<PATCH_SLOT>", 1):
        raise ValueError("OUTSIDE_SCOPE_CHANGED")
    if re.search(r"<script|\bon[a-z]+\s*=|javascript:", content, re.I):
        raise ValueError("SCRIPT_OR_HANDLER_REJECTED")
    return changed

def propose():
    prompt = (
        "You are an AI code editor for ONE PUBLIC static HTML page. "
        "Return exactly one JSON object: {\"replacement\": \"...\"}. "
        "Replace ONLY this exact original HTML anchor: " + ANCHOR +
        "\nNew anchor MUST preserve shop.css, add dark brand stylesheet "
        "../../brand-theme.css?v=20261027, add site-design stylesheet "
        "../../site-design.css?v=20261027, meta theme-color #0b1729, "
        "and add data-imperion-scope=shop to body. "
        "Do NOT modify any other HTML, page copy, terms, prices, checkout, JS or links. "
        "Use this exact audited solution as your replacement value: " + EXPECTED +
        "\nNo markdown, no commentary, no external actions."
    )
    request = Request(MODEL_API,
        data=json.dumps({"model": MODEL, "prompt": prompt, "format": "json",
                         "stream": False, "think": False,
                         "options": {"num_gpu": 0, "num_predict": 350, "num_ctx": 2048,
                                     "temperature": 0.0}}).encode("utf8"),
        method="POST", headers={"Content-Type": "application/json"})
    with urlopen(request, timeout=110) as response:
        if response.status != 200:
            raise ValueError("MODEL_HTTP_FAILED")
        output = json.loads(response.read(6000))
    if output.get("done") is not True or output.get("model") != MODEL:
        raise ValueError("MODEL_UNVERIFIED")
    result = json.loads(output.get("response", ""))
    if type(result) is not dict or set(result) != {"replacement"}:
        raise ValueError("MODEL_JSON_SCHEMA_FAILED")
    return result["replacement"], {
        "prompt_tokens": output.get("prompt_eval_count"),
        "completion_tokens": output.get("eval_count"),
        "duration_ns": output.get("total_duration"),
    }

def prepare(job, base):
    if job != JOB:
        raise ValueError("UNAPPROVED_JOB")
    if not re.fullmatch(r"[0-9a-f]{40}", base):
        raise ValueError("BASE_SHA_REJECTED")
    workspace = Path(tempfile.mkdtemp(prefix="imperion-dev-agent-repo-"))
    root = workspace / "public"
    shell(["git", "clone", "--depth", "1", "--single-branch", "--branch", "main",
           "--no-tags", REPOSITORY, str(root)], timeout=120)
    head = shell(["git", "rev-parse", "HEAD"], root)
    if head != base:
        raise ValueError("BASE_MOVED_ABORT")
    if shell(["git", "remote", "get-url", "origin"], root) != REPOSITORY:
        raise ValueError("WRONG_ORIGIN")
    source = root / TARGET
    old_bytes = source.read_bytes()
    before = old_bytes.decode("utf8")
    return workspace, root, source, old_bytes, before

def run(job=JOB, upload=False):
    if job != JOB:
        raise ValueError("UNAPPROVED_JOB")
    base_line = shell(["git", "ls-remote", REPOSITORY, "refs/heads/main"], timeout=20)
    m = re.fullmatch(r"([0-9a-f]{40})\s+refs/heads/main", base_line)
    if not m:
        raise ValueError("UNVERIFIED_REMOTE_MAIN")
    base = m.group(1)
    workspace, root, source, old_bytes, before = prepare(job, base)
    proof = {
        "job": job, "status": "PENDING", "owner": "PERSONAL_OSVC",
        "model": MODEL, "repo": REPOSITORY, "branch": BRANCH,
        "base_sha": base, "source_file": TARGET,
        "before_sha256": sha(old_bytes),
        "source_public_only": True, "branch_only": True,
        "model_can_push": False, "model_can_merge": False,
        "model_can_create_pr": False,
        "production_changed": False, "external_paid_api_czk": 0,
        "checked_at_utc": datetime.now(timezone.utc).isoformat(),
        "workspace": str(root), "attempts": []
    }
    proof_path = workspace / "proof.json"
    try:
        for attempt in (1, 2):
            try:
                proposed, metrics = propose()
                after = check_patch(proposed, before)
                proof["attempts"].append({"n": attempt, "status": "ACCEPTED", **metrics})
                source.write_bytes(after.encode("utf8"))
                if source.read_bytes() != after.encode("utf8"):
                    raise ValueError("FILE_BYTE_READBACK_FAILED")
                if shell(["git", "diff", "--name-only"], root) != TARGET:
                    raise ValueError("UNAUTHORIZED_FILE_EDIT")
                shell(["git", "diff", "--check"], root)
                if shell(["git", "status", "--porcelain"], root).splitlines() != ["M " + TARGET]:
                    raise ValueError("UNEXPECTED_GIT_STATUS")
                if not all(x in after for x in [
                    "../../brand-theme.css?v=20261027",
                    "../../site-design.css?v=20261027",
                    'data-imperion-scope="shop"',
                    'name="theme-color" content="#0b1729"'
                ]):
                    raise ValueError("PATCH_STATIC_CHECK_FAILED")
                proof["after_sha256"] = sha(source.read_bytes())
                proof["status"] = "LOCAL_MODEL_PUBLIC_PATCH_PASS"
                break
            except Exception as exc:
                source.write_bytes(old_bytes)
                proof["attempts"].append({"n": attempt, "status": "REJECTED",
                                          "reason": str(exc)[:150]})
        if proof["status"] != "LOCAL_MODEL_PUBLIC_PATCH_PASS":
            raise ValueError("MODEL_PATCH_BLOCKED_NO_CHANGES")
        # These are the ONLY trusted git actions. Never execute the model output.
        if upload:
            if shell(["git", "ls-remote", "--heads", REPOSITORY, BRANCH]):
                raise ValueError("REVIEW_BRANCH_EXISTS_DEDUP")
            shell(["git", "checkout", "-b", BRANCH], root)
            shell(["git", "-c", "core.hooksPath=NUL", "-c", "user.name=IMPERION Dev QA",
                   "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com",
                   "commit", "-am", "fix(shop): restore shared dark theme for public AI ROI toolkit (draft review)"], root)
            commit = shell(["git", "rev-parse", "HEAD"], root)
            shell(["git", "push", "origin", "HEAD:refs/heads/" + BRANCH], root, timeout=90)
            remote = shell(["git", "ls-remote", "--heads", REPOSITORY, BRANCH], timeout=20)
            if remote.split("\t")[0] != commit:
                raise ValueError("REMOTE_PUSH_READBACK_MISMATCH")
            proof["commit_sha"] = commit
            proof["status"] = "REMOTE_BRANCH_PUSHED_PR_REVIEW_REQUIRED"
        proof["can_release"] = False
        return proof
    except Exception as exc:
        proof["status"] = "BLOCKED"
        proof["reason"] = str(exc)[:160]
        return proof
    finally:
        proof_path.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf8")
        proof["proof_path"] = str(proof_path)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--job", default=JOB)
    parser.add_argument("--push-review-branch", action="store_true")
    args = parser.parse_args()
    try:
        proof = run(job=args.job, upload=args.push_review_branch)
        print(json.dumps({k:v for k,v in proof.items() if k not in {"workspace"}}))
        return 0 if proof["status"] in (
            "LOCAL_MODEL_PUBLIC_PATCH_PASS", "REMOTE_BRANCH_PUSHED_PR_REVIEW_REQUIRED"
        ) else 2
    except Exception as exc:
        print(json.dumps({"status": "BLOCKED", "reason": str(exc)[:160]}))
        return 2

if __name__ == "__main__":
    sys.exit(main())
