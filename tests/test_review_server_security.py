import sqlite3
from pathlib import Path
import tempfile
from threading import Thread
import unittest
from unittest import mock
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import review_server as review


class LocalReviewSecurityTests(unittest.TestCase):
    def test_get_and_forbidden_external_post_never_approve(self):
        ids = [x["job_id"] for x in review.jobs()]
        if not ids:
            self.skipTest("No eligible review jobs in existing local database")
        first = ids[0]
        with sqlite3.connect(review.DB) as db:
            before = db.execute("select status from short_jobs where job_id=?", (first,)).fetchone()[0]
        server = review.ThreadingHTTPServer((review.HOST, 0), review.H)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base = "http://127.0.0.1:" + str(server.server_port)
            with urlopen(base + "/", timeout=5) as resp:
                page = resp.read().decode("utf-8")
                self.assertEqual(resp.status, 200)
                self.assertIn(first, page)
                self.assertIn("review_token", page)
            for headers, fields in (
                ({"Content-Type": "application/x-www-form-urlencoded"},
                 "job=" + first + "&action=approve"),
                ({"Content-Type": "application/x-www-form-urlencoded", "Origin": "https://attacker.invalid"},
                 "job=" + first + "&action=approve&review_token=" + review.REVIEW_TOKEN),
            ):
                req = Request(base + "/review", data=fields.encode("utf-8"),
                              headers=headers, method="POST")
                with self.assertRaises(HTTPError) as cm:
                    urlopen(req, timeout=5)
                self.assertEqual(cm.exception.code, 403)
            with sqlite3.connect(review.DB) as db:
                after = db.execute("select status from short_jobs where job_id=?", (first,)).fetchone()[0]
            self.assertEqual(before, after)
            self.assertEqual(after, "READY_FOR_REVIEW")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)


class IsolatedReviewAcceptanceTests(unittest.TestCase):
    """All approve/reject tests use synthetic SQLite; never mutate real ShortFactory."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.db = self.base / "synthetic.sqlite"
        self.media = self.base / "owned.mp4"
        self.media.write_bytes(b"abcdefghijklmnopqrst")
        with sqlite3.connect(self.db) as c:
            c.execute("""CREATE TABLE short_jobs(
                job_id TEXT PRIMARY KEY, rights_status TEXT, status TEXT, hook TEXT,
                commentary TEXT, source_sha256 TEXT, output_path TEXT,
                transform_path TEXT, target_platforms TEXT, transcript_path TEXT,
                review_note TEXT, reviewed_at TEXT, updated_at TEXT, created_at TEXT
            )""")
            for jid,rights in (("SYN_OK","owned"),("SYN_BAD","unknown")):
                c.execute("""INSERT INTO short_jobs
                    (job_id,rights_status,status,hook,commentary,source_sha256,
                     output_path,transform_path,target_platforms,created_at)
                     VALUES (?,?,?,?,?,?,?,?,?,?)""",
                    (jid,rights,"READY_FOR_REVIEW","Synthetic local test","No real footage",
                     "a"*64,str(self.media),"","youtube_shorts","2026-11-05T00:00:00"))
        self.p1=mock.patch.object(review,"DB",self.db)
        self.p2=mock.patch.object(review,"BASE",self.base)
        self.p1.start()
        self.p2.start()
        self.addCleanup(self.p1.stop)
        self.addCleanup(self.p2.stop)
        self.server=review.ThreadingHTTPServer((review.HOST,0),review.H)
        self.thread=Thread(target=self.server.serve_forever,daemon=True)
        self.thread.start()
        self.baseurl="http://127.0.0.1:"+str(self.server.server_port)
        self.addCleanup(lambda: self.thread.join(timeout=5))
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)

    def post(self,jid,action="approve"):
        form=urlencode({"job":jid,"action":action,"review_token":review.REVIEW_TOKEN})
        req=Request(self.baseurl+"/review",data=form.encode("utf-8"),
                    headers={"Content-Type":"application/x-www-form-urlencoded"},
                    method="POST")
        return urlopen(req,timeout=5)

    def state(self,jid):
        with sqlite3.connect(self.db) as c:
            return c.execute("SELECT status FROM short_jobs WHERE job_id=?",(jid,)).fetchone()[0]

    def test_owner_approval_checks_actual_rights_and_one_time_transition(self):
        with self.assertRaises(HTTPError) as cm:
            self.post("SYN_BAD")
        self.assertEqual(cm.exception.code,409)
        self.assertEqual(self.state("SYN_BAD"),"READY_FOR_REVIEW")
        with self.post("SYN_OK") as response:
            self.assertEqual(response.status,200) # follows 303 to the private review list
        self.assertEqual(self.state("SYN_OK"),"APPROVED_FOR_PUBLISH_QUEUE")
        with self.assertRaises(HTTPError) as cm:
            self.post("SYN_OK")
        self.assertEqual(cm.exception.code,409)
        self.assertEqual(self.state("SYN_OK"),"APPROVED_FOR_PUBLISH_QUEUE")

    def test_byte_ranges_reject_bad_input_and_do_not_serve_ineligible_media(self):
        with urlopen(Request(self.baseurl+"/media/SYN_OK",
                             headers={"Range":"bytes=2-5"}),timeout=5) as response:
            self.assertEqual(response.status,206)
            self.assertEqual(response.read(),b"cdef")
        for bad in ("bytes=abc","bytes=999-1001","bytes=5-3","bytes=-0"):
            with self.subTest(range=bad),self.assertRaises(HTTPError) as cm:
                urlopen(Request(self.baseurl+"/media/SYN_OK",
                                headers={"Range":bad}),timeout=5)
            self.assertEqual(cm.exception.code,416)
        with self.assertRaises(HTTPError) as cm:
            urlopen(self.baseurl+"/media/SYN_BAD",timeout=5)
        self.assertEqual(cm.exception.code,404)

    def test_file_outside_working_media_root_cannot_be_approved(self):
        outside=Path(self.tmp.name).parent / "imperion-fake-external-file.mp4"
        # Do not create any external file; forged path must be denied.
        with sqlite3.connect(self.db) as c:
            c.execute("UPDATE short_jobs SET output_path=? WHERE job_id=?",
                      (str(outside),"SYN_OK"))
        with self.assertRaises(HTTPError) as cm:
            self.post("SYN_OK")
        self.assertEqual(cm.exception.code,409)
        self.assertEqual(self.state("SYN_OK"),"READY_FOR_REVIEW")


if __name__ == "__main__":
    unittest.main()
