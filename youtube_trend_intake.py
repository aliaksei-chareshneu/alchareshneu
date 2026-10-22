"""YouTube most-popular metadata -> existing ShortFactory trend candidates.

No video downloads, clipping, publishing, consent assumptions, or second CRM.
A YouTube license label is NEVER treated as sufficient reuse permission.
The API key is read only from environment and never printed.
"""
import argparse
import csv
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import tempfile
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path.home() / "MoravianHost" / "MediaMachine" / "ShortFactory"
FIELDS = [
    "discovery_date", "title_or_topic", "wikidata_id", "media_type",
    "description", "genres", "wikipedia_rank", "wikipedia_views",
    "trend_momentum", "lane", "audience_fit", "expected_retention",
    "strategic_cta_value", "production_cost", "score", "angle",
    "rights_status", "source_reference", "status", "notes",
]
ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{11}$")
LANES = (
    ("HEMA_HISTORY", re.compile(r"\b(sword|fenc|archer|medieval|knight|castle|armor|armour|larp|hema|me[cč]|ryt[ií]r)\b", re.I)),
    ("SCIENCE_EXPERT", re.compile(r"\b(scien|chem|biolog|research|python|data|ai tools|microscop|laborator|bioinformat)\w*", re.I)),
    ("URBAN_WALK", re.compile(r"\b(brno|moravia|hiking|walking tour|city walk|castle tour|czechia)\b", re.I)),
)

def lane_for(title):
    for lane, pattern in LANES:
        if pattern.search(title):
            return lane, 9
    return "GENERAL_ENTERTAINMENT", 2

def fetch_chart(region, key, limit=30, opener=None):
    """Fetch ONLY video JSON metadata via documented YouTube Data API."""
    if not re.fullmatch(r"[A-Z]{2}", region):
        raise ValueError("Invalid ISO region")
    if not isinstance(limit, int) or not 1 <= limit <= 50:
        raise ValueError("Invalid maxResults")
    if not key:
        raise ValueError("YOUTUBE_API_KEY missing")
    params = urllib.parse.urlencode({
        "part": "snippet,statistics,status", "chart": "mostPopular",
        "regionCode": region, "maxResults": limit, "key": key
    })
    request = urllib.request.Request(
        "https://www.googleapis.com/youtube/v3/videos?" + params,
        headers={"Accept": "application/json", "User-Agent": "MoravianHost-ShortFactory/1.0"}
    )
    try:
        open_request = opener or urllib.request.urlopen
        with open_request(request, timeout=20) as response:
            data = json.load(response)
    except urllib.error.HTTPError as exc:
        raise RuntimeError("YouTube API error HTTP " + str(exc.code)) from None
    except (urllib.error.URLError, OSError, ValueError) as exc:
        raise RuntimeError("YouTube API fetch failed: " + type(exc).__name__) from None
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        raise ValueError("Invalid YouTube API response")
    return data["items"]

def candidates(items, region, day=None):
    day = day or datetime.now(timezone.utc).date().isoformat()
    rows = []
    for rank, item in enumerate(items, 1):
        if not isinstance(item, dict):
            continue
        video_id = item.get("id", "")
        if not isinstance(video_id, str) or not ID_PATTERN.fullmatch(video_id):
            continue
        snippet = item.get("snippet") or {}
        if not isinstance(snippet, dict):
            continue
        title = str(snippet.get("title") or "").strip()[:180]
        if not title:
            continue
        stats = item.get("statistics") or {}
        try:
            views = max(0, int(stats.get("viewCount") or 0))
        except (TypeError, ValueError, AttributeError):
            views = 0
        lane, fit = lane_for(title)
        momentum = round(max(0.25, 10.0 - (rank - 1) * 0.2), 2)
        url = "https://www.youtube.com/watch?v=" + video_id
        rows.append({
            "discovery_date": day,
            "title_or_topic": title,
            "wikidata_id": "",
            "media_type": "youtube_video",
            "description": "Popular YouTube video metadata only",
            "genres": "",
            "wikipedia_rank": "",
            "wikipedia_views": "",
            "trend_momentum": str(momentum),
            "lane": lane,
            "audience_fit": str(fit),
            "expected_retention": "6",
            "strategic_cta_value": "7" if fit >= 9 else "2",
            "production_cost": "4",
            "score": "",
            "angle": "Create original expert commentary using OWN or independently cleared footage.",
            "rights_status": "unknown",
            "source_reference": url,
            "status": "IDEA_NEEDS_ANGLE_AND_RIGHTS",
            "notes": "YouTube mostPopular " + region + "; rank " + str(rank) +
                     "; views " + str(views) + "; license/consent not verified; NO video downloaded.",
        })
    return rows

def merge_rows(existing, incoming):
    """Preserve Wikimedia/hand-entered ideas, replace only YouTube-chart entries."""
    protected = [dict(row) for row in existing
                 if not (row.get("media_type") == "youtube_video"
                         and str(row.get("source_reference", "")).startswith("https://www.youtube.com/watch?v="))]
    seen = {row.get("source_reference") for row in protected if row.get("source_reference")}
    for row in incoming:
        ref = row["source_reference"]
        if ref not in seen:
            protected.append(row)
            seen.add(ref)
    return protected

def read_candidates(path):
    if not path.exists():
        return [], FIELDS[:]
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        cols = reader.fieldnames
        if not cols or any(field not in cols for field in FIELDS):
            raise ValueError("Unknown ShortFactory trend CSV schema; refusing overwrite")
        return list(reader), cols

def write_candidates(path, rows, cols):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8-sig", newline="",
                                         dir=str(path.parent), suffix=".tmp", delete=False) as file:
            temp = Path(file.name)
            writer = csv.DictWriter(file, fieldnames=cols, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)
            file.flush()
            os.fsync(file.fileno())
        os.replace(str(temp), str(path))
    finally:
        if temp and temp.exists():
            temp.unlink()

def refresh(path, regions=("CZ", "US"), limit=30, key=None, fetcher=fetch_chart,
            dry_run=False):
    """All API calls and validation complete before touching canonical CSV."""
    key = key if key is not None else os.environ.get("YOUTUBE_API_KEY", "")
    if not key:
        return {"status": "SKIPPED_NO_API_KEY", "found": 0, "written": False}
    all_new = []
    for region in regions:
        all_new.extend(candidates(fetcher(region, key, limit)))
    old, cols = read_candidates(path)
    merged = merge_rows(old, all_new)
    if not dry_run:
        write_candidates(path, merged, cols)
    return {
        "status": "DRY_RUN" if dry_run else "UPDATED",
        "found": len(all_new), "unique_youtube": len(merged) -
            sum(1 for r in merged if r.get("media_type") != "youtube_video"),
        "total": len(merged), "written": not dry_run,
    }

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--merge", type=Path, default=ROOT / "trend_candidates.auto.csv")
    parser.add_argument("--regions", default="CZ,US")
    parser.add_argument("--limit", type=int, default=30)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    regions = tuple(x.strip().upper() for x in args.regions.split(","))
    if not 1 <= len(regions) <= 4 or len(set(regions)) != len(regions):
        parser.error("Expected 1-4 distinct region codes")
    try:
        result = refresh(args.merge, regions=regions, limit=args.limit, dry_run=args.dry_run)
    except (ValueError, RuntimeError) as exc:
        print(json.dumps({"status": "ERROR", "kind": type(exc).__name__}))
        return 1
    print(json.dumps(result, sort_keys=True))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
