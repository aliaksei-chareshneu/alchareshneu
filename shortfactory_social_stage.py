"""Safe local ShortFactory -> existing Community Hub SocialPublishing CSV staging.

Never writes Google Sheets, calls APIs, schedules posts, grants approval, or publishes.
Always leave duplicate/rights/visibility/media hosting approvals blank.
"""
import argparse
import csv
import json
import os
from pathlib import Path
import re
import sqlite3
import tempfile

HEADERS = [
    "Duplicate_Checked", "Job_ID", "Event_ID", "Channel", "Scheduled_At",
    "Status", "Caption", "Media_URL", "Video_Drive_ID", "Post_ID",
    "Post_URL", "Attempted_At", "Error", "Entity", "Grant_Funded",
    "Grant_Text", "Rights_OK", "Approved_At", "Visibility", "Made_For_Kids"
]
PLATFORMS = {"youtube_shorts", "instagram_reels", "facebook_reels", "tiktok"}
RIGHTS = {"owned", "licensed", "public_domain", "transformative_review"}
ENTITIES = {"OSVC", "DRUZINA_ZS"}
JOB = re.compile(r"^[a-zA-Z0-9_-]{1,60}$")

def sheet_safe(value):
    value = str(value or "").replace("\x00", "").strip()
    if value.startswith(("=", "+", "-", "@")):
        value = "'" + value
    return value

def verify_existing_job(con, item, media):
    # The manifest is advisory: an original read-only SQLite review is required.
    jid = item["job_id"]
    try:
        row = con.execute(
            "SELECT status,rights_status,output_path,transform_path,reviewed_at,"
            "hook,commentary,target_platforms FROM short_jobs WHERE job_id=?", (jid,)
        ).fetchone()
    except sqlite3.Error:
        raise ValueError("Existing ShortFactory database schema not ready") from None
    if row is None or row["status"] not in {"APPROVED_FOR_PUBLISH_QUEUE", "PUBLISHED_PARTIAL"}:
        raise ValueError("Canonical job is not approved for a publish queue")
    if not row["reviewed_at"] or row["rights_status"] != item["rights_status"]:
        raise ValueError("Canonical job review or rights mismatch")
    expected = (row["transform_path"] or row["output_path"] or "").strip()
    if not expected or Path(expected).resolve() != media.resolve():
        raise ValueError("Reviewed media path differs from canonical job")
    if row["rights_status"] == "transformative_review" and not row["transform_path"]:
        raise ValueError("Transformed commentary layer is required")
    accepted = {p.strip() for p in (row["target_platforms"] or "").split(",")}
    if item["platform"] not in accepted:
        raise ValueError("Destination was not approved in original job")
    expected_caption = "\n\n".join(
        x for x in ((row["hook"] or "").strip(), (row["commentary"] or "").strip()) if x
    )
    if item.get("caption", "") != expected_caption:
        raise ValueError("Caption changed after ShortFactory review")
    try:
        posted = con.execute(
            "SELECT 1 FROM short_posts WHERE job_id=? AND platform=?",
            (jid, item["platform"])
        ).fetchone()
    except sqlite3.Error:
        raise ValueError("Canonical post receipt ledger unavailable") from None
    if posted:
        raise ValueError("Publication receipt already exists for this job/platform")

def stage(manifest, entity, db_path):
    if entity not in ENTITIES:
        raise ValueError("Explicit legal entity required")
    if not isinstance(manifest, dict) or not isinstance(manifest.get("items"), list):
        raise ValueError("Bad ShortFactory manifest")
    db_path = Path(db_path).expanduser().resolve()
    if not db_path.is_file():
        raise ValueError("Existing ShortFactory SQLite ledger required")
    items = manifest["items"]
    if len(items) > 500:
        raise ValueError("Excessive manifest size")
    seen, rows = set(), []
    try:
        con = sqlite3.connect(db_path.as_uri() + "?mode=ro", uri=True)
        con.row_factory = sqlite3.Row
    except sqlite3.Error:
        raise ValueError("Cannot read canonical ShortFactory database") from None
    for item in items:
        if not isinstance(item, dict):
            raise ValueError("Invalid manifest item")
        jid = item.get("job_id", "")
        platform = item.get("platform", "")
        if not isinstance(jid, str) or not JOB.fullmatch(jid) or platform not in PLATFORMS:
            raise ValueError("Invalid job or destination")
        key = ("SF-" + jid + ":" + platform)
        if key in seen:
            raise ValueError("Duplicate ShortFactory job/platform in manifest")
        seen.add(key)
        rights = item.get("rights_status")
        if item.get("approved") is not True or item.get("status") != "WAITING_EXTERNAL_PUBLISHER" or rights not in RIGHTS:
            raise ValueError("Manifest item is not explicitly reviewed and approved")
        evidence = item.get("evidence_required") or []
        if not isinstance(evidence, list) or not {"post_id", "post_url", "published_at"}.issubset(evidence):
            raise ValueError("Missing publication evidence contract")
        media = item.get("file_path")
        if not isinstance(media, str) or Path(media).suffix.lower() != ".mp4":
            raise ValueError("Reviewed MP4 required")
        path = Path(media)
        if not path.is_file() or path.stat().st_size == 0:
            raise ValueError("Reviewed media missing")
        verify_existing_job(con, item, path)
        caption = item.get("caption", "")
        if not isinstance(caption, str) or len(caption) > 8000:
            raise ValueError("Invalid caption")
        row = {h: "" for h in HEADERS}
        row.update({
            "Job_ID": key,
            "Channel": platform,  # route alias, not an authenticated account ID
            "Status": "DRAFT",
            "Caption": sheet_safe(caption),
            "Entity": entity,
            "Visibility": "private",
        })
        # Deliberately NO approval/rights/duplicate check/media URL/live send.
        rows.append(row)
    con.close()
    return rows

def write(rows, target):
    target = Path(target)
    if target.exists():
        raise FileExistsError("Refuse overwrite of staged import without review")
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8-sig", newline="",
                                         dir=str(target.parent), suffix=".tmp", delete=False) as f:
            tmp = Path(f.name)
            out = csv.DictWriter(f, fieldnames=HEADERS)
            out.writeheader()
            out.writerows(rows)
            f.flush()
            os.fsync(f.fileno())
        os.replace(str(tmp), str(target))
    finally:
        if tmp and tmp.exists():
            tmp.unlink()

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--manifest", type=Path, required=True)
    ap.add_argument("--db", type=Path, default=Path.home() / "MoravianHost" / "MediaMachine" / "media_index.sqlite")
    ap.add_argument("--entity", required=True, choices=sorted(ENTITIES))
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()
    data = json.loads(args.manifest.read_text(encoding="utf-8"))
    rows = stage(data, args.entity, args.db)
    write(rows, args.output)
    print(json.dumps({
        "status": "DRAFT_STAGED_ONLY", "rows": len(rows),
        "published": 0, "approved": 0, "cloud_writes": 0
    }))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
