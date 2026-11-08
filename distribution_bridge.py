from pathlib import Path
from urllib.parse import urlparse
import argparse, csv, datetime, json, math, sqlite3

BASE = Path.home() / "MoravianHost" / "MediaMachine"
DB = BASE / "media_index.sqlite"
ROOT = BASE / "ShortFactory"
DEFAULT_MANIFEST = ROOT / "publish_manifest.json"
DEFAULT_FEEDBACK = ROOT / "feedback_ranked.csv"

def now():
    return datetime.datetime.now().astimezone().isoformat()

def conn():
    c=sqlite3.connect(DB)
    c.row_factory=sqlite3.Row
    c.execute("""CREATE TABLE IF NOT EXISTS short_posts(
        job_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        post_id TEXT,
        post_url TEXT,
        published_at TEXT,
        status TEXT NOT NULL DEFAULT 'EVIDENCE_RECORDED_UNVERIFIED',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(job_id,platform)
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS short_metrics(
        job_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        window_hours INTEGER NOT NULL,
        views INTEGER DEFAULT 0,
        avg_watch_pct REAL DEFAULT 0,
        completion_pct REAL DEFAULT 0,
        follows INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        captured_at TEXT NOT NULL,
        PRIMARY KEY(job_id,platform,window_hours)
    )""")
    c.commit()
    return c

def targets(s):
    return [x.strip() for x in (s or "").split(",") if x.strip()]

def media_path(r):
    return (r["transform_path"] or r["output_path"] or "").strip()

def caption(r):
    parts=[(r["hook"] or "").strip(), (r["commentary"] or "").strip()]
    return "\n\n".join(x for x in parts if x)

