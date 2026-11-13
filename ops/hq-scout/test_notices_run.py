import json
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from notices_run import combined_scan, save_report

OFFICIAL="https://edeska.brno.cz/eDeska01/eDeskaAktualni.jsp"
GENERAL="https://www.brno.cz/nabidka-majetku"

FIXTURE='''<html><table>
<tr><th>Oblast</th><th>Kategorie</th><th>Název</th><th>Číslo jednací</th></tr>
<tr><td>úřední deska</td><td>Pronájmy nebytových prostor</td>
<td>Výpůjčka nebytového prostoru, Veselá 14</td>
<td>MCBS/2026/05836/2026</td><td>ÚMČ Brno</td><td></td>
<td>12.11.2026</td><td>27.11.2026</td>
<td><a href="/eDeska01/notice.pdf">Zamer</a></td></tr>
</table></html>'''

class FakeFetcher:
    def __init__(self,boards=True):
        self.boards=boards
    def fetch(self,url):
        if "edeska.brno.cz" in url:
            if self.boards:
                return FIXTURE,"HTTP_OK"
            return None,"ROBOTS_DENIED_OR_UNVERIFIED"
        return "<h1>Brno offers</h1><p>Public source, no property evidence</p>","HTTP_OK"

CFG={"sources":[{"id":"BRNO","url":GENERAL,"max_pages":1,"follow_links":False}]}
BDS={"boards":[{"id":"STRED","url":OFFICIAL}]}

class PublicNoticeIntegration(unittest.TestCase):
    def test_verified_table_not_a_verified_property(self):
        p=combined_scan(CFG,BDS,fetcher=FakeFetcher(),delay=0,today=date(2026,11,13))
        self.assertEqual(p["municipal_boards_read"],1)
        self.assertEqual(p["municipal_rows_seen"],1)
        self.assertEqual(p["public_notices_count"],1)
        self.assertEqual(p["fully_qualified_0kc_5y_property_offers"],0)
        self.assertFalse(p["private_crm_verified"])
        self.assertFalse(p["public_notices"][0]["contact_allowed"])
    def test_robots_denial_fails_board_proof(self):
        p=combined_scan(CFG,BDS,fetcher=FakeFetcher(boards=False),delay=0,today=date(2026,11,13))
        self.assertEqual(p["municipal_rows_seen"],0)
        self.assertEqual(p["status"],"GENERAL_ONLY_NO_MUNICIPAL_NOTICE_READBACK")
    def test_artifact_contains_individual_records(self):
        p=combined_scan(CFG,BDS,fetcher=FakeFetcher(),delay=0,today=date(2026,11,13))
        with TemporaryDirectory() as d:
            save_report(p,Path(d))
            self.assertTrue((Path(d)/"notices.csv").exists())
            stored=json.loads((Path(d)/"scan.json").read_text(encoding="utf-8"))
            self.assertEqual(stored["public_notices_count"],1)
            body=(Path(d)/"review.md").read_text(encoding="utf-8")
            self.assertIn("Veselá 14",body)
            self.assertIn("No private CRM",body)
    def test_same_notice_is_single_record_across_boards(self):
        p=combined_scan(CFG,{"boards":BDS["boards"]*2},fetcher=FakeFetcher(),delay=0,today=date(2026,11,13))
        self.assertEqual(p["public_notices_count"],1)
    def test_no_effects_and_no_paid_model(self):
        p=combined_scan(CFG,BDS,fetcher=FakeFetcher(),delay=0,today=date(2026,11,13))
        self.assertEqual(p["effects"],{"emails":0,"contracts":0,"payments":0,"crm_writes":0,"model_billing":0})
    def test_never_fabricate_5year(self):
        p=combined_scan(CFG,BDS,fetcher=FakeFetcher(),delay=0,today=date(2026,11,13))
        self.assertNotIn("APPROVED",p["public_notices"][0]["status"])
        self.assertIs(p["public_notices"][0]["explicit_free_5_year_agreement_verified"],False)

if __name__=="__main__":
    unittest.main()
