"""Canonical ShortFactory trend -> draft idea integration; no publishing or orders."""
import csv
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from shortfactory_idea_worker import candidate, read_trends, run


class TrendIdeaIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.trends = self.root / "trend_candidates.auto.csv"
        self.ideas = self.root / "ideas"

    def write_trends(self, rows):
        fields = ["title_or_topic", "source_reference", "lane", "rights_status", "status"]
        with self.trends.open("w", encoding="utf-8", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=fields)
            writer.writeheader()
            writer.writerows(rows)

    def test_canonical_scored_trend_csv_is_actually_read(self):
        self.write_trends([{
            "title_or_topic": "Practical Python for research labs",
            "source_reference": "https://example.org/research",
            "lane": "SCIENCE_EXPERT", "rights_status": "unknown",
            "status": "IDEA_NEEDS_ANGLE_AND_RIGHTS",
        }])
        rows = read_trends(self.trends)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["lane"], "SCIENCE_EXPERT")
        self.assertEqual(rows[0]["source_url"], "https://example.org/research")
        self.assertEqual(
            rows[0]["cta_intent_review_only"],
            "QUALIFY_OSVC_PAID_EXPERT_OR_TRAINING_INQUIRY",
        )

    def test_canonical_video_title_update_does_not_duplicate_source(self):
        self.write_trends([
            {"title_or_topic": "Medieval sword technique explained",
             "source_reference": "https://www.youtube.com/watch?v=AbCdef12345",
             "lane": "HEMA_HISTORY"},
            {"title_or_topic": "A revised medieval sword technique title",
             "source_reference": "https://www.youtube.com/watch?v=AbCdef12345",
             "lane": "HEMA_HISTORY"},
        ])
        rows = read_trends(self.trends)
        self.assertEqual(len(rows), 1)
        self.assertIn("INTEREST_ONLY_NO_UNVERIFIED_PAID_EVENT",
                      rows[0]["cta_intent_review_only"])

    def test_output_is_unverified_and_does_not_approve_or_publish(self):
        self.write_trends([{
            "title_or_topic": "How to assess scientific code quality",
            "source_reference": "https://example.org/technical-guide",
            "lane": "SCIENCE_EXPERT",
        }])
        before = self.trends.read_bytes()
        status = run(self.trends, self.ideas, False, "unused")
        self.assertEqual(status["new_ideas"], 1)
        self.assertEqual(status["status"], "IDEAS_ONLY_NEVER_PUBLISHED")
        self.assertEqual(self.trends.read_bytes(), before)
        ideas = list(self.ideas.glob("*.json"))
        self.assertEqual(len(ideas), 1)
        obj = json.loads(ideas[0].read_text(encoding="utf-8"))
        self.assertFalse(obj["rights_verified"])
        self.assertFalse(obj["fact_checked"])
        self.assertFalse(obj["approved_for_render"])
        self.assertFalse(obj["approved_for_publication"])
        self.assertEqual(run(self.trends, self.ideas, False, "unused")["new_ideas"], 0)

    def test_legacy_feed_still_supported_and_untrusted_url_rejected(self):
        self.assertIsNone(candidate({"title": "Roman training illustrated",
                                     "source_url": "file:///private/clip.mp4"}))
        idea = candidate({"title": "Roman training illustrated",
                          "source_url": "https://example.org/rome"})
        self.assertEqual(idea["lane"], "UNCLASSIFIED")
        self.assertIn("UNVERIFIED", idea["status"])


if __name__ == "__main__":
    unittest.main()
