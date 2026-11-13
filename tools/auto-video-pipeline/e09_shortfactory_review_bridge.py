"""E09 render receipt bridge for the EXISTING ShortFactory (no queue, publish, CRM writes).
A technically valid MP4 remains PRIVATE REVIEW; rights/owner acceptance is a separate action.
"""
import argparse
import hashlib
import json
import math
import subprocess
from pathlib import Path

def sha256(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def inspect(project, receipt, filename, *, probe=None):
    if project.get("mode") != "PRIVATE_DEMO_ONLY" or project.get("rights_status") != "PUBLIC_RELEASE_BLOCKED":
        raise ValueError("A private demo cannot infer public rights")
    for key in ("published", "owner_accepted"):
        if project.get(key) is not False or receipt.get(key) is not False:
            raise ValueError("Render does not prove publishing or owner acceptance")
    if project.get("media_controller") not in ("DRUZINA_MORAVY_ZS", "OSVC", "BRNOWALKERS"):
        raise ValueError("Unknown legal entity")
    shots = project.get("shots")
    if not isinstance(shots, list) or not 5 <= len(shots) <= 15:
        raise ValueError("Invalid shot list")
    total = 0.0
    for shot in shots:
        sec = shot.get("duration")
        if isinstance(sec, bool) or not isinstance(sec, (float, int)) or not math.isfinite(sec) or not .75 <= sec <= 5:
            raise ValueError("Invalid shot duration")
        total += sec
    if not 15 <= total <= 30:
        raise ValueError("Video length must be 15-30s")
    sources = project.get("sources")
    if not isinstance(sources, dict) or not sources:
        raise ValueError("Source provenance missing")
    for key, source in sources.items():
        if source.get("rights") != "NOT_VERIFIED_PUBLIC_RELEASE" or source.get("consent") != "NOT_VERIFIED":
            raise ValueError("Do not promote unverified sources")
        digest = source.get("sha256")
        if not isinstance(digest, str) or len(digest) != 64 or receipt.get("source_shas", {}).get(key) != digest:
            raise ValueError("SHA256 source provenance changed")
    movie = Path(filename).resolve(strict=True)
    if movie.suffix.lower() != ".mp4" or sha256(movie) != receipt.get("sha256"):
        raise ValueError("Rendered MP4 digest mismatch")
    if probe is None:
        data = subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries",
            "stream=codec_type,codec_name,width,height,r_frame_rate:format=duration,size",
            "-of", "json", str(movie)
        ], text=True, timeout=30)
        probe = json.loads(data)
    video = next((s for s in probe.get("streams", []) if s.get("codec_type") == "video"), {})
    audio = next((s for s in probe.get("streams", []) if s.get("codec_type") == "audio"), {})
    duration = float(probe.get("format", {}).get("duration", 0))
    if (video.get("codec_name"), video.get("width"), video.get("height"), video.get("r_frame_rate")) != ("h264", 1080, 1920, "30/1"):
        raise ValueError("Unexpected codec or video size")
    if audio.get("codec_name") != "aac" or abs(duration - total) > .2:
        raise ValueError("Audio codec or duration mismatch")
    return {
        "stage": "TECHNICAL_REVIEW_ONLY",
        "reused_component": "EXISTING_SHORTFACTORY",
        "sha256": receipt["sha256"],
        "duration": duration,
        "rights_review": "BLOCKED",
        "human_artistic_review": "PENDING",
        "owner_accepted": False,
        "publish_allowed": False,
        "crm_write_performed": False,
        "public_post_url": None,
        "no_new_queue": True,
    }

def main():
    parser = argparse.ArgumentParser()
    for name in ("project", "receipt", "video"):
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    result = inspect(
        json.loads(Path(args.project).read_text(encoding="utf-8")),
        json.loads(Path(args.receipt).read_text(encoding="utf-8")),
        args.video)
    print(json.dumps(result))

if __name__ == "__main__":
    main()
