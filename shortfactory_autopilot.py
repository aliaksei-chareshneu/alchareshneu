"""Operate existing ShortFactory on a recurring schedule, one approved episode per run.

Inputs: queue/ready/*.json (editorially vetted local episode specifications).
Outputs: original narration, two MP4 reviews, QA manifest, optional official
YouTube PRIVATE upload with channel-bound OAuth. No public auto-publishing.
Does not create a second CRM or duplicate the existing SocialPublishing queue.
"""
from __future__ import annotations
import argparse, json, os, re, subprocess, sys, traceback
from datetime import datetime, timezone
from pathlib import Path

from shortfactory_youtube_private import digest, private_upload

ID = re.compile(r"^[a-z0-9][a-z0-9_-]{2,59}$")
ROOT = Path(__file__).resolve().parent


def safe_child(root: Path, relative: str) -> Path:
    if not isinstance(relative, str) or relative.startswith(("/", "\\")):
        raise ValueError("Unsafe relative path")
    if ":" in relative or ".." in Path(relative).parts:
        raise ValueError("Unsafe episode path")
    p = (root / relative).resolve()
    if not p.is_relative_to(root.resolve()) or not p.is_file():
        raise FileNotFoundError("No vetted episode source: " + relative)
    return p


def load_episode(path: Path, base: Path) -> dict:
    spec = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(spec, dict) or not ID.fullmatch(str(spec.get("episode_id", ""))):
        raise ValueError("Bad episode id")
    if not str(path.stem) == spec["episode_id"]:
        raise ValueError("Episode filename must match id")
    for k in ("voice_spec", "visual_spec"):
        safe_child(base, spec.get(k))
    if spec.get("licensed_material_verified") is not True:
        raise ValueError("Rights were not verified for this production")
    if spec.get("entity") not in {"DRUZINA_ZS", "OSVC"}:
        raise ValueError("Must name the correct legal entity")
    if spec.get("upload_visibility") != "private":
        raise ValueError("Only private automatic uploads are supported")
    if spec.get("made_for_kids") is not False:
        raise ValueError("Explicit intended audience flag required")
    if spec.get("synthetic_media") is not True:
        raise ValueError("AI reconstruction flag required")
    if spec.get("preferred_variant") not in {"documentary", "action"}:
        raise ValueError("Unknown selected video edit")
    if spec.get("editorial_approved") not in {True, False}:
        raise ValueError("Must explicitly declare editorial review status")
    if not isinstance(spec.get("title"), str) or len(spec["title"]) < 8:
        raise ValueError("Missing original title")
    if not isinstance(spec.get("summary"), str) or len(spec["summary"]) < 30:
        raise ValueError("Missing original educational summary")
    if spec.get("approved_for_public") is True:
        raise ValueError("Auto-public is not supported; separate release workflow")
    return spec


def publish_description(spec: dict, credits: str) -> str:
    cta = spec.get("cta_url", "")
    if not isinstance(cta, str) or not cta.startswith("https://"):
        raise ValueError("Must use one verified https CTA")
    text = (
        spec["summary"].strip() + "\n\n" +
        "Explore more: " + cta + "\n\n" +
        "Source & License / Attribution:\n" + credits[:3100] + "\n\n" +
        "Illustrative reconstruction. Historical interpretation, not live ancient footage."
    )
    if len(text) > 4500:
        raise ValueError("Description with credits is too long")
    return text


