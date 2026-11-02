"""Suggest candidate cuts from selected LOCAL media, never auto-certify rights.

Complements (does NOT replace) existing MediaMachine ingest, ShortFactory renderer
and the owner-controlled SocialPublishing queue. Proposals are not AI/editorial approval.
No network or uploads; no third-party footage downloads.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

HOME = Path.home()
ROOT = HOME / "MoravianHost" / "MediaMachine" / "ShortFactory"
INCOMING = HOME / "Documents" / "ImperionMedia" / "IncomingApproved"
OUT = ROOT / "edit_suggestions"
ALLOWED = {".mp4", ".mov", ".mkv", ".m4v", ".webm"}
MAX_BYTES = 4 * 1024**3
MAX_SCAN_SECONDS = 600.0
MIN_STABLE_SECONDS = 120.0


def tool(name: str) -> str:
    found = shutil.which(name)
    if found:
        return found
    packages = HOME / "AppData" / "Local" / "Microsoft" / "WinGet" / "Packages"
    paths = sorted(packages.glob("Gyan.FFmpeg_*/*/bin/" + name + ".exe"))
    if paths:
        return str(paths[-1])
    raise RuntimeError(name + " not available")


def check_local(source: Path, incoming: Path) -> Path:
    source = source.resolve(strict=True)
    incoming = incoming.resolve(strict=True)
    if source.is_symlink() or not source.is_file() or source.suffix.lower() not in ALLOWED:
        raise ValueError("Not an approved-local-folder video type")
    if not source.is_relative_to(incoming):
        raise PermissionError("Source is not inside IncomingApproved")
    size = source.stat().st_size
    if not 10_000 <= size <= MAX_BYTES:
        raise ValueError("Video size out of local safety bounds")
    return source


def digest(source: Path) -> str:
    h = hashlib.sha256()
    with source.open("rb") as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def probe(source: Path) -> dict:
    raw = subprocess.run(
        [tool("ffprobe"), "-v", "error", "-show_entries",
         "format=duration:stream=index,codec_type", "-of", "json", str(source)],
        check=True, capture_output=True, text=True, timeout=30)
    data = json.loads(raw.stdout)
    dur = float(data["format"]["duration"])
    if not 3 <= dur <= 21600:
        raise ValueError("Video must be 3 seconds to six hours; short B-roll is kept private")
    if not any(s.get("codec_type") == "video" for s in data.get("streams", [])):
        raise ValueError("Missing video stream")
    return {"duration": dur, "has_audio": any(
        s.get("codec_type") == "audio" for s in data.get("streams", []))}


def analyze(source: Path, duration: float, has_audio: bool) -> dict:
    limit = min(MAX_SCAN_SECONDS, duration)
    scenes, silences = [], []
    ffmpeg = tool("ffmpeg")
    cmd = [ffmpeg, "-hide_banner", "-loglevel", "info", "-nostdin",
           "-t", str(limit), "-i", str(source), "-vf",
           "fps=1,scale=320:-2,select='gt(scene,0.15)',showinfo",
           "-an", "-f", "null", "NUL"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        if r.returncode == 0:
            scenes = [float(x) for x in re.findall(r"pts_time:([0-9]+(?:\.[0-9]+)?)", r.stderr)]
    except (subprocess.TimeoutExpired, ValueError):
        pass
    if has_audio:
        cmd = [ffmpeg, "-hide_banner", "-loglevel", "info", "-nostdin",
               "-t", str(limit), "-i", str(source), "-vn",
               "-af", "silencedetect=noise=-35dB:d=0.45", "-f", "null", "NUL"]
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
            begins = [float(x) for x in re.findall(r"silence_start: ([0-9]+(?:\.[0-9]+)?)", r.stderr)]
            ends = [float(x) for x in re.findall(r"silence_end: ([0-9]+(?:\.[0-9]+)?)", r.stderr)]
            silences = list(zip(begins, ends))
        except (subprocess.TimeoutExpired, ValueError):
            pass
    return {"analyzed_seconds": limit, "scene_candidates": sorted(set(scenes)),
            "silence_intervals": silences}


def choose(duration: float, analysis: dict, maxclips: int = 3) -> list[tuple[float, float]]:
    maxclips = max(1, min(3, int(maxclips)))
    window = 18.0 if duration >= 20 else duration
    scan = min(duration, analysis["analyzed_seconds"])
    changes = analysis["scene_candidates"]
    silences = analysis["silence_intervals"]
    starts = [0.0]
    for t in changes:
        starts.append(max(0.0, min(scan - window, t - 1.0)))
    for n in range(1, 10):
        starts.append(max(0.0, (scan - window) * n / 10))
    starts = sorted({round(max(0, min(duration - window, x)), 2) for x in starts})
    def score(start):
        end = start + window
        action = sum(1 for t in changes if start <= t < end)
        quiet = sum(max(0.0, min(end, b) - max(start, a)) for a, b in silences)
        speaking = max(0.0, 1.0 - min(1.0, quiet / window))
        return action * 1.5 + speaking * (1.0 if silences else 0.0) - start / max(scan, 1) * 0.08
    ranked = sorted(starts, key=lambda s: (-score(s), s))
    selected = []
    for start in ranked:
        if all(abs(start - used) >= window * 0.77 for used in selected):
            selected.append(start)
        if len(selected) >= maxclips:
            break
    return [(s, round(min(window, duration - s), 2)) for s in sorted(selected)]


def proposal(source: Path, incoming: Path, maxclips: int = 3, known_sha: str | None = None) -> dict:
    source = check_local(source, incoming)
    meta = probe(source)
    analyzed = analyze(source, meta["duration"], meta["has_audio"])
    sha = known_sha or digest(source)
    windows = choose(meta["duration"], analyzed, maxclips)
    clips = []
    for i, (start, length) in enumerate(windows, 1):
        clips.append({
            "start": start, "duration": length,
            "title": f"Candidate clip {i} - editorial review required",
            "caption": "Review the actual context and footage before writing the caption.",
            "cta": "CTA withheld until facts, rights and legal entity are verified.",
            "subtitles": []
        })
    # This shape is preview-compatible with the EXISTING owned_video_shorts.py.
    # Rendering is intentionally blocked until a person checks rights and edits copy.
    spec = {
        "slug": "suggest-" + sha[:16],
        "rights_status": "unknown",
        "rights_basis": "UNVERIFIED. Source selected for local editing only; redistribution not cleared.",
        "people_consents_checked": False,
        "music_rights_checked": False,
        "contains_minors": True,
        "guardian_consents_checked": False,
        "clips": clips
    }
    return {
        "status": "CUT_SUGGESTIONS_ONLY_RIGHTS_UNVERIFIED",
        "source_file_local": str(source),
        "source_sha256": sha,
        "source_duration_sec": round(meta["duration"], 2),
        "analyzed_first_seconds": round(analyzed["analyzed_seconds"], 2),
        "scene_events_count": len(analyzed["scene_candidates"]),
        "method": "FFmpeg sampled scene changes and local silence heuristic; not semantic AI",
        "owner_review_required": True,
        "published": False,
        "spec_for_owned_video_shorts_preview": spec,
        "generated_utc": datetime.now(timezone.utc).isoformat()
    }


def run(incoming: Path = INCOMING, out: Path = OUT, max_sources: int = 3) -> dict:
    incoming.mkdir(parents=True, exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)
    accepted = 0
    skipped = 0
    failed = []
    files = sorted((f for f in incoming.rglob("*") if f.is_file() and
                    f.suffix.lower() in ALLOWED), key=lambda f: f.stat().st_mtime)
    for source in files:
        if accepted >= max_sources:
            break
        try:
            verified_path = check_local(source, incoming)
            if time.time() - verified_path.stat().st_mtime < MIN_STABLE_SECONDS:
                skipped += 1  # Wait for an uploading or syncing file to settle.
                continue
            sha = digest(verified_path)
            target = out / (sha[:16] + ".json")
            cuts_target = out / (sha[:16] + ".cuts.json")
            if target.exists():
                # Repair an interrupted sidecar write without overwriting a reviewed spec.
                if not cuts_target.exists():
                    stored = json.loads(target.read_text(encoding="utf-8"))
                    safe_spec = stored["spec_for_owned_video_shorts_preview"]
                    if safe_spec.get("rights_status") != "unknown":
                        raise PermissionError("Stored suggestion rights flag is not safely unverified")
                    with cuts_target.open("x", encoding="utf-8") as stream:
                        json.dump(safe_spec, stream, indent=2, ensure_ascii=False)
                        stream.write("\n")
                skipped += 1
                continue
            data = proposal(verified_path, incoming, known_sha=sha)
            with target.open("x", encoding="utf-8") as stream:
                json.dump(data, stream, indent=2, ensure_ascii=False)
                stream.write("\n")
            with cuts_target.open("x", encoding="utf-8") as stream:
                json.dump(data["spec_for_owned_video_shorts_preview"], stream, indent=2, ensure_ascii=False)
                stream.write("\n")
            accepted += 1
        except (OSError, ValueError, RuntimeError, PermissionError, subprocess.CalledProcessError) as exc:
            failed.append({"file": source.name, "kind": type(exc).__name__})
    return {"stage": "LOCAL_PRIVATE_EDIT_SUGGESTIONS", "new": accepted,
            "duplicates": skipped, "failed": failed, "posted": 0, "paid_calls": 0}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--incoming", type=Path, default=INCOMING)
    parser.add_argument("--out", type=Path, default=OUT)
    parser.add_argument("--max-sources", type=int, default=3, choices=range(1, 11))
    args = parser.parse_args()
    print(json.dumps(run(args.incoming, args.out, args.max_sources), ensure_ascii=False))


if __name__ == "__main__":
    main()
