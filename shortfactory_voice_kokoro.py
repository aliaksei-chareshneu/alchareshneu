"""Render an original ShortFactory review draft with licensed Kokoro neural voiceover.

Existing original_reel_builder renders the vertical educational visual panels.
This adapter adds synchronized Kokoro speech, WAV, SRT, and QA metadata.
No upload, CRM writes, permissions attestations or public publishing.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

import numpy as np
import soundfile as sf

import original_reel_builder as video


def file_hash(path: Path) -> str:
    d = hashlib.sha256()
    with path.open("rb") as f:
        for buf in iter(lambda: f.read(1024 * 1024), b""):
            d.update(buf)
    return d.hexdigest()


def format_srt(seconds: float) -> str:
    milliseconds = int(round(seconds * 1000))
    hours, milliseconds = divmod(milliseconds, 3600000)
    minutes, milliseconds = divmod(milliseconds, 60000)
    secs, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{milliseconds:03d}"


def validate(spec: dict) -> None:
    if not isinstance(spec, dict) or len(spec.get("panels", [])) not in range(2, 7):
        raise ValueError("Requires 2–6 original narrative panels")
    if not isinstance(spec.get("slug"), str) or not video.SLUG.fullmatch(spec["slug"]):
        raise ValueError("Invalid slug")
    if not isinstance(spec.get("brand"), str) or not 2 <= len(spec["brand"]) <= 60:
        raise ValueError("Invalid brand")
    for p in spec["panels"]:
        if not all(isinstance(p.get(k), str) and p[k].strip() for k in ("headline", "body", "narration")):
            raise ValueError("Every panel needs original headline, body and narration")
        if len(p["narration"]) > 400:
            raise ValueError("Panel narration too long")
    if spec.get("rights", "").startswith("UNVERIFIED"):
        raise ValueError("Rights unverified")


def probe(path: Path) -> dict:
    raw = subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)],
        capture_output=True, text=True, check=True, timeout=30,
    )
    return json.loads(raw.stdout)


def render(spec: dict, model: Path, voices: Path, output_dir: Path, voice: str, speed: float) -> dict:
    validate(spec)
    if not (model.is_file() and voices.is_file()):
        raise FileNotFoundError("Download the official Kokoro model and voice bank first")
    if not (0.8 <= speed <= 1.35):
        raise ValueError("Narration speed outside acceptable band")
    if output_dir.exists() and any(output_dir.iterdir()):
        raise FileExistsError("Output directory is not empty: refusing overwrite")
    output_dir.mkdir(parents=True, exist_ok=True)
    from kokoro_onnx import Kokoro

    talker = Kokoro(str(model), str(voices))
    chunks = []
    frames = []
    cues = []
    time_cursor = 0.0
    sample_rate = None

    for i, panel in enumerate(spec["panels"]):
        wave, sr = talker.create(panel["narration"], voice=voice, speed=speed, lang="en-us" if voice[:1] == "a" else "en-gb")
        wave = np.asarray(wave, dtype=np.float32).reshape(-1)
        if sample_rate is None:
            sample_rate = int(sr)
        if int(sr) != sample_rate or wave.size < sr / 4 or np.max(np.abs(wave)) < 0.002:
            raise RuntimeError(f"Silence, very short segment, or mismatched sample rate at panel {i+1}")
        # A short fade prevents click artefacts on segment boundaries.
        fade = min(200, len(wave) // 8)
        wave[:fade] *= np.linspace(0.0, 1.0, fade)
        wave[-fade:] *= np.linspace(1.0, 0.0, fade)
        pause = max(0.26, 2.0 - len(wave) / sr)
        length = len(wave) / sr + pause
        if not 2 <= length <= 12:
            raise ValueError(f"Panel {i+1} narration is too long; split the script: {length:.2f}s")
        chunks.append(np.concatenate([wave, np.zeros(int(sr * pause), dtype=np.float32)]))
        frames.append({"headline": panel["headline"], "body": panel["body"], "seconds": round(length, 3)})
        cues.append((time_cursor, time_cursor + len(wave) / sr, panel["narration"]))
        time_cursor += length

    total_duration = sum(p["seconds"] for p in frames)
    if not (12 <= total_duration <= 60):
        raise ValueError("Video must be between 12 and 60 seconds")
    stem = "roman_training_narrated_preview"
    wav_target = output_dir / (stem + ".wav")
    srt_target = output_dir / (stem + ".srt")
    mp4_target = output_dir / (stem + ".mp4")
    metadata = output_dir / (stem + ".json")
    sf.write(wav_target, np.concatenate(chunks), sample_rate, subtype="PCM_16")
    srt_target.write_text("\n".join(
        f"{i+1}\n{format_srt(start)} --> {format_srt(end)}\n{text}\n"
        for i, (start, end, text) in enumerate(cues)
    ), encoding="utf-8")

    with tempfile.TemporaryDirectory(prefix="kokoro-preview-") as td:
        visual = Path(td) / "visual.mp4"
        video.render({"slug": spec["slug"], "brand": spec["brand"], "slides": frames}, visual)
        pending = Path(td) / "muxed.mp4"
        proc = subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
            "-i", str(visual), "-i", str(wav_target),
            "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
            "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-movflags", "+faststart", "-shortest", str(pending)
        ], capture_output=True, text=True, timeout=200)
        if proc.returncode:
            raise RuntimeError("Audio/video mux failed: " + proc.stderr[-1800:])
        qa = probe(pending)
        video_stream = next((s for s in qa["streams"] if s["codec_type"] == "video"), None)
        audio_stream = next((s for s in qa["streams"] if s["codec_type"] == "audio"), None)
        actual = float(qa["format"]["duration"])
        if not video_stream or video_stream["codec_name"] != "h264" or (
            video_stream["width"], video_stream["height"]
        ) != (1080, 1920):
            raise RuntimeError("Invalid video stream or dimensions")
        if not audio_stream or audio_stream["codec_name"] != "aac" or abs(actual - total_duration) > 0.55:
            raise RuntimeError(f"Missing or wrong audio stream; duration {actual:.2f}/{total_duration:.2f}")
        shutil.copyfile(pending, mp4_target)

    report = {
        "status": "DRAFT_NEEDS_EDITORIAL_REVIEW",
        "published": False,
        "voice_engine": "kokoro-onnx / Kokoro-82M",
        "voice": voice,
        "speed": speed,
        "original_script": True,
        "video_codec": "h264",
        "audio_codec": "aac",
        "duration_sec": actual,
        "resolution": "1080x1920",
        "media_sha256": file_hash(mp4_target),
        "audio_sha256": file_hash(wav_target),
        "script_sha256": hashlib.sha256(json.dumps(spec, sort_keys=True, ensure_ascii=False).encode()).hexdigest(),
        "rights_note": spec["rights"],
        "source": spec.get("reference"),
        "source_url": spec.get("reference_url"),
        "narration": " ".join(p["narration"] for p in spec["panels"]),
        "destination": spec.get("destination"),
        "created_utc": datetime.now(timezone.utc).isoformat(),
    }
    metadata.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return report


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--script", type=Path, required=True)
    p.add_argument("--model", type=Path, required=True)
    p.add_argument("--voices", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--voice", default="bm_george")
    p.add_argument("--speed", type=float, default=1.10)
    p.add_argument("--check", action="store_true")
    a = p.parse_args()
    spec = json.loads(a.script.read_text(encoding="utf-8"))
    validate(spec)
    if a.check:
        print(json.dumps({"status": "SCRIPT_VALID", "panels": len(spec["panels"])}))
    else:
        print(json.dumps(render(spec, a.model, a.voices, a.output, a.voice, a.speed)))


if __name__ == "__main__":
    main()
