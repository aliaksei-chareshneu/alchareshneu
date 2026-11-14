"""IMPERION Agent #5: strongest *installed* no-cost local model as advisory planner.

Only fixed, synthetic intents are accepted. A model cannot authorize or execute a
GUI action, change the allowlist, read files, choose a URL, or call a shell. Do not
load a model on the memory-constrained workstation unless the RAM gate passes.

Cloud GPT-OSS 120B remains in the EXISTING server-only trusted public/synthetic
inference gateway. It is intentionally NOT called from this Windows worker,
because its service-role authentication must never be copied to the PC.
"""
from __future__ import annotations

import json
import sys
import urllib.request
from typing import Callable

PREFERRED_LOCAL_MODEL = "imperion-qwen35:4b"
HISTORICAL_LOCAL_MODEL = "imperion-qwen3-cpu:0.6b"
EXISTING_CLOUD_GATEWAY_MODEL = "openai/gpt-oss-120b"
OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
# 2.8GB model weights + runtime and Windows headroom; not a resource guarantee.
MIN_FREE_RAM_MB = 5120
MAX_REQUEST_BYTES = 240
MAX_RESPONSE_BYTES = 1600
MODEL_TIMEOUT_SECONDS = 35
ALLOWED_GOALS = {
    "synthetic_notepad_gui": "notepad_gui_pilot",
    "synthetic_csv_report": "csv_report",
}
MODEL_SCHEMA = {
    "type": "object",
    "properties": {"route": {"type": "string", "enum": sorted(ALLOWED_GOALS.values())}},
    "required": ["route"],
    "additionalProperties": False,
}


def denied(reason: str) -> dict:
    return {"status": "BLOCKED", "reason": reason, "mode": "model_plan"}


def _call_local_model(goal: str) -> object:
    """No arbitrary user text or external data ever reaches a model."""
    route = ALLOWED_GOALS[goal]
    message = (
        "You are a planning classifier with NO tools, privileges or approval. "
        "Return a single JSON object with one field route. "
        "This is purely SYNTHETIC QA, never a real file, email or customer. "
        "Allowed route values are notepad_gui_pilot or csv_report. "
        f"The fixed synthetic goal is {goal}; its required route is {route}. "
        "Do NOT output commands, paths, instructions, code, tokens or other fields."
    )
    request_body = {
        "model": PREFERRED_LOCAL_MODEL,
        "prompt": message,
        "stream": False,
        "format": MODEL_SCHEMA,
        "think": False,
        "keep_alive": 0,
        "options": {"num_gpu": 0, "num_ctx": 1024, "num_predict": 70, "temperature": 0},
    }
    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(request_body, ensure_ascii=True).encode("ascii"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=MODEL_TIMEOUT_SECONDS) as resp:
        if resp.getcode() != 200:
            raise ValueError("LOCAL_MODEL_HTTP_ERROR")
        raw = resp.read(MAX_RESPONSE_BYTES + 1)
    if not raw or len(raw) > MAX_RESPONSE_BYTES:
        raise ValueError("LOCAL_MODEL_RESPONSE_SIZE")
    envelope = json.loads(raw)
    if not isinstance(envelope, dict) or envelope.get("done") is not True or envelope.get("done_reason") not in (None, "stop"):
        raise ValueError("LOCAL_MODEL_NOT_FINISHED")
    answer = envelope.get("response")
    if not isinstance(answer, str) or len(answer) > 250:
        raise ValueError("MODEL_ANSWER_INVALID")
    return json.loads(answer)


def operate(payload: object, *, system: str | None = None,
            memory_reader: Callable[[], tuple[int, int]] | None = None,
            infer: Callable[[str], object] | None = None) -> dict:
    if not isinstance(payload, dict) or not isinstance(payload.get("mode"), str):
        return denied("BAD_PAYLOAD")
    try:
        if len(json.dumps(payload, ensure_ascii=True).encode("utf-8")) > MAX_REQUEST_BYTES:
            return denied("PAYLOAD_TOO_LARGE")
    except (TypeError, ValueError, UnicodeError):
        return denied("BAD_PAYLOAD")
    if payload["mode"] == "model_capabilities":
        if set(payload) != {"mode"}:
            return denied("FIELDS_NOT_ALLOWED")
        return {
            "status": "DONE", "mode": "model_capabilities",
            "preferred_local_model": PREFERRED_LOCAL_MODEL,
            "previous_local_model": HISTORICAL_LOCAL_MODEL,
            "trusted_cloud_gateway_model": EXISTING_CLOUD_GATEWAY_MODEL,
            "trusted_cloud_gateway_access": "NOT_EXPOSED_TO_WINDOWS_WORKER",
            "minimum_free_ram_mb_for_local_inference": MIN_FREE_RAM_MB,
            "allowed_goals": sorted(ALLOWED_GOALS),
            "external_or_private_data": "DENIED",
            "shell_and_gui_permissions": "UNCHANGED",
            "model_is_authority": False,
        }
    if payload.get("mode") != "model_plan" or set(payload) != {"mode", "goal", "data_class"}:
        return denied("FIELDS_NOT_ALLOWED")
    goal = payload.get("goal")
    if type(goal) is not str or goal not in ALLOWED_GOALS or payload.get("data_class") != "SYNTHETIC":
        return denied("GOAL_OR_CLASS_DENIED")
    if (sys.platform if system is None else system) != "win32":
        return denied("WINDOWS_REQUIRED")
    try:
        if memory_reader is None:
            from pc_desktop_v4 import win_memory
            memory_reader = win_memory
        free, total = memory_reader()
        if (type(free) is not int or type(total) is not int or total <= 0
                or free < 0 or free > total):
            return denied("MEMORY_READBACK_INVALID")
        if free < MIN_FREE_RAM_MB:
            return denied("MODEL_LOW_MEMORY_NO_INFERENCE")
        proposal = (infer or _call_local_model)(goal)
    except (OSError, ValueError, TypeError, TimeoutError, RuntimeError, ConnectionError, UnicodeError) as error:
        return denied("MODEL_UNAVAILABLE_OR_INVALID_" + type(error).__name__.upper())
    if not isinstance(proposal, dict) or set(proposal) != {"route"}:
        return denied("UNTRUSTED_MODEL_FIELDS")
    if proposal["route"] != ALLOWED_GOALS[goal]:
        return denied("MODEL_ROUTE_NOT_MATCHED")
    return {
        "status": "READY", "mode": "model_plan", "model": PREFERRED_LOCAL_MODEL,
        "goal": goal, "route": proposal["route"], "no_action_executed": True,
        "scope": "SYNTHETIC_ONLY", "next": "SCOPED_OWNER_GO_FOR_ACTION",
        "cloud_cost_kc": 0,
    }
