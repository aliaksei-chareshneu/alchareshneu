"""Synthetic-only regression checks for ShortFactory provider evidence accounting."""
import csv
import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("distribution_bridge", ROOT / "distribution_bridge.py")
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class TestEvidenceAccounting(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.db = self.base / "synthetic.sqlite"
        self.video = self.base / "safe_example.mp4"
        self.video.write_bytes(b"synthetic-test-only")
        db_patch = mock.patch.object(bridge, "DB", self.db)
        root_patch = mock.patch.object(bridge, "ROOT", self.base)
        db_patch.start()
        root_patch.start()
        self.addCleanup(db_patch.stop)
        self.addCleanup(root_patch.stop)
        with sqlite3.connect(self.db) as c:
            c.execute("""CREATE TABLE short_jobs(
                job_id TEXT PRIMARY KEY, status TEXT, target_platforms TEXT,
                output_path TEXT, transform_path TEXT, topic TEXT, lane TEXT, angle TEXT,
                rights_status TEXT, transcript_path TEXT, hook TEXT, commentary TEXT,
                reviewed_at TEXT, created_at TEXT, updated_at TEXT
            )""")
            c.execute("""INSERT INTO short_jobs
                (job_id,status,target_platforms,output_path,transform_path,topic,lane,angle,
                 rights_status,transcript_path,hook,commentary,reviewed_at,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                ("SYN-ONE", "APPROVED_FOR_PUBLISH_QUEUE", "youtube_shorts,instagram_reels",
                 str(self.video), "", "Synthetic demo", "SAFE", "Synthetic", "owned",
                 "", "Example", "Original synthetic clip", "", "", ""))
        bridge.conn().close()

    def receipt(self, platform="youtube_shorts", post_id="ABC123",
                url="https://www.youtube.com/watch?v=ABC123"):
        return SimpleNamespace(job="SYN-ONE", platform=platform,
                               post_id=post_id, url=url, published_at=None)

    def posts(self):
        with sqlite3.connect(self.db) as c:
            c.row_factory = sqlite3.Row
            return [dict(r) for r in c.execute("SELECT * FROM short_posts ORDER BY platform")]

    def job_state(self):
        with sqlite3.connect(self.db) as c:
            return c.execute("SELECT status FROM short_jobs WHERE job_id='SYN-ONE'").fetchone()[0]

    def test_recorded_provider_ids_are_not_verified_live(self):
        bridge.record_post(self.receipt())
        self.assertEqual(self.posts()[0]["status"], "EVIDENCE_RECORDED_UNVERIFIED")
        self.assertEqual(self.job_state(), "RECEIPT_RECORDED_PARTIAL")
        manifest = self.base / "synthetic_manifest.json"
        bridge.manifest(SimpleNamespace(output=manifest))
        obj = json.loads(manifest.read_text(encoding="utf-8"))
        self.assertEqual(len(obj["items"]), 1)
        self.assertEqual(obj["items"][0]["platform"], "instagram_reels")
        bridge.record_post(self.receipt(platform="instagram_reels",
                           post_id="IG100",url="https://www.instagram.com/reel/IG100/"))
        self.assertEqual(self.job_state(), "RECEIPT_RECORDED_ALL_TARGETS")
        bridge.manifest(SimpleNamespace(output=manifest))
        self.assertEqual(json.loads(manifest.read_text(encoding="utf-8"))["items"], [])

    def test_duplicate_and_conflicting_receipts_fail_closed(self):
        bridge.record_post(self.receipt())
        bridge.record_post(self.receipt())  # same receipt is idempotent
        self.assertEqual(len(self.posts()), 1)
        with self.assertRaisesRegex(ValueError, "Conflicting provider receipt"):
            bridge.record_post(self.receipt(post_id="DIFFERENT"))
        self.assertEqual(self.posts()[0]["post_id"], "ABC123")

    def test_bad_url_and_not_reviewed_job_blocked(self):
        for bad in ["http://www.youtube.com/watch?v=ABC123",
                    "https://evil.example/ABC123", "javascript:alert(1)"]:
            with self.assertRaisesRegex(ValueError, "HTTPS provider URL"):
                bridge.record_post(self.receipt(url=bad))
        self.assertEqual(self.posts(), [])
        with sqlite3.connect(self.db) as c:
            c.execute("UPDATE short_jobs SET status='READY_FOR_REVIEW' WHERE job_id='SYN-ONE'")
        with self.assertRaisesRegex(ValueError, "not approved"):
            bridge.record_post(self.receipt())
        self.assertEqual(self.posts(), [])

    def test_unverified_metrics_cannot_train_trend_feedback(self):
        bridge.record_post(self.receipt())
        bridge.record_metrics(SimpleNamespace(
            job="SYN-ONE", platform="youtube_shorts", window=24,
            views=1000, avg_watch=80, completion=40, follows=2, clicks=1))
        out = self.base / "feedback.csv"
        bridge.feedback(SimpleNamespace(output=out))
        with out.open(encoding="utf-8-sig", newline="") as f:
            self.assertEqual(len(list(csv.DictReader(f))), 0)
        index = json.loads((self.base / "feedback_index.json").read_text(encoding="utf-8"))
        self.assertEqual(index["topic_multipliers"], {})
        self.assertEqual(index["lane_multipliers"], {})


if __name__ == "__main__":
    unittest.main()
