"""Scoped owner-only install of a TRUE Agent4 model capability readback.

No key, model download, credential, message, post, Telegram consumer, Supabase,
billing or CRM update. Patches only the existing localhost panel UI.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request

SOURCE=Path(__file__).resolve().parent/"agent4_model_tiers.py"
BACKUPS=Path(os.environ.get("LOCALAPPDATA",str(Path.home()/"AppData"/"Local"))) / "ImperionAgents" / "backups" / "agent4-model-tiers-20261115"

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def find_agent():
    parent=Path.home() / "OneDrive - MUNI" / "Dokumenty" / "ChatGPT"
    roots=[d for d in parent.glob("10 Imperion*") if d.is_dir() and (d/"agent-network"/"net.py").is_file()]
    if len(roots)!=1:raise RuntimeError("EXISTING_AGENT4_WORKSPACE_NOT_UNIQUE")
    return roots[0]/"agent-network"

def patch(original, old, new, name):
    if new in original:
        return original
    if original.count(old)!=1:
        raise RuntimeError("SOURCE_MARKER_MOVED_"+name)
    return original.replace(old,new,1)

def changes(root):
    p=(root/"panel.py").read_text(encoding="utf-8")
    h=(root/"panel.html").read_text(encoding="utf-8")
    p=patch(p, "import net\n", "import net\nimport agent4_model_tiers\n", "PY_IMPORT")
    p=patch(p, '    return {"ollama": model_status, "models": available,',
            '    return {"ollama": model_status, "models": available,\n'
            '            "model_tiers": agent4_model_tiers.panel_catalog(chosen[0] if chosen else ""),',
            "PY_HEALTH")
    h=patch(h,
            " h.inference_backend==='OLLAMA_CPU_ONLY'?'ИИ: CPU, локально · без внешнего AI API':'Режим ИИ не подтверждён',",
            " h.inference_backend==='OLLAMA_CPU_ONLY'?'ИИ: CPU, локально · без внешнего AI API':'Режим ИИ не подтверждён',\n"
            " h.model_tiers?.strongest_public?.model\n"
            "   ?'GPT-OSS 120B: только публичные черновики через GitHub; личные сообщения остаются локально'\n"
            "   :'Сильнейший внешний AI: не подключён к личным чатам',",
            "HTML_STATUS")
    h=patch(h, '<p class="note">Telegram подключается отдельными процессами.',
            '<p class="note">Более сильная GPT-OSS 120B: '
            '<a href="https://github.com/aliaksei-chareshneu/alchareshneu/actions/workflows/imperion-groq-free-draft-smoke.yml" target="_blank" rel="noopener noreferrer">'
            'GitHub Actions (только подтверждённые публичные данные)</a>. '
            'Личные Telegram-чаты остаются на локальном AI, без передачи Groq.</p>'
            '<p class="note">Telegram подключается отдельными процессами.',
            "PUBLIC_GROQ_LINK")
    return {"panel.py":p.encode("utf-8"),"panel.html":h.encode("utf-8"),
            "agent4_model_tiers.py":SOURCE.read_bytes()}

def verify_python(root):
    py=root/".venv"/"Scripts"/"python.exe"
    if not py.is_file():raise RuntimeError("AGENT4_EXISTING_VENV_MISSING")
    subprocess.run([str(py),"-m","py_compile",str(root/"panel.py"),
                    str(root/"agent4_model_tiers.py")],check=True,timeout=25,
                    cwd=str(root),capture_output=True)
    tests=subprocess.run([str(py),"-m","unittest","discover","-p","test_*.py","-q"],
                         check=False,timeout=75,cwd=str(root),capture_output=True,text=True)
    if tests.returncode!=0:raise RuntimeError("AGENT4_UNITTEST_REGRESSION")
    one=subprocess.run([str(py),"-c",
        "import agent4_model_tiers as m; p=m.panel_catalog('imperion-qwen35:4b');"
        " assert p['strongest_public']['model']=='openai/gpt-oss-120b';"
        " assert not p['strongest_public']['private_chat_allowed'];"
        " print('MODEL_GATES_PASS')"],check=False,timeout=20,cwd=str(root),
        capture_output=True,text=True)
    if one.returncode!=0 or "MODEL_GATES_PASS" not in one.stdout:
        raise RuntimeError("LOCAL_POLICY_SAFETY_TEST_FAILED")
    return tests.stderr[-220:].replace("\r","").strip()

def verify_panel():
    with urllib.request.urlopen("http://127.0.0.1:8766/api/state",timeout=8) as response:
        if response.status!=200:raise RuntimeError("PANEL_HTTP_FAILED")
        state=json.load(response).get("health",{})
    tiers=state.get("model_tiers") or {}
    if state.get("model") not in ("imperion-qwen35:4b","qwen3:4b"):
        raise RuntimeError("ACTIVE_PRIVATE_MODEL_UNVERIFIED")
    if (tiers.get("strongest_public",{}).get("model")!="openai/gpt-oss-120b" or
        tiers.get("strongest_public",{}).get("private_chat_allowed") is not False or
        tiers.get("private",{}).get("cloud_allowed") is not False or
        state.get("inference_backend")!="OLLAMA_CPU_ONLY"):
        raise RuntimeError("PUBLIC_PRIVATE_MODEL_READBACK_MISMATCH")
    return {"private_active_model":state.get("model"),
            "public_strong_model":tiers["strongest_public"]["model"],
            "private_cloud_allowed":tiers["private"]["cloud_allowed"],
            "personal_telegram_session":state.get("telegram_session"),
            "worker_operational":state.get("worker",{}).get("operational")}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--apply",action="store_true")
    a=ap.parse_args()
    if not SOURCE.is_file():raise RuntimeError("MODEL_TIER_SOURCE_MISSING")
    root=find_agent()
    patch_data=changes(root)
    print(json.dumps({"status":"PATCH_PREFLIGHT_PASS","apply":a.apply,
                      "files":list(patch_data),"private_cloud_disallowed":True}))
    if not a.apply:return
    BACKUPS.mkdir(parents=True,exist_ok=True)
    for name in ("panel.py","panel.html"):
        backup=BACKUPS/name
        current=root/name
        if not backup.exists():
            shutil.copy2(current,backup)
    # A failed install returns the old owner source. The historical policy
    # did not affect any user's messages, jobs, payments or cloud credentials.
    prior={name:(root/name).read_bytes() if (root/name).exists() else None for name in patch_data}
    try:
        for name,payload in patch_data.items():
            if prior[name] != payload:
                dest=root/name
                tmp=root/(name+".agent4-modeltmp")
                tmp.write_bytes(payload)
                tmp.replace(dest)
        result=verify_python(root)
        print(json.dumps({"status":"LOCAL_MODEL_TIER_TESTS_PASS","tests":result[-160:]}))
    except Exception:
        for name,blob in prior.items():
            path=root/name
            if blob is None:
                if path.exists():path.unlink()
            else:path.write_bytes(blob)
        raise
    # The caller restarts ONLY the existing DraftPanel Task, then calls
    # --verify-panel using an owner-only PowerShell readback. We do NOT
    # kill or restart any Telegram consumer or source watcher.
    print(json.dumps({"status":"LOCAL_MODEL_TIERS_INSTALLED_RESTART_PANEL_REQUIRED"}))
if __name__=="__main__":
    try:main()
    except Exception as exc:
        print(json.dumps({"status":"BLOCKED","reason":type(exc).__name__,
                          "error_code":str(exc)[:100]}))
        raise SystemExit(2)
