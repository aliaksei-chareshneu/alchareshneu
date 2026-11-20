"""Synthetic guardrail tests: no live accounts or network calls."""
import datetime as dt
import unittest

import social_buffer_bridge as s


class BufferBridgeTests(unittest.TestCase):
    def setUp(self):
        self.now = dt.datetime.now(dt.timezone.utc)
        self.when = (self.now + dt.timedelta(days=2)).astimezone(
            s.ZONE).strftime("%Y-%m-%d %H:%M")
        self.mapping = {"facebook_page": {"id": "CH-42",
                                           "entity": "Družina Moravy z.s."}}
        self.base = dict.fromkeys(s.HEADERS, "")
        self.base.update({
            "Duplicate_Checked": "YES",
            "Job_ID": "P-1",
            "Event_ID": "EV-1",
            "Channel": "facebook_page",
            "Scheduled_At": self.when,
            "Status": "BUFFER_APPROVED",
            "Caption": "Verified public announcement",
            "Entity": "Družina Moravy z.s.",
            "Rights_OK": "YES",
            "Approved_At": "2026-10-17 09:00",
            "Visibility": "public",
        })

    def test_current_schema_required(self):
        record = s.normalize_rows([s.HEADERS, list(self.base.values())])
        self.assertEqual(record[0]["_row"], 2)
        with self.assertRaises(ValueError):
            s.normalize_rows([s.HEADERS[:-1], []])

    def test_fully_approved(self):
        self.assertTrue(s.eligible(self.base, self.mapping, self.now))

    def test_refuse_unapproved_or_duplicate(self):
        for field, value in [
            ("Duplicate_Checked", ""),
            ("Rights_OK", ""),
            ("Approved_At", ""),
            ("Status", "SCHEDULED_PENDING"),
            ("Status", "METRICOOL_ERROR"),
            ("Status", "BUFFER_SUBMITTING"),
            ("Status", "DRAFT"),
            ("Post_ID", "already-sent"),
            ("Made_For_Kids", "YES"),
            ("Visibility", "private"),
            ("Entity", "Moravian Host OSVC"),
        ]:
            with self.subTest(field=field, value=value):
                self.assertFalse(s.eligible(
                    dict(self.base, **{field: value}),
                    self.mapping, self.now))

    def test_graphql(self):
        sample = dict(self.base, Media_URL="https://example.com/photo.jpg")
        query = s.graphql_mutation(sample, "CH-42")
        self.assertIn("mode: customScheduled", query)
        self.assertIn("channelId: \"CH-42\"", query)
        self.assertIn("https://example.com/photo.jpg", query)
        self.assertIn("assets:", query)

    def test_past_date_refused(self):
        past = dict(self.base, Scheduled_At="2026-01-01 09:00")
        self.assertFalse(s.eligible(past, self.mapping, self.now))


if __name__ == "__main__":
    unittest.main()