def assemble(spec: dict, root: Path, drafts: Path, cache: Path, dry_run: bool) -> tuple[Path, Path]:
    job = spec["episode_id"]
    outdir = drafts / job
    qa = outdir / "QA.json"
    if qa.is_file():
        report = json.loads(qa.read_text(encoding="utf-8"))
    else:
        if dry_run:
            return outdir / "(would_render).mp4", outdir / "(would_write_manifest).json"
        if outdir.exists() and any(outdir.iterdir()):
            raise RuntimeError("Incomplete draft directory; inspect before retry: " + str(outdir))
        runner = root / "shortfactory_free_one_click.py"
        cmd = [sys.executable, str(runner),
               "--config", str(safe_child(root, spec["visual_spec"])),
               "--script", str(safe_child(root, spec["voice_spec"])),
               "--outdir", str(outdir), "--cache", str(cache)]
        subprocess.run(cmd, cwd=root, check=True, timeout=1800)
        report = json.loads(qa.read_text(encoding="utf-8"))
    if report.get("status") != "DRAFT_REVIEW_ONLY":
        raise RuntimeError("Renderer QA does not certify a review draft")
    entry = report.get("variants", {}).get(spec["preferred_variant"])
    if not entry or entry.get("published") is not False or entry.get("resolution") != "1080x1920":
        raise ValueError("Missing complete private draft variant")
    video = outdir / entry["file"]
    if not video.is_file() or digest(video) != entry.get("sha256"):
        raise RuntimeError("Output MP4 changed after QA")
    credit_path = outdir / "LICENSE_CREDITS.txt"
    if not credit_path.is_file():
        raise FileNotFoundError("Attribution missing")
    manifest = {
        "job_id": job, "title": spec["title"],
        "description": publish_description(spec, credit_path.read_text(encoding="utf-8")),
        "entity": spec["entity"], "channel_id": spec.get("channel_id", ""),
        "tags": spec.get("tags", []), "editorial_approved": spec["editorial_approved"],
        "rights_verified": spec["licensed_material_verified"],
        "synthetic_media": True, "made_for_kids": False,
        "upload_visibility": "private", "external_publication_approved": False,
        "video_sha256": entry["sha256"]
    }
    manifest_file = outdir / "youtube_private_manifest.json"
    # Review status may change between runs; maintain a local render metadata only.
    manifest_file.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
                             encoding="utf-8")
    return video, manifest_file


def loop(root: Path, queue: Path, drafts: Path, cache: Path, state: Path,
         channel_id: str, upload_private: bool, dry_run: bool) -> dict:
    ready = sorted(queue.glob("*.json"))
    if not ready:
        return {"status": "IDLE_NO_VETTED_EPISODES", "processed": 0}
    errors = []
    for item in ready:
        try:
            spec = load_episode(item, root)
            job = spec["episode_id"]
            output, manifest_file = assemble(spec, root, drafts, cache, dry_run)
            if dry_run:
                return {"status": "DRY_RUN_READY", "episode_id": job,
                        "would_render": str(output), "would_upload_private": bool(upload_private)}
            if spec["editorial_approved"] is not True:
                return {"status": "RENDERED_NEEDS_EDITORIAL_APPROVAL",
                        "episode_id": job, "file": str(output)}
            if not upload_private:
                return {"status": "RENDERED_READY_FOR_PRIVATE_UPLOAD",
                        "episode_id": job, "file": str(output)}
            if not channel_id or spec.get("channel_id") != channel_id:
                return {"status": "BLOCKED_CHANNEL_NOT_CONNECTED", "episode_id": job,
                        "file": str(output)}
            upload = private_upload(
                output, json.loads(manifest_file.read_text(encoding="utf-8")),
                state / "youtube", Path.home()/".config"/"MoravianHost"/"ShortFactory",
                channel_id, dry_run=False)
            return {"status": upload["status"], "episode_id": job,
                    "private_youtube_url": upload.get("youtube_url")}
        except (ValueError, RuntimeError, FileNotFoundError, PermissionError,
                subprocess.CalledProcessError) as exc:
            errors.append({"episode": item.stem, "error": type(exc).__name__ + ": " + str(exc)[:220]})
            continue
    return {"status": "ALL_EPISODES_BLOCKED", "errors": errors, "processed": 0}


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", type=Path, default=ROOT)
    p.add_argument("--queue", type=Path, default=ROOT/"queue"/"ready")
    p.add_argument("--drafts", type=Path, default=Path.home()/"MoravianHost"/"MediaMachine"/"Drafts"/"ShortFactory")
    p.add_argument("--cache", type=Path, default=Path.home()/".cache"/"MoravianHost"/"ShortFactory")
    p.add_argument("--state", type=Path, default=ROOT/"state")
    p.add_argument("--channel-id", default=os.environ.get("SHORTFACTORY_YOUTUBE_CHANNEL_ID",""))
    p.add_argument("--upload-private", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args()
    result = loop(a.root.resolve(), a.queue.resolve(), a.drafts.resolve(), a.cache.resolve(),
                  a.state.resolve(), a.channel_id, a.upload_private, a.dry_run)
    print(json.dumps(result, ensure_ascii=False))
    return 1 if result["status"] == "ALL_EPISODES_BLOCKED" else 0


if __name__ == "__main__":
    raise SystemExit(main())
