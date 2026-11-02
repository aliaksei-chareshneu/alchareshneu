"""Private-only preview rendering from real authenticated Drive footage.

Reads existing ShortFactory edit_suggestions metadata, validates source hashes,
burns unambiguous INTERNAL REVIEW watermark, MUTES source audio and never
adds files to a publishing queue. All rights flags remain unverified.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HOME=Path.home()
ROOT=HOME/"MoravianHost"/"MediaMachine"/"ShortFactory"
INBOX=HOME/"Documents"/"ImperionMedia"/"IncomingApproved"
SUGGESTIONS=ROOT/"edit_suggestions"
PRIVATE=HOME/"MoravianHost"/"MediaMachine"/"Drafts"/"ShortFactory"/"private-drive-preview"
W,H=1080,1920

def sha256(p:Path)->str:
    h=hashlib.sha256()
    with p.open("rb") as f:
        for part in iter(lambda:f.read(4*1024*1024),b""):
            h.update(part)
    return h.hexdigest()

def overlay(target:Path)->Path:
    layer=Image.new("RGBA",(W,H),(0,0,0,0))
    d=ImageDraw.Draw(layer)
    d.rectangle((0,0,W,245),fill=(10,17,30,235))
    d.rectangle((0,1640,W,H),fill=(10,17,30,235))
    big=ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf",48)
    small=ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf",37)
    d.text((58,63),"INTERNAL EDITORIAL PREVIEW",font=big,fill=(255,209,88,255))
    d.text((58,133),"NOT CLEARED FOR PUBLICATION",font=small,fill=(255,255,255,255))
    d.text((55,1720),"CHECK PEOPLE / MUSIC / RIGHTS",font=big,fill=(255,209,88,255))
    d.text((56,1800),"DRIVE SOURCE • MUTED • NEVER AUTOPOST",font=small,fill=(255,255,255,255))
    if not target.exists(): layer.save(target)
    return target

def preview(report:Path,outdir:Path,ffmpeg:str,maxclips:int)->dict:
    data=json.loads(report.read_text(encoding="utf-8-sig"))
    if data.get("status")!="CUT_SUGGESTIONS_ONLY_RIGHTS_UNVERIFIED":
        raise ValueError("Cannot render outside private preproduction")
    source=Path(data["source_file_local"]).resolve(strict=True)
    if not source.is_relative_to(INBOX.resolve(strict=True)):
        raise PermissionError("Source not in private intake")
    sha=sha256(source)
    if data.get("source_sha256")!=sha:
        raise ValueError("Source has changed since cut suggestion")
    cut=report.with_name(sha[:16]+".cuts.json")
    spec=json.loads(cut.read_text(encoding="utf-8-sig"))
    if spec.get("rights_status")!="unknown" or spec.get("people_consents_checked") or spec.get("music_rights_checked"):
        raise PermissionError("Unexpected consent/rights values in draft-only pipeline")
    overlay_png=overlay(outdir/"private_watermark.png")
    results=[]
    for n,section in enumerate(spec["clips"][:maxclips],1):
        start=float(section["start"]);dur=float(section["duration"])
        if not (0<=start<21600 and 1<=dur<=60):raise ValueError("Invalid clip bounds")
        dest=outdir/(sha[:16]+f"_review{n:02d}.mp4")
        receipt=dest.with_suffix(".mp4.json")
        if dest.exists() or receipt.exists():
            if not (dest.exists() and receipt.exists() and
                    json.loads(receipt.read_text(encoding="utf-8"))["sha256"]==sha256(dest)):
                raise FileExistsError("Private review output mismatched, no overwrite")
            results.append({"file":str(dest),"status":"EXISTING_VERIFIED"})
            continue
        tmp=outdir/(sha[:16]+f"_review{n:02d}.partial.mp4")
        chain=("[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,"
               "pad=1080:1920:(ow-iw)/2:(oh-ih)/2[v0];"
               "[v0][1:v]overlay=shortest=1:format=auto,format=yuv420p[v]")
        cmd=[ffmpeg,"-hide_banner","-loglevel","error","-nostdin","-y",
             "-ss",str(start),"-t",str(dur),"-i",str(source),
             "-loop","1","-i",str(overlay_png),"-filter_complex",chain,
             "-map","[v]","-an","-r","24","-c:v","libx264",
             "-preset","veryfast","-crf","22","-movflags","+faststart","-t",str(dur),str(tmp)]
        cp=subprocess.run(cmd,capture_output=True,text=True,timeout=180)
        if cp.returncode!=0 or not tmp.is_file():
            if tmp.exists():tmp.unlink()
            raise RuntimeError("FFmpeg private preview failed: "+cp.stderr[-500:])
        tmp.replace(dest)
        digest=sha256(dest)
        metadata={
           "status":"PRIVATE_REVIEW_QC_PENDING","publish_allowed":False,
           "source_sha256":sha,"source_drive_id":data.get("source_drive_id"),
           "source_file":str(source),"clip_start":start,"clip_duration":dur,
           "audio":"DISCARDED","music_rights":"NOT_VERIFIED",
           "people_consents":"NOT_VERIFIED","watermark":"INTERNAL REVIEW",
           "file":str(dest),"sha256":digest,"bytes":dest.stat().st_size}
        receipt.write_text(json.dumps(metadata,indent=2),encoding="utf-8")
        results.append({"file":str(dest),"status":"PRIVATE_RENDERED","sha256":digest})
    return {"source":source.name,"results":results}

def run(max_sources=3,maxclips=3)->dict:
    PRIVATE.mkdir(parents=True,exist_ok=True)
    SUGGESTIONS.mkdir(parents=True,exist_ok=True)
    hits=[];errors=[]
    ffmpeg=shutil.which("ffmpeg")
    if not ffmpeg:raise RuntimeError("ffmpeg not on PATH")
    reports=sorted((p for p in SUGGESTIONS.glob("*.json") if not p.name.endswith(".cuts.json")),key=lambda p:p.name)
    for p in reports[:max_sources]:
        try:hits.append(preview(p,PRIVATE,ffmpeg,maxclips))
        except Exception as e:errors.append({"report":p.name,"error":str(e)[:250]})
    return {"pipeline":"DRIVE_TO_MUTED_PRIVATE_MONTAGE","sources":hits,"errors":errors,
            "published":0,"cost":0,"public_rights_verified":False}

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--max-sources",type=int,default=3,choices=range(1,11))
    ap.add_argument("--max-clips",type=int,default=3,choices=range(1,4))
    arg=ap.parse_args()
    print(json.dumps(run(arg.max_sources,arg.max_clips),ensure_ascii=False))
