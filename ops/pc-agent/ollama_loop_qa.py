# IMPERION #5: local model multi-step QA, bounded to synthetic note.
# Never sends model output to shell; all execution passes restricted_executor.
import hashlib
import json
import sys
import tempfile
import urllib.request
from pathlib import Path
from restricted_executor import executor

MODEL = "imperion-qwen3-cpu:0.6b"
URL = "http://127.0.0.1:11434/api/generate"
ACTIONS = ("write_note", "hash_note", "read_note", "erase_note")
EXPECTED_TEXT = "IMPERION_AGENT5_SYNTHETIC_OK"
SCHEMA = {
    "type": "object",
    "properties": {
        "action": {"type": "string", "enum": list(ACTIONS)},
        "text": {"type": "string"}
    },
    "required": ["action"],
    "additionalProperties": False
}

def select_action(stage, observation):
    message = (
        "You plan a SAFE synthetic file QA job with four stages. "
        "Only actions: write_note, hash_note, read_note, erase_note. "
        "Do not suggest shell, paths, browser, other resources or permissions. "
        "Goal: create exact text IMPERION_AGENT5_SYNTHETIC_OK, hash it, read it, erase it. "
        "Stage " + str(stage + 1) + " of 4. Previous verified step: " + observation + ". "
        "Pick the necessary NEXT action. "
        "Stage 1 = write_note with text IMPERION_AGENT5_SYNTHETIC_OK; "
        "stage 2 = hash_note; stage 3 = read_note; stage 4 = erase_note. "
        "Return only JSON object {action, text?}, without any other keys."
    )
    payload = {
        "model": MODEL, "prompt": message, "format": SCHEMA, "think": False,
        "stream": False, "keep_alive": 0,
        "options": {"num_gpu": 0, "num_ctx": 1024, "num_predict": 120, "temperature": 0}
    }
    req = urllib.request.Request(
        URL, data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=45) as response:
        raw = json.load(response)
    output = raw.get("response", "")
    if not isinstance(output, str) or len(output) > 2500:
        raise ValueError("MODEL_OUTPUT_OVERSIZE")
    return json.loads(output)

def main():
    receipts = []
    with tempfile.TemporaryDirectory(prefix="imperion-a5-llm-loop-") as temp:
        root = Path(temp) / "synthetic"
        last = "START"
        for step, required_action in enumerate(ACTIONS):
            try:
                choice = select_action(step, last)
            except Exception as ex:
                print(json.dumps({"status": "MODEL_UNAVAILABLE", "step": step, "type": type(ex).__name__, "http_code": getattr(ex, "code", None)}))
                return 2
            if not isinstance(choice, dict) or set(choice) - {"action", "text"}:
                print(json.dumps({"status": "BLOCKED", "reason": "UNTRUSTED_MODEL_FIELDS", "step": step}))
                return 3
            if choice.get("action") != required_action:
                print(json.dumps({"status": "BLOCKED", "reason": "MODEL_WRONG_NEXT_STEP", "step": step, "requested": str(choice.get("action"))[:40]}))
                return 4
            if step == 0 and choice.get("text") != EXPECTED_TEXT:
                print(json.dumps({"status": "BLOCKED", "reason": "MODEL_INVALID_NOTE_TEXT", "step": step}))
                return 5
            # Extra text on read/hash/delete is untrusted model chatter:
            # discard it instead of forwarding it to the executor.
            if step > 0 and "text" in choice:
                choice.pop("text", None)
            task = {"action": required_action, "key": "SYN-LOOPSTEP" + str(step + 1)}
            if step == 0:
                task["text"] = EXPECTED_TEXT
            receipt = executor(task, write_granted=True, root=root)
            receipts.append({"action": required_action, "status": receipt.get("status"), "sha256": receipt.get("sha256")})
            if receipt.get("status") != "DONE":
                print(json.dumps({"status": "FAILED", "reason": receipt.get("reason"), "step": step}))
                return 7
            last = required_action + ":" + receipt.get("status", "UNKNOWN")
            if step == 1:
                target_digest = hashlib.sha256(EXPECTED_TEXT.encode("utf-8")).hexdigest()
                if receipt.get("sha256") != target_digest:
                    print(json.dumps({"status": "FAIL_HASH_READBACK", "step": step}))
                    return 8
            if step == 2 and receipt.get("text") != EXPECTED_TEXT:
                print(json.dumps({"status": "FAIL_CONTENT_READBACK", "step": step}))
                return 9
        cleaned = not (root / "synthetic-note.txt").exists()
        print(json.dumps({"status": "PASS" if cleaned else "FAIL", "model": MODEL,
            "steps_executed": len(receipts), "receipts": receipts,
            "file_deleted": cleaned, "external_actions": 0}))
        return 0 if cleaned else 10

if __name__ == "__main__":
    sys.exit(main())
