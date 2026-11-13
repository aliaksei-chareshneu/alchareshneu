import json
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from notices_run import combined_scan, save_report

GENERAL = "https://www.brno.cz/nabidka-majetku"
FEED = "https://edeska.brno.cz/eDeska/opendata"

class FakeFetcher:
    def fetch(self,url):
        return "<h1>Brno</h1><p>Veřejná nabídka</p>","HTTP_OK"
    def fetch_json(self,url):
        doc = {"typ":"Úřední deska","informace":[{
            "iri":"https://edeska.brno.cz/zaznamy/101",
            "url":"https://edeska.brno.cz/eDeska/uredniDeska.jsp?item=101",
            "název":{"cs":"Záměr výpůjčky nebytových prostor, Křenová 25"},
            "vyvěšení":{"datum":"2026-11-12"},
            "relevantní_do":{"datum":"2026-11-29"}
        }]}
        return json.dumps(doc,ensure_ascii=False),"HTTP_JSON_OK"

class FeedIntegrationTests(unittest.TestCase):
    def test_pipeline_json_feed_with_no_board_html(self):
        p=combined_scan({"sources":[{"id":"B","url":GENERAL,"max_pages":1,"follow_links":False}]},
            {"boards":[]},max_total=3,fetcher=FakeFetcher(),delay=0,today=date(2026,11,13),
            feeds_config={"feeds":[{"id":"BRNO_OFN","url":FEED}]})
        self.assertEqual(p["public_json_notices_count"],1)
        self.assertEqual(p["official_open_data"]["total_feed_items"],1)
        self.assertEqual(p["fully_qualified_0kc_5y_property_offers"],0)
        self.assertFalse(p["private_crm_verified"])
        self.assertFalse(p["official_open_data"]["candidate_notices"][0]["contact_allowed"])
    def test_feed_artifacts_public_only(self):
        p=combined_scan({"sources":[{"id":"B","url":GENERAL,"max_pages":1,"follow_links":False}]},
            {"boards":[]},max_total=3,fetcher=FakeFetcher(),delay=0,today=date(2026,11,13),
            feeds_config={"feeds":[{"id":"BRNO_OFN","url":FEED}]})
        with TemporaryDirectory() as tmp:
            path=Path(tmp)
            save_report(p,path)
            self.assertTrue((path/"official_feed_notices.csv").is_file())
            blob=json.loads((path/"official_open_data.json").read_text(encoding="utf-8"))
            self.assertEqual(blob["candidate_count"],1)
            self.assertIn("Křenová", (path/"review.md").read_text(encoding="utf-8"))
            self.assertEqual(p["effects"],{"emails":0,"contracts":0,"payments":0,"crm_writes":0,"model_billing":0})

if __name__=="__main__":
    unittest.main()
