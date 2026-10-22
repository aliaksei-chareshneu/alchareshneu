import csv
import io
import json
from pathlib import Path
import tempfile
import unittest
import youtube_trend_intake as y

VIDEO = {
    "id": "AbCdef12345",
    "snippet": {"title": "Medieval sword and archery"},
    "statistics": {"viewCount": "100000"},
    "status": {"license": "creativeCommon"}
}

class YouTubeIntakeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.csv = Path(self.temp.name) / "trend_candidates.auto.csv"

    def test_untrusted_spreadsheet_title_cannot_execute_formula(self):
        malicious = dict(VIDEO)
        malicious["snippet"] = {"title": '=HYPERLINK("https://example.invalid", "click")\n'}
        row = y.candidates([malicious], "CZ")[0]
        self.assertTrue(row["title_or_topic"].startswith("'=HYPERLINK"))
        self.assertNotIn("\n", row["title_or_topic"])

    def test_rights_always_unknown_even_when_api_says_creative_commons(self):
        row = y.candidates([VIDEO], "CZ", day="2026-10-22")[0]
        self.assertEqual(row["rights_status"], "unknown")
        self.assertEqual(row["status"], "IDEA_NEEDS_ANGLE_AND_RIGHTS")
        self.assertIn("NO video downloaded", row["notes"])
        self.assertEqual(row["lane"], "HEMA_HISTORY")
        self.assertEqual(row["source_reference"], "https://www.youtube.com/watch?v=AbCdef12345")

    def test_preserves_existing_and_deduplicates_chart(self):
        older = {x: "" for x in y.FIELDS}
        older.update({"title_or_topic": "Original Wikipedia trend",
                      "media_type": "film", "source_reference": "https://en.wikipedia.org/wiki/Example"})
        y.write_candidates(self.csv, [older], y.FIELDS)
        fetcher = lambda region, key, limit: [VIDEO]
        r = y.refresh(self.csv, regions=("CZ", "US"), key="TEST_KEY", fetcher=fetcher)
        rows, fields = y.read_candidates(self.csv)
        self.assertEqual(r["found"], 2)
        self.assertEqual(r["unique_youtube"], 1)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["media_type"], "film")
        y.refresh(self.csv, regions=("CZ",), key="TEST_KEY", fetcher=fetcher)
        self.assertEqual(len(y.read_candidates(self.csv)[0]), 2)

    def test_missing_key_never_calls_network_or_touches_file(self):
        forbidden = lambda *a: self.fail("No network call allowed")
        r = y.refresh(self.csv, key="", fetcher=forbidden)
        self.assertEqual(r["status"], "SKIPPED_NO_API_KEY")
        self.assertFalse(self.csv.exists())

    def test_failed_second_region_keeps_original_csv_byte_exact(self):
        y.write_candidates(self.csv, [], y.FIELDS)
        before = self.csv.read_bytes()
        def fetcher(region, key, limit):
            if region == "US":
                raise RuntimeError("offline")
            return [VIDEO]
        with self.assertRaises(RuntimeError):
            y.refresh(self.csv, regions=("CZ", "US"), key="TEST_KEY", fetcher=fetcher)
        self.assertEqual(self.csv.read_bytes(), before)

    def test_rejects_invalid_source_id_and_inconsistent_schema(self):
        self.assertEqual(y.candidates([{"id": "../evil", "snippet": {"title": "x"}}], "CZ"), [])
        self.csv.write_text("bogus,value\n", encoding="utf-8")
        with self.assertRaises(ValueError):
            y.refresh(self.csv, key="TEST_KEY", fetcher=lambda *a: [VIDEO])
        self.assertEqual(self.csv.read_text(), "bogus,value\n")

    def test_explicit_dry_run_does_not_modify_csv(self):
        y.write_candidates(self.csv, [], y.FIELDS)
        before = self.csv.read_bytes()
        r = y.refresh(self.csv, key="TEST_KEY", fetcher=lambda *a: [VIDEO], dry_run=True)
        self.assertFalse(r["written"])
        self.assertEqual(self.csv.read_bytes(), before)

if __name__ == "__main__":
    unittest.main()