def manifest(args):
    c=conn()
    rows=c.execute("""SELECT * FROM short_jobs
                      WHERE status IN ('APPROVED_FOR_PUBLISH_QUEUE','PUBLISHED_PARTIAL','RECEIPT_RECORDED_PARTIAL')
                      ORDER BY reviewed_at,created_at""").fetchall()
    out=[]
    for r in rows:
        file=media_path(r)
        if not file or not Path(file).exists():
            continue
        posted={x["platform"] for x in c.execute("SELECT platform FROM short_posts WHERE job_id=?",(r["job_id"],))}
        for platform in targets(r["target_platforms"]):
            if platform in posted:
                continue
            out.append({
                "job_id": r["job_id"],
                "platform": platform,
                "approved": True,
                "file_path": file,
                "caption": caption(r),
                "topic": r["topic"] or "",
                "lane": r["lane"] or "",
                "angle": r["angle"] or "",
                "rights_status": r["rights_status"],
                "transcript_path": r["transcript_path"] or "",
                "evidence_required": ["post_id","post_url","published_at"],
                "status": "WAITING_EXTERNAL_PUBLISHER"
            })
    c.close()
    path=Path(args.output)
    path.write_text(json.dumps({
        "generated_at":now(),
        "public_action_gate":"Only items already approved in ShortFactory are included. External publisher must return evidence.",
        "items":out
    },ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"manifest_items={len(out)} output={path}")
    for x in out[:30]:
        print(f'{x["job_id"]}\t{x["platform"]}\t{x["topic"] or x["caption"][:60]}')

def record_post(args):
    # This CLI records supplied provider evidence; it does NOT independently
    # read back the live platform. Treat all imported receipts as UNVERIFIED.
    hosts = {
        "youtube_shorts": {"youtube.com", "www.youtube.com", "youtu.be"},
        "instagram_reels": {"instagram.com", "www.instagram.com"},
        "facebook_reels": {"facebook.com", "www.facebook.com", "fb.watch"},
        "tiktok": {"tiktok.com", "www.tiktok.com", "vm.tiktok.com"},
    }
    parsed = urlparse(args.url)
    if args.platform not in hosts or parsed.scheme != "https" or parsed.hostname not in hosts[args.platform]:
        raise ValueError("Platform-specific HTTPS provider URL required")
    if parsed.username or parsed.password or not args.post_id or len(str(args.post_id)) > 200:
        raise ValueError("Invalid provider receipt identifier")
    c=conn()
    r=c.execute("SELECT * FROM short_jobs WHERE job_id=?",(args.job,)).fetchone()
    if not r:
        raise ValueError("Unknown job")
    if r["status"] not in ("APPROVED_FOR_PUBLISH_QUEUE","PUBLISHED_PARTIAL","PUBLISHED_ALL_TARGETS",
                             "RECEIPT_RECORDED_PARTIAL","RECEIPT_RECORDED_ALL_TARGETS"):
        raise ValueError(f"Job is not approved for publishing: {r['status']}")
    if args.platform not in targets(r["target_platforms"]):
        raise ValueError("Platform is not a target for this job")
    prior=c.execute("SELECT post_id,post_url FROM short_posts WHERE job_id=? AND platform=?",
                    (args.job,args.platform)).fetchone()
    if prior:
        if prior["post_id"]==args.post_id and prior["post_url"]==args.url:
            c.close()
            print(f"{args.job}\t{args.platform}\tALREADY_RECORDED_UNVERIFIED")
            return
        c.close()
        raise ValueError("Conflicting provider receipt; independent reconciliation required")
    ts=args.published_at or now()
    cur=now()
    c.execute("""INSERT INTO short_posts(job_id,platform,post_id,post_url,published_at,status,created_at,updated_at)
                 VALUES(?,?,?,?,?,'EVIDENCE_RECORDED_UNVERIFIED',?,?)""",
              (args.job,args.platform,args.post_id,args.url,ts,cur,cur))
    posted={x["platform"] for x in c.execute("SELECT platform FROM short_posts WHERE job_id=?",(args.job,))}
    need=set(targets(r["target_platforms"]))
    state="RECEIPT_RECORDED_ALL_TARGETS" if need and need.issubset(posted) else "RECEIPT_RECORDED_PARTIAL"
    c.execute("UPDATE short_jobs SET status=?,updated_at=? WHERE job_id=?",(state,cur,args.job))
    c.commit(); c.close()
    print(f"{args.job}\t{args.platform}\tRECEIPT_RECORDED_UNVERIFIED\t{state}")

def record_metrics(args):
    c=conn()
    post=c.execute("SELECT 1 FROM short_posts WHERE job_id=? AND platform=?",(args.job,args.platform)).fetchone()
    if not post:
        raise ValueError("Record post evidence first")
    ts=now()
    c.execute("""INSERT INTO short_metrics(job_id,platform,window_hours,views,avg_watch_pct,completion_pct,follows,clicks,captured_at)
                 VALUES(?,?,?,?,?,?,?,?,?)
                 ON CONFLICT(job_id,platform,window_hours) DO UPDATE SET
                 views=excluded.views,avg_watch_pct=excluded.avg_watch_pct,
                 completion_pct=excluded.completion_pct,follows=excluded.follows,
                 clicks=excluded.clicks,captured_at=excluded.captured_at""",
              (args.job,args.platform,args.window,args.views,args.avg_watch,args.completion,args.follows,args.clicks,ts))
    c.commit(); c.close()
    print(f"{args.job}\t{args.platform}\t{args.window}h\tMETRICS_RECORDED")

def quality_score(r):
    views=max(0,int(r["views"] or 0))
    watch=max(0.0,min(100.0,float(r["avg_watch_pct"] or 0)))
    complete=max(0.0,min(100.0,float(r["completion_pct"] or 0)))
    follows=max(0,int(r["follows"] or 0))
    clicks=max(0,int(r["clicks"] or 0))
    conversion=min(100.0,1000.0*(follows+clicks)/max(views,1))
    reach=min(100.0,20.0*math.log10(views+1))
    return round(0.35*watch+0.30*complete+0.20*conversion+0.15*reach,2)

def feedback(args):
    c=conn()
    rows=c.execute("""SELECT j.job_id,j.topic,j.lane,j.angle,j.hook,m.platform,m.window_hours,
                             m.views,m.avg_watch_pct,m.completion_pct,m.follows,m.clicks,m.captured_at
                      FROM short_metrics m JOIN short_jobs j ON j.job_id=m.job_id
                      JOIN short_posts p ON p.job_id=m.job_id AND p.platform=m.platform
                      WHERE p.status='PROVIDER_INDEPENDENTLY_VERIFIED'
                      ORDER BY j.job_id,m.platform,m.window_hours""").fetchall()
    data=[]
    for r in rows:
        d=dict(r); d["quality_score"]=quality_score(r)
        d["score_multiplier"]=round(0.5 + min(1.0,d["quality_score"]/100.0),3)
        data.append(d)
    data.sort(key=lambda x:(-int(x["window_hours"]),-float(x["quality_score"]),-int(x["views"])))
    fields=["job_id","topic","lane","angle","hook","platform","window_hours","views",
            "avg_watch_pct","completion_pct","follows","clicks","quality_score","score_multiplier","captured_at"]
    path=Path(args.output)
    with path.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(data)

    def avg_map(key):
        buckets={}
        for x in data:
            k=(x.get(key) or "").strip()
            if not k:
                continue
            buckets.setdefault(k,[]).append(float(x["score_multiplier"]))
        return {k:round(sum(v)/len(v),3) for k,v in buckets.items() if v}

    index={
        "generated_at": now(),
        "topic_multipliers": avg_map("topic"),
        "lane_multipliers": avg_map("lane"),
        "rule": "trend score uses exact topic multiplier first, otherwise lane multiplier, otherwise 1.0"
    }
    index_path=ROOT/"feedback_index.json"
    index_path.write_text(json.dumps(index,ensure_ascii=False,indent=2),encoding="utf-8")
    c.close()
    print(f"feedback_rows={len(data)} output={path} index={index_path}")
    for x in data[:20]:
        print(f'{x["quality_score"]:6.2f}\t{x["window_hours"]:3}h\t{x["platform"]:<18}\t{x["topic"] or x["job_id"]}')

def status(_args):
    c=conn()
    posts=c.execute("SELECT * FROM short_posts ORDER BY published_at DESC").fetchall()
    metrics=c.execute("SELECT * FROM short_metrics ORDER BY captured_at DESC").fetchall()
    c.close()
    print(f"posts={len(posts)} metrics={len(metrics)}")
    for r in posts[:30]:
        print(f'{r["job_id"]}\t{r["platform"]}\t{r["post_url"]}')

def main():
    ap=argparse.ArgumentParser(description="ShortFactory distribution/evidence bridge. Does not publish externally.")
    sub=ap.add_subparsers(dest="cmd",required=True)
    p=sub.add_parser("manifest"); p.add_argument("--output",default=str(DEFAULT_MANIFEST)); p.set_defaults(func=manifest)
    p=sub.add_parser("record-post")
    p.add_argument("--job",required=True); p.add_argument("--platform",required=True)
    p.add_argument("--post-id",required=True); p.add_argument("--url",required=True); p.add_argument("--published-at")
    p.set_defaults(func=record_post)
    p=sub.add_parser("record-metrics")
    p.add_argument("--job",required=True); p.add_argument("--platform",required=True)
    p.add_argument("--window",type=int,choices=[24,72],required=True)
    p.add_argument("--views",type=int,default=0); p.add_argument("--avg-watch",type=float,default=0)
    p.add_argument("--completion",type=float,default=0); p.add_argument("--follows",type=int,default=0); p.add_argument("--clicks",type=int,default=0)
    p.set_defaults(func=record_metrics)
    p=sub.add_parser("feedback"); p.add_argument("--output",default=str(DEFAULT_FEEDBACK)); p.set_defaults(func=feedback)
    sub.add_parser("status").set_defaults(func=status)
    args=ap.parse_args(); args.func(args)

if __name__=="__main__":
    main()
