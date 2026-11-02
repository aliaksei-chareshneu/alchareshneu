"""Research-only YouTube idea queue: NO stream download, reuse, or uploads.

Only verified original video links become editorial REFERENCES. A source URL, a
claim of Creative Commons, or a creator's permission does not automatically
satisfy third-party copyrights, platform access rules or YPP reused-content.
Obtain independently licensed media from its rights holder, not the YouTube
stream, and verify before handing it to the separate private Drive pipeline.
"""
import argparse
import csv
import hashlib
import json
import re
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlsplit,parse_qs

ROOT=Path.home()/"MoravianHost"/"MediaMachine"/"ShortFactory"
SOURCE=ROOT/"third_party_youtube_references_20261102.csv"
DEST=ROOT/"youtube_references"
ID=re.compile(r"^[a-zA-Z0-9_-]{11}$")

def video_id(value:str)->str:
    p=urlsplit(value.strip())
    domain=(p.hostname or "").lower()
    if p.scheme!="https" or domain not in {"youtube.com","www.youtube.com","m.youtube.com","youtu.be"}:
        raise ValueError("Only HTTPS YouTube video URLs")
    if domain=="youtu.be":
        vid=p.path.strip("/")
    elif p.path=="/watch":
        vid=parse_qs(p.query).get("v",[""])[0]
    elif p.path.startswith("/shorts/"):
        vid=p.path.split("/")[2]
    else:raise ValueError("Not a video URL")
    if not ID.fullmatch(vid):raise ValueError("Malformed video ID")
    return vid

def run(source:Path=SOURCE,dest:Path=DEST)->dict:
    dest.mkdir(parents=True,exist_ok=True)
    if not source.exists():return {"status":"EMPTY_SOURCE","candidates":0,"new":0,"published":0}
    with source.open(encoding="utf-8-sig",newline="") as f:
        rows=list(csv.DictReader(f))
    added=0;kept=0;issues=[];seen=set()
    for row in rows:
        try:
            vid=video_id(row.get("youtube_url",""))
            if vid in seen:
                issues.append("duplicate video "+vid)
                continue
            seen.add(vid)
            if row.get("content_policy")!="REFERENCE_ONLY_NO_DOWNLOAD":
                raise ValueError("Only reference-only items are acceptable")
            if row.get("rights_status")!="UNKNOWN":
                raise ValueError("Cannot silently assert rights")
            name=(row.get("title") or "").strip()
            creator=(row.get("creator") or "").strip()
            if not name or not creator:raise ValueError("Missing source metadata")
            out=dest/(vid+".json")
            item={
              "video_id":vid,
              "url":"https://www.youtube.com/watch?v="+vid,
              "creator":creator,
              "source_title":name,
              "source_first_published":row.get("first_source_date",""),
              "original_editorial_angle":row.get("research_angle","").strip(),
              "status":"RESEARCH_ONLY_NEEDS_ORIGINAL_SCRIPT",
              "media_rights":"UNKNOWN",
              "youtube_stream_download_allowed":False,
              "commercial_derivative_rights":"UNVERIFIED",
              "creator_permission_for_commercial_use":"UNVERIFIED",
              "licensed_source_file":"NOT_SUPPLIED",
              "music_rights":"UNVERIFIED",
              "participants_consents":"UNVERIFIED",
              "may_use_video_or_audio":False,
              "may_cite_or_link_source":True,
              "public_post_status":"NOT_PREPARED",
              "next":"Create original research-led script; request independent media license only if using source footage",
              "evidence_recorded_utc":datetime.now(timezone.utc).isoformat()
            }
            if out.exists():
                old=json.loads(out.read_text(encoding="utf-8"))
                if old["video_id"]!=vid:raise ValueError("Existing record ID mismatch")
                kept+=1
            else:
                out.write_text(json.dumps(item,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
                added+=1
        except (ValueError,KeyError,OSError) as e:
            issues.append(str(e))
    return {"status":"RESEARCH_ONLY","candidates":len(seen),
            "new":added,"existing":kept,"issues":issues,"downloaded":0,
            "licensed_reuse_assumed":0,"published":0,"paid_calls":0}
if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--source",type=Path,default=SOURCE)
    p.add_argument("--out",type=Path,default=DEST)
    a=p.parse_args()
    print(json.dumps(run(a.source,a.out),ensure_ascii=False))
