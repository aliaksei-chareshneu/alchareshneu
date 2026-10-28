#!/usr/bin/env python3
"""IMPERION ShortFactory bridge: local footage -> ranked cuts -> review-only MP4.

No media downloads, LLM subscriptions, social APIs, publishing, or new CRM.
Heuristic ranking is NOT a claim of virality. Explicit rights clearance is required
before render, editorial approval is still required before publication.
"""
from __future__ import annotations
import argparse
from array import array
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys

VIDEO_SUFFIXES = {".mp4", ".mov", ".mkv", ".webm"}
RIGHTS = {"owned", "licensed", "public_domain"}
ENTITIES = {"DRUZINA_ZS", "OSVC"}
SLUG = re.compile(r"^[a-z0-9][a-z0-9_-]{2,48}$")
TIMESTAMP = re.compile(r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})")
SCENE_TIME = re.compile(r"pts_time:([\d.]+)")


def call(cmd, timeout=180, check=True):
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          timeout=timeout, check=check)


def sha256(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for piece in iter(lambda: f.read(1024 * 1024), b""):
            h.update(piece)
    return h.hexdigest()


def media_probe(path):
    d = json.loads(call(["ffprobe", "-v", "error", "-show_entries",
                         "format=duration:stream=codec_type,codec_name,width,height",
                         "-of", "json", str(path)]).stdout)
    video = next((v for v in d.get("streams", []) if v.get("codec_type") == "video"), None)
    if not video:
        raise ValueError("Source has no video")
    return {"duration": float(d["format"]["duration"]),
            "width": int(video["width"]), "height": int(video["height"]),
            "has_audio": any(v.get("codec_type") == "audio" for v in d["streams"])}


def stamp(text):
    match = TIMESTAMP.fullmatch(text.strip())
    if not match:
        raise ValueError("Invalid subtitle timestamp")
    h, m, s, ms = map(int, match.groups())
    return h * 3600 + m * 60 + s + ms / 1000


def parse_srt(path):
    if not path:
        return []
    contents = Path(path).read_text(encoding="utf-8-sig")
    cues = []
    for block in re.split(r"\n\s*\n", contents.strip()):
        lines = block.splitlines()
        for i, line in enumerate(lines):
            if " --> " in line:
                left, right = line.split(" --> ", 1)
                start, end = stamp(left), stamp(right.split()[0])
                caption = " ".join(lines[i + 1:]).strip()
                if start < end and caption:
                    cues.append({"start": start, "end": end, "text": caption})
                break
    return sorted(cues, key=lambda r: r["start"])


def scene_times(source, duration, max_scan=720):
    # Cost bounded; video itself is never uploaded or sent to a provider.
    cmd = ["ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "info",
           "-t", str(min(max_scan, duration)), "-i", str(source),
           "-vf", "scale=240:-2,select='gt(scene,0.20)',showinfo",
           "-an", "-f", "null", "-"]
    try:
        output = call(cmd, timeout=300, check=False).stderr.decode("utf-8", "replace")
        return sorted({round(float(s), 2) for s in SCENE_TIME.findall(output)})
    except (subprocess.TimeoutExpired, ValueError):
        return []


def audio_energy(source, duration, max_scan=720):
    if not media_probe(source)["has_audio"]:
        return []
    cmd = ["ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error",
           "-t", str(min(max_scan, duration)), "-i", str(source),
           "-vn", "-ac", "1", "-ar", "2000", "-f", "s16le", "-"]
    try:
        result = call(cmd, timeout=180)
        audio = array("h")
        audio.frombytes(result.stdout[:(len(result.stdout) // 2) * 2])
        return [math.sqrt(sum(int(v) * int(v) for v in audio[i:i + 2000]) /
                          max(1, len(audio[i:i + 2000])))
                for i in range(0, len(audio), 2000)]
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError):
        return []


def choose_windows(duration, scenes, energy, cues, count=5, window=18):
    if duration < 2:
        raise ValueError("Source must be at least two seconds")
    window = min(max(2.0, float(window)), 59.0, duration)
    step = max(2, int(window / 4))
    starts = sorted(set([0.0, max(0.0, duration - window)] +
                        [float(i) for i in range(0, max(1, int(duration - window) + 1), step)] +
                        [max(0.0, min(duration - window, s - 1.0)) for s in scenes]))
    emax = max(energy) if energy else 0
    scored = []
    for start in starts:
        end = start + window
        cuts = sum(start <= v < end for v in scenes)
        nearby = energy[int(start):int(min(end, len(energy)))]
        power = sum(nearby) / len(nearby) / emax if nearby and emax else 0
        speech = sum(max(0, min(end, x["end"]) - max(start, x["start"])) for x in cues)
        speech_ratio = min(1, speech / max(1, window))
        # Media activity proxy, not actual audience retention or success prediction.
        score = 0.50 * min(cuts / 4, 1) + 0.30 * power + 0.20 * speech_ratio
        scored.append({"start": round(start, 2), "duration": round(window, 2),
                       "heuristic_score": round(score, 3), "scene_changes": cuts,
                       "speech_ratio": round(speech_ratio, 2)})
    picked = []
    for candidate in sorted(scored, key=lambda x: (-x["heuristic_score"], x["start"])):
        a, b = candidate["start"], candidate["start"] + candidate["duration"]
        if any(max(0, min(b, p["start"] + p["duration"]) - max(a, p["start"])) >
               0.25 * window for p in picked):
            continue
        picked.append(candidate)
        if len(picked) >= count:
            break
    return sorted(picked, key=lambda x: (-x["heuristic_score"], x["start"]))


def short_caption(cues, start, duration):
    relevant = [x for x in cues if start <= x["start"] and x["end"] <= start + duration]
    return " ".join(x["text"] for x in relevant[:4]).strip()[:150]


def slugify(topic):
    name = re.sub(r"[^a-z0-9_-]+", "-", topic.lower()).strip("-")
    return (name[:40] if len(name) >= 3 else "original-footage")


def make_plan(source, output_dir, topic, entity, cta, transcript=None, count=5, window=18):
    source = Path(source).expanduser().resolve(strict=True)
    if source.suffix.lower() not in VIDEO_SUFFIXES or not source.is_file():
        raise ValueError("Only an existing LOCAL video is accepted; third-party URLs are references only")
    if entity not in ENTITIES:
        raise ValueError("Select exact owning entity: DRUZINA_ZS or OSVC")
    if not topic.strip() or not cta.strip():
        raise ValueError("Specific topic and one CTA are required")
    info = media_probe(source)
    if info["duration"] > 3600:
        raise ValueError("Split files longer than one hour before automatic scene analysis")
    cues = parse_srt(transcript)
    windows = choose_windows(info["duration"], scene_times(source, info["duration"]),
                             audio_energy(source, info["duration"]), cues, count, window)
    shots = []
    for i, w in enumerate(windows, 1):
        snippet = short_caption(cues, w["start"], w["duration"])
        hook = (snippet[:75].rstrip(" .,-") + "?") if snippet and not snippet.endswith(("?", "!")) else snippet
        if not hook:
            hook = "What happens in this " + topic.strip()[:45] + " moment?"
        subs = []
        for item in cues:
            start = max(item["start"], w["start"])
            end = min(item["end"], w["start"] + w["duration"])
            if end > start and len(subs) < 29:
                subs.append({"start": round(start - w["start"], 3),
                             "end": round(end - w["start"], 3), "text": item["text"][:150]})
        shots.append({"start": w["start"], "duration": w["duration"],
                      "title": (topic.strip()[:90] + " | Moment " + str(i))[:115],
                      "caption": "A moment from " + topic.strip()[:110] + ". " + cta.strip()[:130],
                      "cta": cta.strip()[:155], "hook": hook[:150],
                      "subtitles": subs, "heuristic_score": w["heuristic_score"],
                      "scene_changes": w["scene_changes"]})
    output_dir = Path(output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / "cut_proposals.json"
    if target.exists():
        raise FileExistsError("Plan exists; no overwrite. Use a new output directory")
    manifest = {"schema": "imperion.video_factory.v1", "created_at": datetime.now(timezone.utc).isoformat(),
                "slug": slugify(topic), "source": str(source), "source_sha256": sha256(source),
                "source_info": info, "topic": topic.strip(), "entity": entity,
                "source_rights_status": "UNKNOWN", "editorial_approved": False,
                "people_consents_checked": False, "music_rights_checked": False,
                "guardian_consents_checked": False, "video_published": False,
                "contains_minors": "UNKNOWN", "algorithm": "scene+sound+timed speech heuristic",
                "clips": shots}
    target.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    brief = ["# YouTube 11-skill editorial handoff (review needed)", "",
             "Source SHA-256: `" + manifest["source_sha256"] + "`",
             "Entity: " + entity, "Topic: " + topic,
             "Actual viewer-retention data: NOT PROVIDED. Activity scores are heuristics.",
             "Only rights-cleared ORIGINAL footage may reach render.", "",
             "Run yt-viral on reference metadata; yt-script on the selected hook;",
             "yt-shorts and yt-edit on actual transcript/timeline; yt-package and yt-seo",
             "on chosen video; yt-plan for capacity; yt-retention, yt-audit and yt-comment",
             "AFTER verified publication. yt-chapters only for suitable long videos.", "",
             "## Proposed moments (not reviewed)"]
    for i, s in enumerate(shots, 1):
        brief += [f"{i}. {s['start']:.2f}s - {s['start'] + s['duration']:.2f}s; activity={s['heuristic_score']:.3f}",
                  "   Hook candidate: " + s["hook"], "   Title: " + s["title"]]
    (output_dir / "editorial_handoff.md").write_text("\n".join(brief) + "\n", encoding="utf-8")
    return {"status": "CUT_PROPOSALS_NEED_REVIEW", "proposals": len(shots),
            "plan": str(target), "editorial": str(output_dir / "editorial_handoff.md")}


def ms(sec):
    value = int(round(sec * 1000))
    hour, value = divmod(value, 3600000)
    minute, value = divmod(value, 60000)
    second, milli = divmod(value, 1000)
    return f"{hour:02}:{minute:02}:{second:02},{milli:03}"


def save_captions(clip, dest):
    # Hook occupies start, spoken captions (if supplied) follow it.
    times = [{"start": 0, "end": min(2.0, clip["duration"]), "text": clip["hook"]}]
    times.extend(x for x in clip.get("subtitles", [])
                 if x["start"] >= 2.1 and x["end"] <= clip["duration"] and x["end"] > x["start"])
    content = "\n\n".join(f"{i}\n{ms(c['start'])} --> {ms(c['end'])}\n{c['text']}"
                           for i, c in enumerate(times, 1))
    dest.write_text(content + "\n", encoding="utf-8")


def render(plan_path, clearance_path, output_dir):
    plan = json.loads(Path(plan_path).read_text(encoding="utf-8"))
    approval = json.loads(Path(clearance_path).read_text(encoding="utf-8"))
    if plan.get("schema") != "imperion.video_factory.v1" or plan.get("entity") not in ENTITIES:
        raise ValueError("Plan schema/entity invalid")
    source = Path(plan["source"]).resolve(strict=True)
    if sha256(source) != plan["source_sha256"]:
        raise ValueError("Input footage changed after planning")
    if approval.get("source_sha256") != plan["source_sha256"]:
        raise ValueError("Clearance must bind to exact SHA-256 of source footage")
    if approval.get("rights_status") not in RIGHTS or len(str(approval.get("rights_basis", "")).strip()) < 12:
        raise ValueError("Real independently checked source rights and rights basis required")
    for k in ("people_consents_checked", "music_rights_checked"):
        if approval.get(k) is not True:
            raise ValueError("Rights gate not passed: " + k)
    if type(approval.get("contains_minors")) is not bool:
        raise ValueError("Explicit minors decision required")
    if approval["contains_minors"] and approval.get("guardian_consents_checked") is not True:
        raise ValueError("Minors need documented guardian clearance")
    clips = plan.get("clips")
    if not isinstance(clips, list) or not 1 <= len(clips) <= 5:
        raise ValueError("Invalid number of clips")
    outdir = Path(output_dir).expanduser().resolve() / plan["slug"]
    if outdir.exists() and any(outdir.iterdir()):
        raise FileExistsError("Existing output; no overwrites or duplicate renders")
    outdir.mkdir(parents=True, exist_ok=True)
    records = []
    for i, clip in enumerate(clips, 1):
        start, length = float(clip["start"]), float(clip["duration"])
        if not (0 <= start and 2 <= length <= 59 and start + length <= plan["source_info"]["duration"] + 0.05):
            raise ValueError("Unsafe cut bounds")
        subtitle_path = outdir / f"{i:02}-captions.srt"
        video_path = outdir / f"{i:02}-{plan['slug']}.mp4"
        save_captions(clip, subtitle_path)
        # FFmpeg filter: letterbox preserves full combat movement; captions safe-area bottom.
        escaped = str(subtitle_path).replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'").replace(",", "\\,")
        vf = ("scale=1080:1920:force_original_aspect_ratio=decrease,"
              "pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,"
              f"subtitles='{escaped}':force_style='FontSize=20,Outline=2,Shadow=1,Alignment=2,MarginV=190'")
        cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-n",
               "-ss", str(start), "-i", str(source), "-t", str(length),
               "-map", "0:v:0", "-map", "0:a:0?", "-vf", vf,
               "-c:v", "libx264", "-preset", "veryfast", "-crf", "25", "-pix_fmt", "yuv420p",
               "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(video_path)]
        call(cmd, timeout=600)
        info = media_probe(video_path)
        if info["width"] != 1080 or info["height"] != 1920 or abs(info["duration"] - length) > 0.5:
            raise RuntimeError("Rendered video failed resolution/duration QA")
        records.append({"file": str(video_path), "sha256": sha256(video_path),
                        "source_sha256": plan["source_sha256"], "duration_s": info["duration"],
                        "hook": clip["hook"], "title": clip["title"], "caption": clip["caption"],
                        "source_start_s": start, "status": "MEDIA_RENDERED_REVIEW_REQUIRED",
                        "approved": False, "published": False, "live_url": None})
    report = {"status": "MEDIA_RENDERED_REVIEW_REQUIRED", "source_sha256": plan["source_sha256"],
              "entity": plan["entity"], "rights_status": approval["rights_status"],
              "rights_basis": approval["rights_basis"], "editorial_approved": False,
              "published": False, "platform_scheduled": False,
              "handoff": "Review footage, hook, consent, claims and captions. Re-ingest into EXISTING ShortFactory SQLite then canonical SocialPublishing queue only after approval.",
              "videos": records}
    (outdir / "QA.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return {"status": report["status"], "rendered": len(records), "qa": str(outdir / "QA.json")}


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    commands = p.add_subparsers(dest="command", required=True)
    prepare = commands.add_parser("plan", help="Suggest Shorts from LOCAL original video")
    prepare.add_argument("source")
    prepare.add_argument("--output", required=True)
    prepare.add_argument("--topic", required=True)
    prepare.add_argument("--entity", required=True, choices=sorted(ENTITIES))
    prepare.add_argument("--cta", required=True)
    prepare.add_argument("--srt")
    prepare.add_argument("--count", type=int, default=5)
    prepare.add_argument("--length", type=float, default=18)
    batch = commands.add_parser("batch", help="Generate review plans for every local video in a folder")
    batch.add_argument("folder")
    batch.add_argument("--output", required=True)
    batch.add_argument("--topic", required=True)
    batch.add_argument("--entity", required=True, choices=sorted(ENTITIES))
    batch.add_argument("--cta", required=True)
    batch.add_argument("--limit", type=int, default=300)
    rend = commands.add_parser("render", help="Render after independent rights clearance")
    rend.add_argument("--plan", required=True)
    rend.add_argument("--clearance", required=True)
    rend.add_argument("--output", required=True)
    a = p.parse_args(argv)
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise RuntimeError("Free FFmpeg and ffprobe must be installed")
    if a.command == "plan":
        if not 1 <= a.count <= 5:
            raise ValueError("Maximum five cut proposals per source")
        output = make_plan(a.source, a.output, a.topic, a.entity, a.cta, a.srt, a.count, a.length)
    elif a.command == "render":
        output = render(a.plan, a.clearance, a.output)
    else:
        folder = Path(a.folder).expanduser().resolve(strict=True)
        sources = sorted(x for x in folder.iterdir() if x.is_file() and x.suffix.lower() in VIDEO_SUFFIXES)
        if a.limit < 1 or a.limit > 400:
            raise ValueError("Batch limit must be 1..400")
        seen, outputs = set(), []
        for path in sources[:a.limit]:
            fingerprint = sha256(path)
            if fingerprint in seen:
                outputs.append({"source": str(path), "status": "SKIP_DUPLICATE_SHA256"})
                continue
            seen.add(fingerprint)
            try:
                r = make_plan(path, Path(a.output) / (slugify(path.stem) + "-" + fingerprint[:10]),
                              a.topic, a.entity, a.cta)
                outputs.append({"source": str(path), **r})
            except (ValueError, RuntimeError, FileExistsError, subprocess.CalledProcessError) as ex:
                outputs.append({"source": str(path), "status": "BLOCKED", "error": str(ex)[:200]})
        output = {"status": "BATCH_PLAN_ONLY", "sources": len(sources), "processed": len(outputs), "items": outputs}
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (FileNotFoundError, ValueError, RuntimeError, subprocess.CalledProcessError) as exc:
        print(json.dumps({"status": "BLOCKED", "error": str(exc)[:500]}), file=sys.stderr)
        sys.exit(2)