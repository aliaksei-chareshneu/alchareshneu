from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse
import html, mimetypes, sqlite3, secrets, hmac, re

BASE = Path.home() / "MoravianHost" / "MediaMachine"
DB = BASE / "media_index.sqlite"
HOST = "127.0.0.1"
PORT = 8765
REVIEWABLE = {"READY_FOR_REVIEW", "TRANSFORMED_READY_FOR_REVIEW"}
ALLOWED_RIGHTS = {"owned", "licensed", "public_domain", "transformative_review"}


def review_media_ok(row):
    """Check canonical media facts again at approval; this is NOT a legal rights audit."""
    if not row or row["rights_status"] not in ALLOWED_RIGHTS:
        return False
    if not re.fullmatch(r"[a-fA-F0-9]{64}", str(row["source_sha256"] or "")):
        return False
    if row["rights_status"] == "transformative_review" and not row["transform_path"]:
        return False
    value = row["transform_path"] or row["output_path"]
    if not value:
        return False
    p = Path(value)
    try:
        return (p.suffix.lower() == ".mp4" and p.is_file() and p.stat().st_size > 0
                and p.resolve().is_relative_to(BASE.resolve()))
    except (OSError, ValueError):
        return False
# Localhost-only random form token protects owner review decisions from CSRF.
REVIEW_TOKEN = secrets.token_urlsafe(32)

def conn():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c

def jobs(limit=50):
    c=conn()
    rows=c.execute("""SELECT job_id,rights_status,status,hook,commentary,
        COALESCE(NULLIF(transform_path,''),output_path) AS media_path,
        target_platforms,transcript_path
        FROM short_jobs WHERE status IN ('READY_FOR_REVIEW','TRANSFORMED_READY_FOR_REVIEW')
        ORDER BY created_at LIMIT ?""",(limit,)).fetchall()
    c.close()
    return rows

