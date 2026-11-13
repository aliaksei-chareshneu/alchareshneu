import unittest
from city_assets import archive_link, city_public_property_pages, extract_property_strings, inspect_city_unused_archive, partition_location_hints

class CityAssetsTest(unittest.TestCase):
    def test_city_item_page_not_a_signed_agreement(self):
        rows=city_public_property_pages([{"source":"BRNO_ASSETS",
            "url":"https://www.brno.cz/w/nebytovy-prostor-byvala-restaurace-muzejka",
            "title":"nebytový prostor – bývalá restaurace muzejka"}])
        self.assertEqual(len(rows),1)
        self.assertFalse(rows[0]["free_five_year_title_verified"])
        self.assertFalse(rows[0]["contact_allowed"])
    def test_short_rent_excluded(self):
        r=city_public_property_pages([{"source":"BRNO_ASSETS",
            "url":"https://www.brno.cz/w/kratkodoba-nabidka-prostor",
            "title":"krátkodobé pronájmy prostor"}])[0]
        self.assertEqual(r["status"],"SHORT_TERM_NOT_LONGTERM")
    def test_general_homepage_never_object(self):
        self.assertEqual(city_public_property_pages([{"source":"BRNO_ASSETS",
          "url":"https://www.brno.cz/nabidka-majetku","title":"nabídka majetku"}]),[])
    def test_archive_link_from_first_party_only(self):
        raw='<h1>Official</h1><a href="/documents/20121/123/MMB-2026-0069.zip/id">MMB-2026-0069.zip</a>'
        self.assertEqual(archive_link(raw,"https://www.brno.cz/w/material-cezoi-10463"),
          "https://www.brno.cz/documents/20121/123/MMB-2026-0069.zip/id")
        self.assertIsNone(archive_link('<a href="https://evil.example/MMB-2026-0069.zip">ZIP</a>',
                                        "https://www.brno.cz/w/material-cezoi-10463"))
    def test_no_unverified_2026_claim(self):
        class Denied:
            def fetch(self,url):
                return None,"ROBOTS_DENIED_OR_UNVERIFIED"
        r=inspect_city_unused_archive(Denied())
        self.assertFalse(r["availability_verified"])
        self.assertFalse(r["free_5_year_use_verified"])
        self.assertIn("BLOCKED",r["status"])
    def test_address_only_never_private_full_pdf_line(self):
        value=extract_property_strings("Dukelská třída 157/44, osobní poznámka soukromá informace")
        self.assertNotIn("osobní",str(value))
        self.assertLessEqual(len(value),1)

    def test_split_streets_vs_cadastral_locality_numbers(self):
        hints=["Francouzská 36","Rumiště 3","Kraví hora - objekt 30",
               "VEVEŘÍ 739/1","STARÉ BRNO 967","SADOVÁ 19/7"]
        r=partition_location_hints(hints)
        self.assertEqual(r["street_or_object_hints_count"],3)
        self.assertEqual(r["possible_cadastral_plot_hints_count"],3)
        self.assertIn("Kraví hora - objekt 30",r["street_or_object_hints"])
        self.assertNotIn("STARÉ BRNO 967",r["street_or_object_hints"])


    def test_ocr_official_cover_letter_is_not_a_city_property(self):
        text="\n".join([
            "která byla doručena Magistrátu města Brna dne 9. února",
            "byla přípisem Majetkového odboru MMB ze dne 16. února",
            "Malinovského náměstí 3, 601 67 Brno",
            "Karlova 63",
            "Francouzská 36",
        ])
        a=extract_property_strings(text)
        self.assertEqual(a,["Karlova 63","Francouzská 36"])
        self.assertFalse(any("dne" in x.lower() for x in a))
    def test_single_municipal_office_header_excluded(self):
        self.assertEqual(extract_property_strings("Malinovského náměstí 3"),[])

if __name__=="__main__":
    unittest.main()
