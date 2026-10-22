"""Draft-only timecode cutter for rights-cleared LOCAL footage in ShortFactory.

The generated files are NOT reviewed, scheduled or published. All cut suggestions,
including ones from Claude/Everygen, are untrusted until validated here and by an editor.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

SLUG = re.compile(r"^[a-z0-9][a-z0-9_-]{2,48}$")
RIGHTS = {"owned", "licensed", "public_domain"}
VIDEO_EXT = {".mp4", ".mov", ".mkv", ".webm"}
W, H = 1080, 1920


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for part in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(part)
    return digest.hexdigest()


def tool(name, override=None):
    candidate = override or shutil.which(name)
    if not candidate or not Path(candidate).is_file():
        raise RuntimeError(f"{name} unavailable; supply --{name} explicitly")
    return str(candidate)


def duration_seconds(source, ffprobe):
    process = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries", "format=duration",
         "-of", "json", str(source)], capture_output=True, text=True,
        timeout=30, check=True,
    )
    seconds = float(json.loads(process.stdout)["format"]["duration"])
    if not math.isfinite(seconds) or seconds <= 0:
        raise ValueError("Video duration is invalid")
    return seconds


def number(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{label} must be a number")
    if not math.isfinite(value):
        raise ValueError(f"{label} must be finite")
    return float(value)


def validate(spec, source_duration):
    if not isinstance(spec, dict) or not isinstance(spec.get("slug"), str) or not SLUG.fullmatch(spec["slug"]):
        raise ValueError("A safe lowercase batch slug is required")
    if spec.get("rights_status") not in RIGHTS:
        raise ValueError("Only owned, licensed or public_domain local sources allowed")
    if not isinstance(spec.get("rights_basis"), str) or len(spec["rights_basis"].strip()) < 8:
        raise ValueError("Record a specific rights basis, not just a status")
    for field in ("people_consents_checked", "music_rights_checked", "contains_minors"):
        if type(spec.get(field)) is not bool:
            raise ValueError(f"Explicit boolean required: {field}")
    if not spec["people_consents_checked"] or not spec["music_rights_checked"]:
        raise ValueError("People / music clearance needs manual confirmation")
    if spec["contains_minors"] and spec.get("guardian_consents_checked") is not True:
        raise ValueError("Guardian consent must be checked for minors")
    clips = spec.get("clips")
    if not isinstance(clips, list) or not 1 <= len(clips) <= 5:
        raise ValueError("One to five clips per batch")
    bounds = set()
    for i, item in enumerate(clips, 1):
        if not isinstance(item, dict):
            raise ValueError("Each clip must be an object")
        start = number(item.get("start"), f"clip {i} start")
        length = number(item.get("duration"), f"clip {i} duration")
        if start < 0 or length < 2 or length > 59 or start + length > source_duration + 0.05:
            raise ValueError(f"Clip {i} outside source or allowed 2-59s length")
        if (start, length) in bounds:
            raise ValueError("Duplicate timecode window")
        bounds.add((start, length))
        for field, low, high in (("title", 3, 120), ("caption", 3, 600), ("cta", 3, 160)):
            value = item.get(field)
            if not isinstance(value, str) or not low <= len(value.strip()) <= high:
                raise ValueError(f"Clip {i}: {field} length invalid")
        subtitles = item.get("subtitles", [])
        if not isinstance(subtitles, list) or len(subtitles) > 30:
            raise ValueError("Subtitles must be a list with at most 30 entries")
        prev_end = 0.0
        for sub in subtitles:
            if not isinstance(sub, dict):
                raise ValueError("Subtitle must be an object")
            begin = number(sub.get("start"), "subtitle start")
            end = number(sub.get("end"), "subtitle end")
            caption = sub.get("text")
            if begin < prev_end or end <= begin or end > length + 0.01:
                raise ValueError("Subtitles outside cut, overlapping or out of order")
            if not isinstance(caption, str) or not 1 <= len(caption.strip()) <= 160:
                raise ValueError("Invalid subtitle text")
            prev_end = end
    return clips


def srt_time(seconds):
    milliseconds = int(round(seconds * 1000))
    hours, milliseconds = divmod(milliseconds, 3600000)
    minutes, milliseconds = divmod(milliseconds, 60000)
    secs, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{milliseconds:03}"


def subtitle_file(subtitles):
    return "\n\n".join(
        f"{i}\n{srt_time(s['start'])} --> {srt_time(s['end'])}\n"
        + " ".join(s["text"].split())
        for i, s in enumerate(subtitles, 1)
    ) + ("\n" if subtitles else "")


def execute(spec, source, out_dir, *, render=False, ffmpeg=None, ffprobe=None):
    source = Path(source).expanduser().resolve(strict=True)
    if not source.is_file() or source.suffix.lower() not in VIDEO_EXT:
        raise ValueError("Only an existing local video file is accepted; URLs are forbidden")
    ffprobe = tool("ffprobe", ffprobe)
    length = duration_seconds(source, ffprobe)
    clips = validate(spec, length)
    destination = Path(out_dir).expanduser().resolve() / spec["slug"]
    planned = [destination / f"{i:02d}-{spec['slug']}.mp4" for i in range(1, len(clips) + 1)]
    if not render:
        return {"status": "PREVIEW_ONLY", "source_seconds": round(length, 3),
                "clips": [{"path": str(path), "start": item["start"], "duration": item["duration"]}
                          for path, item in zip(planned, clips)], "published": False}
    encoder = tool("ffmpeg", ffmpeg)
    if any(p.exists() or p.with_suffix(".json").exists() or p.with_suffix(".srt").exists()
           for p in planned) or (destination / "batch_manifest.json").exists():
        raise FileExistsError("Draft output exists. Choose a new slug; no overwrites")
    destination.mkdir(parents=True, exist_ok=True)
    source_hash = sha256(source)
    records = []
    # Preserve the entire source frame by default: cropping HEMA footage can hide safety-critical actions.
    filtergraph = ("scale=1080:1920:force_original_aspect_ratio=decrease,"
                   "pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p")
    for i, (item, target) in enumerate(zip(clips, planned), 1):
        with tempfile.NamedTemporaryFile(dir=destination, suffix=".mp4", delete=False) as temp:
            working = Path(temp.name)
        try:
            subprocess.run(
                [encoder, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                 "-ss", str(item["start"]), "-i", str(source), "-t", str(item["duration"]),
                 "-map", "0:v:0", "-map", "0:a:0?", "-vf", filtergraph,
                 "-c:v", "libx264", "-preset", "veryfast", "-crf", "24",
                 "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(working)],
                check=True, timeout=360,
            )
            if not working.is_file() or working.stat().st_size < 100:
                raise RuntimeError("Empty FFmpeg output")
            working.replace(target)
        finally:
            working.unlink(missing_ok=True)
        record = {"clip": i, "file": str(target), "file_sha256": sha256(target),
                  "title": item["title"], "caption": item["caption"], "cta": item["cta"],
                  "start": item["start"], "duration": item["duration"],
                  "source_sha256": source_hash, "rights_status": spec["rights_status"],
                  "rights_basis": spec["rights_basis"], "status": "DRAFT_NEEDS_EDITORIAL_REVIEW",
                  "approved": False, "published": False, "post_url": None}
        if item.get("subtitles"):
            subtitles_path = target.with_suffix(".srt")
            subtitles_path.write_text(subtitle_file(item["subtitles"]), encoding="utf-8")
            record["subtitles_file"] = str(subtitles_path)
        target.with_suffix(".json").write_text(
            json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        records.append(record)
    manifest = {"status": "DRAFT_NEEDS_EDITORIAL_REVIEW", "source": str(source),
                "source_sha256": source_hash, "published": False, "clips": records,
                "handoff": "Re-ingest reviewed local clips in existing MediaMachine; never import as approved SocialPublishing rows."}
    (destination / "batch_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", required=True, help="Local owned/cleared footage; NO YouTube URL")
    p.add_argument("--spec", required=True, help="JSON containing rights attestations and Claude-proposed cuts")
    p.add_argument("--output", default=str(Path.home() / "MoravianHost" / "MediaMachine" / "Drafts"))
    p.add_argument("--render", action="store_true", help="Actually create local draft MP4; preview is default")
    p.add_argument("--ffmpeg", help="Path to ffmpeg executable if absent from PATH")
    p.add_argument("--ffprobe", help="Path to ffprobe executable if absent from PATH")
    args = p.parse_args()
    spec = json.loads(Path(args.spec).read_text(encoding="utf-8"))
    print(json.dumps(execute(spec, args.source, args.output, render=args.render,
                             ffmpeg=args.ffmpeg, ffprobe=args.ffprobe), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
