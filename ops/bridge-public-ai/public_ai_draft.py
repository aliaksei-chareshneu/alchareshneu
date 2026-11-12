"""Bounded public-only local Qwen adapter for existing BrowserBridge worker.

No arbitrary shell, prompts, URLs, filesystem paths, credentials, private
messages, data exports, publication or payments accepted from queue payloads.
The trusted Node model runner is installed from the existing reviewed site
repository. Every output is an OWNER_REVIEW draft or a fail-closed block.
"""
import json
import os
from pathlib import Path
import re
import subprocess

DEFAULT_REPO = Path.home() / "ChatGPT-Workspace" / "80-Digital-Platform-Automation" / "local-tools" / "public-ai-runtime"
NODE_EXE = Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "nodejs" / "node.exe"
SOURCE_URLS = {
    "https://aliaksei-chareshneu.github.io/alchareshneu/corporate/",
    "https://aliaksei-chareshneu.github.io/alchareshneu/druzina/",
    "https://aliaksei-chareshneu.github.io/alchareshneu/autopilot/feed.json",
}
FIELDS = frozenset(("job_id", "owner_entity", "source_url", "purpose", "language"))
JOB_ID = re.compile(r"^[A-Za-z0-9._-]{6,120}$")


def blocked(reason, job_id=None):
    return {
        "status": "BLOCKED", "reason": reason,
        "job_id": job_id if isinstance(job_id, str) and JOB_ID.fullmatch(job_id) else None,
        "owner_approval_required": True,
        "messages_sent": 0, "posts_published": 0, "payments_created": 0,
        "external_actions": 0,
    }


def validate(payload):
    if not isinstance(payload, dict) or frozenset(payload) != FIELDS:
        return "PUBLIC_AI_SCHEMA_DENIED"
    if not isinstance(payload.get("job_id"), str) or not JOB_ID.fullmatch(payload["job_id"]):
        return "PUBLIC_AI_JOB_ID_DENIED"
    if payload.get("owner_entity") != "OSVC":
        return "PUBLIC_AI_ENTITY_DENIED"
    if payload.get("source_url") not in SOURCE_URLS:
        return "PUBLIC_AI_URL_DENIED"
    if payload.get("purpose") != "PUBLIC_TRANSLATION_DRAFT":
        return "PUBLIC_AI_PURPOSE_DENIED"
    if payload.get("language") not in ("cs", "en", "ru", "uk"):
        return "PUBLIC_AI_LANGUAGE_DENIED"
    return None


def dispatch(payload, repo_root=DEFAULT_REPO, runner=subprocess.run):
    reason = validate(payload)
    if reason:
        return blocked(reason, payload.get("job_id") if isinstance(payload, dict) else None)
    root = Path(repo_root)
    entry = root / "scripts" / "imperion-public-model-worker.cjs"
    if root.is_symlink() or not root.is_dir() or entry.is_symlink() or not entry.is_file():
        return blocked("TRUSTED_ROUTER_NOT_DEPLOYED", payload["job_id"])
    if not NODE_EXE.is_file():
        return blocked("NODE_RUNTIME_NOT_INSTALLED", payload["job_id"])
    env = {key: os.environ[key] for key in ("SYSTEMROOT", "WINDIR", "TEMP", "TMP", "LOCALAPPDATA")
           if key in os.environ}
    if "LOCALAPPDATA" not in env:
        return blocked("LOCAL_QUOTA_STATE_UNAVAILABLE", payload["job_id"])
    try:
        completed = runner(
            [str(NODE_EXE), str(entry)],
            input=json.dumps(payload, ensure_ascii=True),
            capture_output=True, text=True, encoding="utf-8",
            timeout=80, cwd=str(root), env=env,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return blocked("PUBLIC_AI_LOCAL_EXECUTION_TIMEOUT_OR_ERROR", payload["job_id"])
    if completed.returncode != 0 or not 1 <= len(completed.stdout or "") <= 10000:
        return blocked("PUBLIC_AI_LOCAL_EXECUTION_FAILED", payload["job_id"])
    try:
        result = json.loads(completed.stdout)
    except (ValueError, TypeError):
        return blocked("PUBLIC_AI_RESULT_JSON_INVALID", payload["job_id"])
    if not isinstance(result, dict) or result.get("job_id") != payload["job_id"] or result.get("status") not in ("DRAFT_FOR_OWNER_REVIEW", "BLOCKED"):
        return blocked("PUBLIC_AI_RESULT_SCHEMA_DENIED", payload["job_id"])
    if any(result.get(x) != 0 for x in ("messages_sent", "posts_published", "payments_created", "external_actions")):
        return blocked("PUBLIC_AI_SIDE_EFFECTS_NOT_ALLOWED", payload["job_id"])
    if result.get("owner_approval_required") is not True:
        return blocked("PUBLIC_AI_OWNER_REVIEW_REQUIRED", payload["job_id"])
    if result["status"] == "DRAFT_FOR_OWNER_REVIEW":
        if result.get("provider") != "ollama_local" or result.get("model") != "imperion-qwen35:4b":
            return blocked("PUBLIC_AI_PROVIDER_DENIED", payload["job_id"])
        if result.get("source_checked") is not True or not isinstance(result.get("draft"), str):
            return blocked("PUBLIC_AI_SOURCE_OR_DRAFT_INVALID", payload["job_id"])
    return result
