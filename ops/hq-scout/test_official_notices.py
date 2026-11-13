import unittest
from datetime import date
from official_notices import parse_board, combine_boards, notice_status, official_link, Rows

URL="https://edeska.brno.cz/eDeska01/eDeskaAktualni.jsp"
TODAY=date(2026,11,13)

def table(title="Výpůjčka nebytových prostor, Lidická 69",
          cat="Pronájmy nebytových prostor",
          ref="MCBS/2026/05836/2026",
          posted="11.11.2026",
          end="27.11.2026",
          link="/eDeska01/data/Zamer_vypujcka.pdf"):
    return ('<table><tr><th>Oblast</th><th>Kategorie</th><th>Název</th></tr>'
            '<tr><td>Úřední deska</td><td>'+cat+'</td><td>'+title+'</td>'
            '<td>'+ref+'</td><td>ÚMČ Brno-střed</td><td>ÚMČ</td>'
            '<td>'+posted+'</td><td>'+end+'</td><td><a href="'+link+'">Zamer.pdf</a></td></tr></table>')

class OfficialNoticeTests(unittest.TestCase):
    def test_free_loan_is_public_signal_not_signed(self):
        rows=parse_board(table(),URL,TODAY)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]["status"],"FREE_USE_INTENT_VERIFY_DOCUMENT_AND_DURATION")
        self.assertFalse(rows[0]["explicit_free_5_year_agreement_verified"])
        self.assertFalse(rows[0]["contact_allowed"])
        self.assertEqual(rows[0]["deadline"],"2026-11-27")
        self.assertEqual(rows[0]["reference"],"MCBS/2026/05836/2026")
    def test_direct_doc_link(self):
        r=parse_board(table(),URL,TODAY)[0]
        self.assertEqual(r["document_url"],"https://edeska.brno.cz/eDeska01/data/Zamer_vypujcka.pdf")
        self.assertEqual(len(r["document_links"]),1)
    def test_market_rental_not_free(self):
        r=parse_board(table(title="Pronájem NP č. 101, Lidická 69"),URL,TODAY)[0]
        self.assertEqual(r["status"],"MARKET_RENT_INTENT_NOT_ZERO_RENT")
    def test_existing_incumbent_extension_blocked(self):
        r=parse_board(table(title="Záměr obce prodloužit dobu trvání nájemního stavu o 12 měsíců"),URL,TODAY)[0]
        self.assertEqual(r["status"],"EXISTING_AGREEMENT_OR_CHANGE_NOT_NEW_HQ")
        self.assertEqual(r["research_score"],0)
    def test_residential_flat_no_hq(self):
        r=parse_board(table(title="Výpůjčka bytu č. 6, Tučkova 32"),URL,TODAY)[0]
        self.assertEqual(r["status"],"RESIDENTIAL_NOT_HQ")
    def test_land_not_building(self):
        r=parse_board(table(title="Pronájem pozemku p.č. 1096"),URL,TODAY)[0]
        self.assertEqual(r["status"],"PLOT_ONLY_NO_SAFE_BUILDING")
    def test_expired_notice_not_current(self):
        r=parse_board(table(end="11.11.2026"),URL,TODAY)[0]
        self.assertEqual(r["status"],"NOTICE_EXPIRED_NO_ACTIVE_OFFER")
    def test_duplicate_reference_between_boards(self):
        a=parse_board(table(),URL,TODAY)
        b=parse_board(table(),URL.replace("eDeska01","eDeska16"),TODAY)
        c=combine_boards(a+b)
        self.assertEqual(len(c),1)
        self.assertEqual(len(c[0]["additional_boards"]),1)
    def test_malicious_links_ignored(self):
        for url in ["https://evil.example/a.pdf","http://edeska.brno.cz/x.pdf","javascript:fetch('/api')",
                    "https://edeska.brno.cz.evil.net/a.pdf","https://user:pw@edeska.brno.cz/x.pdf"]:
            self.assertIsNone(official_link(URL,url))
    def test_no_general_job_offer(self):
        self.assertEqual(parse_board(table(title="Výběrové řízení - IT technik",cat="Výběrová řízení"),URL,TODAY),[])
    def test_generic_city_property_notice_flag(self):
        r=parse_board(table(title="R9/197 – ZVEŘEJNĚNÍ ZÁMĚRŮ",cat="Záměry, prodej a pronájem majetku"),URL,TODAY)[0]
        self.assertEqual(r["status"],"GENERAL_ASSET_NOTICE_DOCUMENT_REVIEW")
        self.assertFalse(r["available_now_verified"])
    def test_invalid_date_does_not_make_false_expiry(self):
        r=parse_board(table(posted="39.17.2026",end="27.11.2026"),URL,TODAY)
        self.assertEqual(len(r),1)
        self.assertIsNone(r[0]["published"])
    def test_no_date_or_reference_not_accepted(self):
        self.assertEqual(parse_board(table(posted="",end="",ref=""),URL,TODAY),[])
    def test_decorative_html_no_unsafe_code(self):
        h=table().replace('<table>','<script><tr><td>hacked</td></tr></script><table>')
        self.assertEqual(len(parse_board(h,URL,TODAY)),1)
    def test_header_only_is_not_offer(self):
        self.assertEqual(parse_board('<table><tr><th>Oblast</th><th>Kategorie</th><th>Název</th><th>Číslo jednací</th></tr></table>',URL,TODAY),[])
    def test_default_open_no_claim_of_confirmed_free_5year(self):
        r=parse_board(table(title="Pronájem nebytového prostoru u školy"),URL,TODAY)[0]
        self.assertFalse(r["explicit_free_5_year_agreement_verified"])
        self.assertFalse(r["owner_verified"])
        self.assertFalse(r["private_crm_checked"])
    def test_multiple_entries_and_maximum(self):
        data=table().replace('</table>','')
        # Use distinct official reference, to preserve per-notice entries.
        data+=table(ref="MCBS/2026/05837/2026").split('<tr><td>')[1].replace('</table>','')
        data+='<table>'
        self.assertGreaterEqual(len(parse_board(table()+table(ref="MCBS/2026/05837/2026"),URL,TODAY)),2)
        self.assertEqual(len(parse_board(table()+table(ref="MCBS/2026/05837/2026"),URL,TODAY,maximum=1)),1)
    def test_offsite_doc_not_linked(self):
        r=parse_board(table(link="https://other.cz/secret.pdf"),URL,TODAY)[0]
        self.assertEqual(r["document_links"],[])
        self.assertEqual(r["document_url"],URL)

if __name__ == "__main__":unittest.main()