def page():
    cards=[]
    for r in jobs():
        jid=html.escape(r["job_id"])
        cards.append(f"""
        <article class="card">
          <video controls preload="metadata" src="/media/{jid}"></video>
          <div class="body">
            <div class="top"><b>{jid}</b><span>{html.escape(r["status"])}</span><span>{html.escape(r["rights_status"])}</span></div>
            <h2>{html.escape(r["hook"] or "(no hook)")}</h2>
            <p>{html.escape(r["commentary"] or "(no commentary)")}</p>
            <small>{html.escape(r["target_platforms"] or "")}</small>
            <form method="post" action="/review">
              <input type="hidden" name="job" value="{jid}">
              <input type="hidden" name="review_token" value="{REVIEW_TOKEN}">
              <input name="note" placeholder="review note (optional)">
              <button class="ok" name="action" value="approve">Approve</button>
              <button class="no" name="action" value="reject">Reject</button>
            </form>
          </div>
        </article>""")
    body="\n".join(cards) if cards else '<p class="empty">No jobs waiting for review.</p>'
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>ShortFactory Review</title>
<style>
body{{font-family:Arial,sans-serif;background:#111;color:#eee;margin:0;padding:24px}}
header{{position:sticky;top:0;background:#111;padding:8px 0 16px;z-index:2}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px}}
.card{{background:#1d1d1d;border:1px solid #333;border-radius:14px;overflow:hidden}}
video{{width:100%;aspect-ratio:9/16;max-height:620px;background:#000}}
.body{{padding:14px}} .top{{display:flex;gap:8px;flex-wrap:wrap;font-size:12px;color:#bbb}}
h2{{font-size:18px}} p{{line-height:1.4;color:#ddd}} small{{color:#aaa}}
form{{display:grid;grid-template-columns:1fr auto auto;gap:8px;margin-top:12px}}
input{{padding:10px;border-radius:8px;border:1px solid #555;background:#222;color:#fff}}
button{{padding:10px 14px;border:0;border-radius:8px;font-weight:bold;cursor:pointer}}
.ok{{background:#d8f3dc}} .no{{background:#ffccd5}} .empty{{color:#aaa}}
</style></head><body><header><h1>MediaMachine — Batch Review</h1>
<p>Local only · review does not publish · refresh after decisions.</p></header>
<div class="grid">{body}</div></body></html>"""

class H(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass
    def do_GET(self):
        u=urlparse(self.path)
        if u.path=="/":
            data=page().encode("utf-8")
            self.send_response(200); self.send_header("Content-Type","text/html; charset=utf-8")
            self.send_header("Content-Length",str(len(data))); self.end_headers(); self.wfile.write(data); return
        if u.path.startswith("/media/"):
            jid=u.path.split("/")[-1]
            if not re.fullmatch(r"[A-Za-z0-9_-]{1,60}", jid):
                self.send_error(404); return
            c=conn()
            r=c.execute("""SELECT status,rights_status,source_sha256,output_path,transform_path
                           FROM short_jobs WHERE job_id=?""",(jid,)).fetchone()
            c.close()
            if not r or r["status"] not in REVIEWABLE or not review_media_ok(r):
                self.send_error(404); return
            path=Path(r["transform_path"] or r["output_path"])
            size=path.stat().st_size
            start,end=0,size-1
            rng=self.headers.get("Range")
            if rng:
                m=re.fullmatch(r"bytes=(\d*)-(\d*)",rng)
                if not m or not any(m.groups()):
                    self.send_error(416,"Invalid byte range"); return
                a,b=m.groups()
                if not a:
                    suffix=int(b)
                    if suffix<=0:
                        self.send_error(416,"Invalid byte range"); return
                    start=max(0,size-suffix)
                else:
                    start=int(a)
                    if b:end=min(int(b),size-1)
                if start>=size or end<start:
                    self.send_error(416,"Unsatisfiable byte range"); return
                self.send_response(206)
                self.send_header("Content-Range",f"bytes {start}-{end}/{size}")
            else:
                self.send_response(200)
            self.send_header("Content-Type","video/mp4")
            self.send_header("Accept-Ranges","bytes")
            self.send_header("Content-Length",str(end-start+1))
            self.end_headers()
            with path.open("rb") as f:
                f.seek(start); remaining=end-start+1
                while remaining>0:
                    chunk=f.read(min(1024*512,remaining))
                    if not chunk: break
                    self.wfile.write(chunk); remaining-=len(chunk)
            return
        self.send_error(404)
    def do_POST(self):
        if self.path!="/review":
            self.send_error(404); return
        origin=self.headers.get("Origin", "")
        if origin and origin not in {"http://127.0.0.1:8765", "http://localhost:8765"}:
            self.send_error(403, "Cross-origin review forbidden"); return
        try:
            n=int(self.headers.get("Content-Length","0"))
        except (TypeError, ValueError):
            self.send_error(400, "Invalid review body length"); return
        if n <= 0 or n > 4096:
            self.send_error(413, "Invalid review body"); return
        try:
            q=parse_qs(self.rfile.read(n).decode("utf-8"))
        except UnicodeDecodeError:
            self.send_error(400, "Invalid UTF-8 review form"); return
        token=(q.get("review_token") or [""])[0]
        if not hmac.compare_digest(token, REVIEW_TOKEN):
            self.send_error(403, "Owner review token missing"); return
        jid=(q.get("job") or [""])[0]
        action=(q.get("action") or [""])[0]
        note=(q.get("note") or [""])[0][:500]
        if action not in {"approve","reject"} or not re.fullmatch(r"[A-Za-z0-9_-]{1,60}", jid):
            self.send_error(400, "Invalid review transition"); return
        c=conn()
        c.execute("BEGIN IMMEDIATE")
        row=c.execute("""SELECT status,rights_status,source_sha256,output_path,transform_path
                         FROM short_jobs WHERE job_id=?""",(jid,)).fetchone()
        if not row or row["status"] not in REVIEWABLE:
            c.rollback(); c.close(); self.send_error(409,"Review status has changed"); return
        if action=="approve" and not review_media_ok(row):
            c.rollback(); c.close(); self.send_error(409,"Canonical media rights or file check failed"); return
        state="APPROVED_FOR_PUBLISH_QUEUE" if action=="approve" else "REJECTED_REVIEW"
        result=c.execute("""UPDATE short_jobs SET status=?,review_note=?,reviewed_at=datetime('now'),
                     updated_at=datetime('now') WHERE job_id=? AND status=?""",
                     (state,note,jid,row["status"]))
        if result.rowcount!=1:
            c.rollback(); c.close(); self.send_error(409,"Concurrent review conflict"); return
        c.commit(); c.close()
        self.send_response(303); self.send_header("Location","/"); self.end_headers()

if __name__=="__main__":
    print(f"ShortFactory review: http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST,PORT),H).serve_forever()
