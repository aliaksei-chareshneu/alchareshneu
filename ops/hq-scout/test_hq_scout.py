import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from hq_scout import (
    allowed, canon, signals, classification, rank, html_info, same_host_links,
    analyze, run, save, match_existing, TERM_REGEX, RestrictedRedirect
)

class FakeFetcher:
    def __init__(self):
        self.calls = []
    def fetch(self, url):
        self.calls.append(url)
        if url.endswith("/availability"):
            return "<h1>Budova Example 80 m2</h1><p>Bezúplatná výpůjčka na dobu 10 let.</p>", "HTTP_OK"
        return '<html><h1>Nabídka majetku</h1><a href="/availability">Pronájem budovy</a></html>', "HTTP_OK"

class HQScoutTests(unittest.TestCase):
    def test_host_security(self):
        self.assertTrue(allowed("https://www.brno.cz/nabidka-majetku"))
        self.assertFalse(allowed("https://brno.cz.evil.org/"))
        self.assertFalse(allowed("http://www.brno.cz/"))
        self.assertFalse(allowed("https://127.0.0.1/private"))
        self.assertFalse(allowed("https://user:pass@brno.cz/"))
        self.assertFalse(allowed("https://www.brno.cz:notaport/"))
    def test_tracking_removed(self):
        self.assertEqual(canon("https://www.brno.cz/a/?utm_source=sp&foo=1#top"),"https://www.brno.cz/a?foo=1")
    def test_free_and_term_signals(self):
        flags = signals("Bezúplatná výpůjčka budovy o velikosti 100 m² na 10 let")
        self.assertTrue(flags["explicit_free_use"])
        self.assertTrue(flags["explicit_5plus_years"])
        self.assertTrue(flags["venue_words"])
    def test_year_date_is_not_term(self):
        self.assertFalse(signals("Oznámení: 2026 pronájem skladu")["explicit_5plus_years"])
    def test_market_rent_not_free(self):
        f = signals("Pronájem nebytového prostoru 80 m² za 14000 Kč měsíčně")
        self.assertEqual(classification(f, []), "RENTAL_NOT_ZERO_RENT")
    def test_no_promise_from_document_level(self):
        r = analyze("TEST", "https://www.brno.cz/a",
                    "<h1>Budova</h1> Bezúplatná výpůjčka na 10 let", [], False)
        self.assertFalse(r["verified_available"])
        self.assertFalse(r["legal_free_5plus_term_verified"])
        self.assertEqual(r["status"],"DOCUMENT_LEVEL_FREE_USE_SIGNAL_VERIFY_INDIVIDUAL_OBJECT")
    def test_existing_dnc_priority(self):
        known = [{"name":"Libušino údolí 152a","status":"HARD CLOSED / DNC"}]
        r = analyze("TEST","https://www.brno.cz/a",
                    "<h1>Libušino údolí 152a</h1> Bezúplatná výpůjčka budovy 10 let",known,False)
        self.assertEqual(r["status"],"EXISTING_DNC_DO_NOT_CONTACT")
    def test_existing_watch(self):
        known = [{"name":"Klobásova 9","status":"WATCH"}]
        self.assertEqual(classification(signals("budova"),known),"EXISTING_LEAD_CHECK_THREAD")
    def test_link_follow_bounded(self):
        html = '<a href="/availability">pronájem budovy</a><a href="https://evil.org/">pronájem</a><a href="/docs/file.pdf/id">Výpůjčka</a>'
        _,_,links = html_info(html)
        self.assertEqual(same_host_links("https://www.brno.cz/root",links,4),["https://www.brno.cz/availability"])
    def test_government_loan_index_not_confirmed_offer(self):
        r = analyze("GOV_LOAN","https://www.nabidkamajetku.gov.cz/Home/Tenders?ListType=Loan",
                    "<h1>Výpůjčka</h1> Pronájem nebytové budovy",[],False)
        self.assertEqual(r["status"],"LOAN_CATEGORY_INDEX_VERIFY_INDIVIDUAL_OFFER")
        self.assertEqual(r["score_research_only"],0)
        self.assertFalse(r["verified_available"])

    def test_redirect_outside_denied(self):
        request = __import__("urllib.request",fromlist=["Request"]).Request("https://www.brno.cz/a")
        self.assertIsNone(RestrictedRedirect().redirect_request(request,None,302,"Moved",{}, "https://evil.org/a"))
    def test_scan_two_pages_no_side_effects(self):
        f=FakeFetcher()
        p=run({"sources":[{"id":"TEST","url":"https://www.brno.cz/","max_pages":2,"follow_links":True}]},
              [],max_total=2,fetcher=f,delay=0)
        self.assertEqual(p["pages_ok"],2)
        self.assertEqual(len(f.calls),2)
        self.assertEqual(p["effects"]["emails"],0)
        self.assertEqual(p["effects"]["crm_writes"],0)
        self.assertEqual(p["effects"]["model_billing"],0)
    def test_source_fail_closed(self):
        class Deny:
            def fetch(self,url): return None,"ROBOTS_DENIED_OR_UNVERIFIED"
        p=run({"sources":[{"id":"X","url":"https://www.brno.cz/","max_pages":1}]},
              [],max_total=2,fetcher=Deny(),delay=0)
        self.assertEqual(p["pages_ok"],0)
        self.assertEqual(len(p["errors"]),1)
    def test_output_no_secrets_or_claims(self):
        p=run({"sources":[{"id":"TEST","url":"https://www.brno.cz/availability","max_pages":1}]},
              [],max_total=1,fetcher=FakeFetcher(),delay=0)
        with TemporaryDirectory() as d:
            save(p,Path(d))
            r=json.loads((Path(d)/"scan.json").read_text())
            self.assertFalse(r["results"][0]["verified_available"])
            self.assertIn("source", (Path(d)/"screening.csv").read_text(encoding="utf-8-sig"))
            self.assertNotIn("BANK_VERIFIED", (Path(d)/"review.md").read_text())
    def test_score_bounded(self):
        self.assertGreaterEqual(rank(signals("budova"),[]),0)
        self.assertLessEqual(rank(signals("výpůjčka budovy bezúplatná 10 let"),[]),100)

if __name__=="__main__":
    unittest.main()
