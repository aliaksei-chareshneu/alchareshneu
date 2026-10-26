#!/usr/bin/env python3
"""Local, privacy-first video edit planner and renderer (ffmpeg + optional Remotion)."""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

FILLERS = {"um", "uh", "erm", "like", "ну", "ээ", "эээ", "эм", "типа", "как бы", "prostě", "ehm"}
MEDIA = {".mp4", ".mov", ".mkv", ".webm"}


def run(args, check=True):
    return subprocess.run(args, text=True, encoding="utf-8", errors="replace", capture_output=True, check=check)


def probe(path):
    d = json.loads(run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate", "-of", "json", str(path)]).stdout)
    v = next((s for s in d["streams"] if s["codec_type"] == "video"), None)
    if not v:
        raise ValueError("Source has no video stream")
    return {"duration": float(d["format"]["duration"]), "width": int(v["width"]), "height": int(v["height"]),
            "audio": any(s["codec_type"] == "audio" for s in d["streams"])}


def sha(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def norm(s):
    return re.sub(r"[^\w ]", "", s.lower(), flags=re.UNICODE).strip()


def stamp(s):
    h, m, rest = s.replace(".", ",").split(":")
    sec, ms = rest.split(",")
    return int(h) * 3600 + int(m) * 60 + int(sec) + int(ms) / 1000


def parse_transcript(path):
    if not path:
        return []
    path = Path(path)
    if path.suffix.lower() == ".srt":
        parts = re.split(r"\n\s*\n", path.read_text(encoding="utf-8-sig").strip())
        out = []
        for part in parts:
            lines = part.splitlines()
            line = next((i for i, v in enumerate(lines) if " --> " in v), None)
            if line is None:
                continue
            a, b = lines[line].split(" --> ", 1)
            text = " ".join(lines[line + 1:]).strip()
            if text:
                out.append({"start": stamp(a.strip()), "end": stamp(b.strip().split()[0]), "text": text})
        return out
    d = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(d, list):
        records = d
    else:
        segments = d.get("segments", [])
        records = [w for s in segments for w in s.get("words", [])] if any("words" in s for s in segments) else segments
    out = []
    for item in records:
        text = item.get("word", item.get("text", "")).strip()
        if text:
            out.append({"start": float(item["start"]), "end": float(item["end"]), "text": text})
    return sorted(out, key=lambda x: x["start"])


def detect_silences(path, threshold="-34dB", min_sec=0.75, duration=None):
    command = ["ffmpeg", "-hide_banner", "-nostdin", "-i", str(path), "-af", f"silencedetect=noise={threshold}:d={min_sec}", "-f", "null", "-"]
    result = run(command, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg silence detection failed: {result.stderr[-1000:]}")
    starts, output = [], []
    for line in result.stderr.splitlines():
        found = re.search(r"silence_start:\s*([\d.]+)", line)
        if found:
            starts.append(float(found.group(1)))
        found = re.search(r"silence_end:\s*([\d.]+)", line)
        if found and starts:
            s = starts.pop(0)
            output.append((s, float(found.group(1))))
    if starts and duration is not None:
        output.append((starts[-1], duration))
    return output


def merge_intervals(intervals, duration):
    joined = []
    for a, b in sorted((max(0.0, a), min(duration, b)) for a, b in intervals):
        if b - a < .05:
            continue
        if joined and a <= joined[-1][1] + .02:
            joined[-1] = (joined[-1][0], max(joined[-1][1], b))
        else:
            joined.append((a, b))
    return joined


def keep_from_removals(removals, duration):
    cur, keep = 0., []
    for a, b in merge_intervals(removals, duration):
        if a - cur >= .06:
            keep.append((cur, a))
        cur = max(cur, b)
    if duration - cur >= .06:
        keep.append((cur, duration))
    return keep


def cut_candidates(cues):
    out = []
    prev = None
    for cue in cues:
        word = norm(cue["text"])
        is_atomic = len(word.split()) <= 2
        if is_atomic and word in FILLERS:
            out.append({"kind": "filler", **cue})
        if prev and word and word == norm(prev["text"]) and cue["start"] - prev["end"] < 1.0 and len(word.split()) <= 5:
            out.append({"kind": "duplicate", **cue})
        prev = cue
    return out


def captions_after_edit(cues, keeps):
    dest, out = 0., []
    for a, b in keeps:
        for cue in cues:
            start, end = max(a, cue["start"]), min(b, cue["end"])
            if end - start >= .06:
                out.append({"start": round(dest + start - a, 3), "end": round(dest + end - a, 3), "text": cue["text"]})
        dest += b - a
    return sorted(out, key=lambda c: (c["start"], c["end"]))


def srt_time(sec):
    millis = int(round(sec * 1000))
    h, millis = divmod(millis, 3600000)
    m, millis = divmod(millis, 60000)
    s, ms = divmod(millis, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def write_srt(cues, path):
    content = "\n\n".join(f'{n}\n{srt_time(c["start"])} --> {srt_time(c["end"])}\n{c["text"]}' for n, c in enumerate(cues, 1))
    Path(path).write_text(content + ("\n" if content else ""), encoding="utf-8")


def validate_broll(path, edited_duration):
    if not path:
        return []
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("B-roll manifest must be a JSON array")
    out = []
    for item in data:
        f = (Path(path).parent / item["file"]).resolve()
        if not f.is_file() or f.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
            raise ValueError(f"B-roll local image absent or unsupported: {f}")
        if item.get("rights") not in {"owned", "licensed", "permission"} or not item.get("evidence"):
            raise ValueError(f"B-roll requires documented rights and evidence: {f}")
        start = float(item["start"])
        end = float(item["end"])
        if not (0 <= start < end <= edited_duration + .01):
            raise ValueError(f"B-roll timing outside edited video: {f}")
        out.append({"path": str(f), "start": start, "end": end, "rights": item["rights"], "evidence": item["evidence"]})
    return out


def plan(source, out, transcript=None, threshold="-34dB", silence_min=.75, padding=.16, apply_fillers=False, apply_duplicates=False, broll=None):
    source = Path(source).resolve()
    out = Path(out).resolve()
    if not source.is_file() or source.suffix.lower() not in MEDIA:
        raise ValueError("Local video file required")
    out.mkdir(parents=True, exist_ok=True)
    metadata = probe(source)
    cues = parse_transcript(transcript)
    silences = detect_silences(source, threshold, silence_min, metadata["duration"]) if metadata["audio"] else []
    proposed = cut_candidates(cues)
    removals = [(s + padding, e - padding) for s, e in silences if e - s > 2 * padding + .05]
    selected = [c for c in proposed if (c["kind"] == "filler" and apply_fillers) or (c["kind"] == "duplicate" and apply_duplicates)]
    removals.extend((c["start"] - .01, c["end"] + .01) for c in selected)
    keeps = keep_from_removals(removals, metadata["duration"])
    if not keeps:
        raise ValueError("Edit would remove entire source")
    edited_length = round(sum(b - a for a, b in keeps), 3)
    overlays = validate_broll(broll, edited_length)
    captions = captions_after_edit(cues, keeps)
    doc = {
        "schema": 1, "source": str(source), "source_sha256": sha(source), "source_info": metadata,
        "transcript": str(Path(transcript).resolve()) if transcript else None,
        "threshold": threshold, "silence_min": silence_min, "padding": padding,
        "keeps": [{"start": round(a, 3), "end": round(b, 3)} for a, b in keeps],
        "candidates": proposed, "selected_disfluencies": selected,
        "captions": captions, "broll": overlays,
        "edited_duration": edited_length,
        "review_required": True,
        "review_notes": ["Verify cuts, speaker meaning, captions, privacy and consent before publication"] + (["No transcript: captions not generated"] if not cues else []),
    }
    (out / "plan.json").write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_srt(captions, out / "captions.srt")
    print(json.dumps({"status": "PLAN_REVIEW_REQUIRED", "plan": str(out / "plan.json"), "source_sec": metadata["duration"],
                      "edited_sec": edited_length, "cuts": len(keeps) - 1, "caption_cues": len(captions), "candidates": len(proposed)}, ensure_ascii=False))
    return doc


def render(plan_path, output=None, burn=True, verify_hash=True):
    p = Path(plan_path).resolve()
    doc = json.loads(p.read_text(encoding="utf-8"))
    source = Path(doc["source"])
    if verify_hash and sha(source) != doc["source_sha256"]:
        raise ValueError("Source changed since planning; rerun plan")
    output = Path(output).resolve() if output else p.parent / "edited.mp4"
    output.parent.mkdir(parents=True, exist_ok=True)
    cuts = doc["keeps"]
    info = probe(source)
    with tempfile.TemporaryDirectory(prefix="videoedit-") as td:
        td = Path(td)
        rough = td / "rough.mp4"
        graph, concat = [], ""
        for i, cut in enumerate(cuts):
            a, b = cut["start"], cut["end"]
            graph.append(f"[0:v]trim=start={a}:end={b},setpts=PTS-STARTPTS[v{i}]")
            if info["audio"]:
                graph.append(f"[0:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS[a{i}]")
            concat += f"[v{i}]" + (f"[a{i}]" if info["audio"] else "")
        graph.append(concat + f"concat=n={len(cuts)}:v=1:a={1 if info['audio'] else 0}[v]" + ("[a]" if info["audio"] else ""))
        args = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-nostdin", "-i", str(source),
                "-filter_complex", ";".join(graph), "-map", "[v]"]
        if info["audio"]:
            args += ["-map", "[a]"]
        args += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p"]
        if info["audio"]:
            args += ["-c:a", "aac", "-b:a", "160k"]
        args += ["-movflags", "+faststart", str(rough)]
        run(args)
        current = rough
        if doc["broll"]:
            overlayed = td / "broll.mp4"
            inputs = []
            nodes = []
            previous = "0:v"
            for i, item in enumerate(doc["broll"], 1):
                inputs += ["-loop", "1", "-i", item["path"]]
                nodes.append(f"[{i}:v]scale={info['width']}:{info['height']}:force_original_aspect_ratio=decrease,pad={info['width']}:{info['height']}:(ow-iw)/2:(oh-ih)/2[img{i}]")
                nodes.append(f"[{previous}][img{i}]overlay=0:0:enable='between(t,{item['start']},{item['end']})':eof_action=repeat[ov{i}]")
                previous = f"ov{i}"
            args = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-nostdin", "-i", str(current), *inputs,
                    "-filter_complex", ";".join(nodes), "-map", f"[{previous}]"]
            if info["audio"]:
                args += ["-map", "0:a", "-c:a", "copy"]
            args += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-shortest", str(overlayed)]
            run(args)
            current = overlayed
        if burn and doc["captions"]:
            subtitled = td / "subtitled.mp4"
            subtitle_path = (p.parent / "captions.srt").resolve()
            # The subtitles filter uses a separate input argument, safely quoted for ffmpeg filter syntax.
            escaped = str(subtitle_path).replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'").replace(",", "\\,")
            args = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-nostdin", "-i", str(current),
                    "-vf", f"subtitles='{escaped}':force_style='FontSize=19,Outline=2,Shadow=1,Alignment=2,MarginV=75'",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p"]
            if info["audio"]:
                args += ["-c:a", "copy"]
            args += [str(subtitled)]
            run(args)
            current = subtitled
        shutil.copy2(current, output)
    result = probe(output)
    delta = abs(result["duration"] - doc["edited_duration"])
    if delta > max(.3, .10 * doc["edited_duration"]):
        raise RuntimeError(f"Render duration inconsistent (expected {doc['edited_duration']}, got {result['duration']})")
    print(json.dumps({"status": "RENDERED_REVIEW_REQUIRED", "output": str(output), "duration": result["duration"], "bytes": output.stat().st_size}, ensure_ascii=False))
    return result


def prepare_remotion(plan_path, project_root):
    doc = json.loads(Path(plan_path).read_text(encoding="utf-8"))
    root = Path(project_root).resolve()
    public = root / "public"
    public.mkdir(exist_ok=True, parents=True)
    shutil.copy2(doc["source"], public / "source.mp4")
    fps = 30
    clips = []
    frame = 0
    for cut in doc["keeps"]:
        n = max(1, round((cut["end"] - cut["start"]) * fps))
        clips.append({"at": frame, "start": round(cut["start"] * fps), "frames": n})
        frame += n
    captions = [{"start": round(c["start"] * fps), "end": round(c["end"] * fps), "text": c["text"]} for c in doc["captions"]]
    images = []
    for i, entry in enumerate(doc["broll"]):
        src = Path(entry["path"])
        name = f"broll_{i}{src.suffix.lower()}"
        shutil.copy2(src, public / name)
        images.append({"file": name, "start": round(entry["start"] * fps), "end": round(entry["end"] * fps)})
    payload = {"fps": fps, "width": doc["source_info"]["width"], "height": doc["source_info"]["height"],
               "frames": frame, "clips": clips, "captions": captions, "broll": images}
    (root / "src" / "edit.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "REMOTION_SOURCE_PREPARED_NOT_RENDERED", "edit_json": str(root / "src" / "edit.json"), "frames": frame}))


def local_transcribe(source, out, model="small", language="auto"):
    """Explicit opt-in local Whisper CLI; may download a model on first use."""
    if not shutil.which("whisper"):
        raise ValueError("Whisper CLI not installed; pass --transcript instead")
    out = Path(out)
    out.mkdir(exist_ok=True, parents=True)
    source = Path(source).resolve()
    args = ["whisper", str(source), "--model", model, "--word_timestamps", "True",
            "--output_format", "json", "--output_dir", str(out)]
    if language != "auto":
        args += ["--language", language]
    run(args)
    result = out / f"{source.stem}.json"
    if not result.exists():
        raise ValueError("Whisper CLI finished without expected JSON")
    return str(result)


def batch(input_dir, out_root, do_render=False):
    """Process a large local queue with SHA-based idempotence; no publishing."""
    directory = Path(input_dir).resolve()
    files = sorted(f for f in directory.iterdir() if f.is_file() and f.suffix.lower() in MEDIA)
    if not files:
        raise ValueError("No supported local video files found")
    done, skipped, failed = 0, 0, []
    for f in files:
        try:
            sig = sha(f)
            output = Path(out_root).resolve() / (re.sub(r"[^\w-]", "_", f.stem)[:55] + "-" + sig[:12])
            manifest = output / "plan.json"
            if manifest.exists():
                prev = json.loads(manifest.read_text(encoding="utf-8"))
                if prev.get("source_sha256") != sig:
                    raise ValueError("Existing plan SHA mismatch")
                skipped += 1
            else:
                transcript = next((t for t in [f.with_suffix(".json"), f.with_suffix(".srt")] if t.exists()), None)
                plan(f, output, transcript=transcript)
                done += 1
            if do_render and not (output / "edited.mp4").exists():
                render(manifest)
        except Exception as e:
            failed.append({"input": f.name, "error": str(e)})
    summary = {"status": "BATCH_COMPLETE_WITH_REVIEW_GATES", "planned": done, "skipped": skipped,
               "failed": failed, "total": len(files)}
    print(json.dumps(summary, ensure_ascii=False))
    if failed:
        raise RuntimeError(f"{len(failed)} of {len(files)} jobs failed")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subs = parser.add_subparsers(dest="action", required=True)
    pl = subs.add_parser("plan", help="Generate a reviewable edit decision list (EDL)")
    pl.add_argument("source")
    pl.add_argument("--out", required=True)
    pl.add_argument("--transcript", help="Whisper JSON or SRT with timestamps")
    pl.add_argument("--local-whisper", action="store_true", help="Opt-in local Whisper CLI transcription")
    pl.add_argument("--model", default="small")
    pl.add_argument("--language", default="auto")
    pl.add_argument("--broll", help="Local images manifest with documented usage rights")
    pl.add_argument("--threshold", default="-34dB")
    pl.add_argument("--silence-min", type=float, default=.75)
    pl.add_argument("--padding", type=float, default=.16)
    pl.add_argument("--apply-fillers", action="store_true", help="EXPLICIT: cut short filler cues")
    pl.add_argument("--apply-duplicates", action="store_true", help="EXPLICIT: cut consecutive repeat cues")
    rd = subs.add_parser("render", help="Render using FFmpeg")
    rd.add_argument("plan")
    rd.add_argument("--output")
    rd.add_argument("--no-burn", action="store_true")
    re = subs.add_parser("prepare-remotion", help="Generate Remotion editable assets (not final output)")
    re.add_argument("plan")
    re.add_argument("--project-root", default=str(Path(__file__).resolve().parent))
    bt = subs.add_parser("batch", help="Plan (and optionally render) many local clips with SHA dedup")
    bt.add_argument("input_dir")
    bt.add_argument("--out-root", required=True)
    bt.add_argument("--render", action="store_true")
    a = parser.parse_args()
    try:
        if a.action == "plan":
            if not 0 <= a.padding < 5 or not .1 <= a.silence_min < 30:
                raise ValueError("Invalid silence parameters")
            if a.local_whisper and a.transcript:
                raise ValueError("Use --local-whisper OR --transcript")
            transcript = local_transcribe(a.source, Path(a.out) / "transcripts", a.model, a.language) if a.local_whisper else a.transcript
            plan(a.source, a.out, transcript, a.threshold, a.silence_min, a.padding, a.apply_fillers, a.apply_duplicates, a.broll)
        elif a.action == "render":
            render(a.plan, a.output, not a.no_burn)
        elif a.action == "batch":
            batch(a.input_dir, a.out_root, a.render)
        else:
            prepare_remotion(a.plan, a.project_root)
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
