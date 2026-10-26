"""One-command local ShortFactory: cached libre footage + Kokoro + two motion MP4s.

No commercial generator API, login, credits, uploads or public publishing.
"""
from __future__ import annotations
import argparse, hashlib, json, os, shutil, subprocess, sys, tempfile, urllib.parse, urllib.request
from pathlib import Path

MODEL_URL="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.0.onnx"
VOICES_URL="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.0.bin"
ALLOWED_HOSTS={"github.com","upload.wikimedia.org","commons.wikimedia.org"}
ROOT=Path(__file__).resolve().parent

def fetch(url, target, *, minbytes=50000):
    host=urllib.parse.urlparse(url).hostname
    if host not in ALLOWED_HOSTS or not url.startswith("https://"):
        raise ValueError("Unapproved download origin: "+str(host))
    target=Path(target)
    if target.is_file() and target.stat().st_size>=minbytes:
        print("CACHE",target,flush=True); return
    target.parent.mkdir(parents=True,exist_ok=True)
    partial=Path(str(target)+".partial")
    if partial.exists(): partial.unlink()
    req=urllib.request.Request(url,headers={"User-Agent":
        "MoravianHostShortFactory/1.0 (https://aliaksei-chareshneu.github.io/alchareshneu/)"})
    try:
        with urllib.request.urlopen(req,timeout=120) as res,partial.open("wb") as f:
            while True:
                part=res.read(1024*1024)
                if not part: break
                f.write(part)
        if partial.stat().st_size<minbytes: raise IOError("Download truncated or blocked: "+url)
        os.replace(partial,target)
    finally:
        if partial.exists(): partial.unlink()
    print("DOWNLOADED",target,target.stat().st_size,flush=True)

def call(argv):
    print("RUN",argv[1] if len(argv)>1 else argv[0],flush=True)
    subprocess.run(argv,check=True,timeout=1400,cwd=ROOT)

def run(config, script, dest, cache, voice="bm_george", speed=1.10):
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise RuntimeError("Please install free FFmpeg and ffprobe first (in PATH).")
    if not (ROOT/"cinematic_shorts.py").exists() or not (ROOT/"shortfactory_voice_kokoro.py").exists():
        raise RuntimeError("Run this script inside the existing ShortFactory repository.")
    cfg=json.loads(config.read_text(encoding="utf-8"))
    if cfg.get("license") not in {"CC BY-SA 4.0", "OWNED_ORIGINAL"} or cfg.get("published") is not False:
        raise ValueError("License or review gate failure")
    import kokoro_onnx, soundfile, PIL
    media=cache/"media"; model=cache/"kokoro-v1.0.onnx"; voices=cache/"voices-v1.0.bin"
    for name,meta in cfg["assets"].items():
        fetch(meta["download"],media/meta["filename"],minbytes=50000)
    fetch(MODEL_URL,model,minbytes=80000000)
    fetch(VOICES_URL,voices,minbytes=1000000)
    with tempfile.TemporaryDirectory(prefix="free-shortfactory-") as tmp:
        voice_dir=Path(tmp)/"narration"
        call([sys.executable,str(ROOT/"shortfactory_voice_kokoro.py"),
            "--script",str(script),"--model",str(model),"--voices",str(voices),
            "--voice",voice,"--speed",str(speed),"--output",str(voice_dir)])
        voice_file=voice_dir/"roman_training_narrated_preview.wav"
        subtitle_file=voice_dir/"roman_training_narrated_preview.srt"
        if not voice_file.is_file(): raise RuntimeError("TTS stage did not produce audio")
        call([sys.executable,str(ROOT/"cinematic_shorts.py"),
            "--script",str(config),"--media-dir",str(media),"--voice",str(voice_file),
            "--srt",str(subtitle_file),"--outdir",str(dest)])
    report=json.loads((dest/"QA.json").read_text(encoding="utf-8"))
    if set(report["variants"])!={"action","documentary"}: raise RuntimeError("Missing review videos")
    print("SUCCESS",json.dumps(report["variants"],indent=2),flush=True)

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--config",type=Path,default=ROOT/"examples/roman_motion_free_20261025.json")
    p.add_argument("--script",type=Path,default=ROOT/"examples/roman_training_voice_20261025.json")
    p.add_argument("--outdir",type=Path,default=ROOT/"preview"/"free-motion")
    p.add_argument("--cache",type=Path,default=Path.home()/".cache"/"MoravianHost"/"ShortFactory")
    p.add_argument("--check",action="store_true")
    a=p.parse_args()
    if a.check:
        cfg=json.loads(a.config.read_text(encoding="utf-8"))
        print(json.dumps({"status":"CONFIG_ONLY","credits_per_video":0,"assets":list(cfg.get("assets",{})),"variants":list(cfg.get("variants",{}))}))
    else:
        run(a.config.resolve(),a.script.resolve(),a.outdir.expanduser().resolve(),a.cache.expanduser().resolve())
