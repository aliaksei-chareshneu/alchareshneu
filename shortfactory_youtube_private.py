"""Official YouTube private-only upload for the existing MoravianHost ShortFactory.

One-time OAuth is interactive. Recurring runs are non-interactive and fail closed.
No public publishing, no secrets in GitHub or video artifacts, no blind retries.
"""
from __future__ import annotations
import argparse, hashlib, json, os, re, sys, tempfile
from datetime import datetime, timezone
from pathlib import Path

SCOPES = ["https://www.googleapis.com/auth/youtube.upload",
          "https://www.googleapis.com/auth/youtube.readonly"]
CONFIG = Path.home() / ".config" / "MoravianHost" / "ShortFactory"
JOB_ID = re.compile(r"^[a-zA-Z0-9_-]{3,70}$")


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for part in iter(lambda: f.read(1024 * 1024), b""):
            h.update(part)
    return h.hexdigest()


def write_once(path: Path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Idempotency: exclusive creation. Crash/timeout leaves a HOLD; never blindly retry.
    with path.open("x", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")


def update_state(path: Path, obj: dict) -> None:
    temp = path.with_name(path.name + ".tmp")
    with temp.open("w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")
        f.flush()
        os.fsync(f.fileno())
    os.replace(temp, path)


def validate_manifest(data: dict, video: Path, channel_id: str) -> dict:
    if not video.is_file() or video.suffix.lower() != ".mp4" or video.stat().st_size < 100_000:
        raise ValueError("No valid rendered MP4")
    if not isinstance(data, dict) or data.get("upload_visibility") != "private":
        raise ValueError("Only PRIVATE uploads are supported")
    if data.get("editorial_approved") is not True or data.get("rights_verified") is not True:
        raise ValueError("No independent editorial and rights approval")
    if data.get("synthetic_media") is not True or data.get("made_for_kids") is not False:
        raise ValueError("Explicit synthetic-media disclosure and audience required")
    if data.get("entity") not in {"DRUZINA_ZS", "OSVC"}:
        raise ValueError("Unknown legal entity")
    job_id = data.get("job_id", "")
    if not isinstance(job_id, str) or not JOB_ID.fullmatch(job_id):
        raise ValueError("Unsafe job id")
    title = data.get("title", "")
    description = data.get("description", "")
    if not isinstance(title, str) or not 8 <= len(title) <= 100:
        raise ValueError("Video title missing or too long")
    if not isinstance(description, str) or not 70 <= len(description) <= 4500:
        raise ValueError("Description must include sources, licence and one verified CTA")
    if ("http" not in description or "License" not in description and "Licence" not in description):
        raise ValueError("Source links and licence statement required")
    if not isinstance(channel_id, str) or not channel_id.startswith("UC") or len(channel_id) < 20:
        raise ValueError("Explicit destination YouTube channel ID required")
    if data.get("channel_id") != channel_id:
        raise ValueError("Manifest destination does not match configured channel")
    expect = data.get("video_sha256")
    actual = digest(video)
    if expect != actual:
        raise ValueError("MP4 hash differs from reviewed manifest")
    if data.get("external_publication_approved") is True:
        raise ValueError("Public release must use a separate approval flow")
    return {"job_id": job_id, "title": title, "description": description, "sha256": actual}


def oauth_files(config_dir: Path):
    return config_dir / "youtube_oauth_client.json", config_dir / "youtube_token.json"


def oauth_authenticate(config_dir: Path, interactive: bool = False):
    """Return a valid OAuth credential. Only --authorize can open a browser."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    client_file, token_file = oauth_files(config_dir)
    if interactive:
        if not client_file.is_file():
            raise FileNotFoundError("Put OAuth desktop client JSON at " + str(client_file))
        from google_auth_oauthlib.flow import InstalledAppFlow
        creds = InstalledAppFlow.from_client_secrets_file(
            str(client_file), SCOPES
        ).run_local_server(port=0, open_browser=True, access_type="offline",
                           prompt="consent")
        config_dir.mkdir(parents=True, exist_ok=True)
        token_file.write_text(creds.to_json(), encoding="utf-8")
        print("OAUTH_AUTHORIZED: Saved private token outside git to", token_file)
        return creds
    if not token_file.is_file():
        raise FileNotFoundError("NO_YOUTUBE_TOKEN: authorize once interactively")
    creds = Credentials.from_authorized_user_file(str(token_file), SCOPES)
    if not creds.valid and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        token_file.write_text(creds.to_json(), encoding="utf-8")
    if not creds.valid:
        raise PermissionError("Google OAuth expired or revoked; run --authorize again")
    return creds


def private_upload(video: Path, manifest: dict, state_dir: Path, config_dir: Path,
                   channel_id: str, dry_run: bool) -> dict:
    info = validate_manifest(manifest, video, channel_id)
    state_file = state_dir / (info["job_id"] + ".json")
    if state_file.exists():
        current = json.loads(state_file.read_text(encoding="utf-8"))
        return {"status": "ALREADY_ATTEMPTED_NO_RETRY", "state": current.get("status"),
                "video_id": current.get("video_id"), "job_id": info["job_id"]}
    # Cross-episode duplicate protection: refuse a second upload of identical MP4 bytes.
    if state_dir.is_dir():
        for previous in state_dir.glob("*.json"):
            try:
                prior = json.loads(previous.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                raise RuntimeError("Corrupted upload receipt, manual review required")
            if prior.get("sha256") == info["sha256"] and previous != state_file:
                raise ValueError("The same rendered MP4 was already used in another YouTube upload attempt")
    if dry_run:
        return {"status": "DRY_RUN_VALIDATED", "job_id": info["job_id"],
                "sha256": info["sha256"], "would_upload_private": True}
    # Authenticate and verify account BEFORE creating a potentially ambiguous upload attempt.
    creds = oauth_authenticate(config_dir)
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload
    service = build("youtube", "v3", credentials=creds, cache_discovery=False)
    channels = service.channels().list(part="id,snippet", mine=True).execute().get("items", [])
    if len(channels) != 1 or channels[0].get("id") != channel_id:
        raise PermissionError("Wrong or ambiguous YouTube channel; upload refused")
    state = {"job_id": info["job_id"], "sha256": info["sha256"],
             "channel_id": channel_id, "status": "UPLOADING_UNKNOWN_IF_INTERRUPTED",
             "visibility": "private",
             "attempt_utc": datetime.now(timezone.utc).isoformat()}
    write_once(state_file, state)
    body = {
        "snippet": {
            "title": info["title"], "description": info["description"],
            "categoryId": "27", "defaultLanguage": "en",
            "tags": [str(s)[:30] for s in manifest.get("tags", [])[:10]]
        },
        "status": {
            "privacyStatus": "private", "selfDeclaredMadeForKids": False,
            "containsSyntheticMedia": True, "embeddable": False
        }
    }
    try:
        request = service.videos().insert(
            part="snippet,status", body=body,
            media_body=MediaFileUpload(str(video), mimetype="video/mp4",
                                       chunksize=5*1024*1024, resumable=True)
        )
        response = None
        while response is None:
            _, response = request.next_chunk()
        vid = response.get("id")
        if not vid or not re.fullmatch(r"[a-zA-Z0-9_-]{11}", vid):
            raise RuntimeError("API response missing video ID (upload outcome unknown)")
        state.update(status="UPLOADED_PRIVATE_NEEDS_READBACK", video_id=vid)
        update_state(state_file, state)
        verified = service.videos().list(part="status", id=vid).execute().get("items", [])
        status = (verified[0].get("status", {}) if verified else {})
        if status.get("privacyStatus") != "private":
            raise RuntimeError("Private upload readback mismatch")
        state.update(status="UPLOADED_PRIVATE_VERIFIED",
                     youtube_url="https://www.youtube.com/watch?v=" + vid,
                     verified_utc=datetime.now(timezone.utc).isoformat())
        update_state(state_file, state)
        return {"status": state["status"], "video_id": vid,
                "youtube_url": state["youtube_url"], "job_id": info["job_id"]}
    except Exception as exc:
        state.update(status="HOLD_CHECK_CHANNEL_BEFORE_RETRY",
                     last_error=type(exc).__name__ + ": " + str(exc)[:300])
        update_state(state_file, state)
        raise


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--authorize", action="store_true")
    p.add_argument("--video", type=Path)
    p.add_argument("--manifest", type=Path)
    p.add_argument("--channel-id", default=os.environ.get("SHORTFACTORY_YOUTUBE_CHANNEL_ID", ""))
    p.add_argument("--state-dir", type=Path, default=Path.home()/"MoravianHost"/"MediaMachine"/"ShortFactory"/"state"/"youtube")
    p.add_argument("--config-dir", type=Path, default=CONFIG)
    p.add_argument("--upload-private", action="store_true")
    a = p.parse_args()
    if a.authorize:
        oauth_authenticate(a.config_dir, interactive=True)
        return 0
    if not a.video or not a.manifest:
        p.error("--video and --manifest are required unless --authorize")
    data = json.loads(a.manifest.read_text(encoding="utf-8"))
    result = private_upload(a.video, data, a.state_dir, a.config_dir,
                            a.channel_id, dry_run=not a.upload_private)
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
