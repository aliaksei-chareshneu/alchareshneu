import csv
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from private_reconcile import addresses, load_crm_exports, reconcile, main

def item(title):
    return {"notice_id":"BRNO-ED-TEST","title":title,"document_url":"https://edeska.brno.cz/eDeska01/candidate"}

class ReconcileTests(unittest.TestCase):
    def test_address_requires_full_number(self):
        self.assertEqual(addresses("Brno-střed"),set())
        self.assertIn("klobasova 9",addresses("Klobásova 9, Brno"))
        self.assertIn("hady 968/2",addresses("Hády 968/2, Brno"))
    def test_exact_duplicate_not_generic_city(self):
        crm=[{"source_tab":"HQ","row":4,"case_id":"003","address_keys":{"klobasova 9"},"dnc":False,"already_contacted":True}]
        same=reconcile([item("Výpůjčka místnosti Klobásova 9")],crm)[0]
        other=reconcile([item("Výpůjčka místnosti Údolní 7, Brno")],crm)[0]
        self.assertEqual(same["private_match_status"],"ALREADY_CONTACTED_REVIEW_THREAD")
        self.assertEqual(other["private_match_status"],"NO_EXACT_ADDRESS_MATCH_NOT_PROVEN_NEW")
    def test_dnc_blocks(self):
        crm=[{"source_tab":"HQ","row":3,"case_id":"002","address_keys":{"hybesova 76"},"dnc":True,"already_contacted":True}]
        m=reconcile([item("Budova Hybešova 76")],crm)[0]
        self.assertEqual(m["private_match_status"],"DNC_EXISTING_NO_CONTACT")
        self.assertFalse(m["contact_allowed"])
    def test_no_address_not_proof_new(self):
        r=reconcile([item("Městské nebytové prostory v Brně")],[])[0]
        self.assertEqual(r["private_match_status"],"NO_EXACT_ADDRESS_MATCH_NOT_PROVEN_NEW")
        self.assertFalse(r["qualified_free_5year_offer"])
    def test_live_schema_roundtrip_avoids_personal_emails(self):
        with TemporaryDirectory() as tmp:
            f=Path(tmp)/"HQ_SPECIAL_LEADS.csv"
            with f.open("w",encoding="utf-8",newline="") as fh:
                writer=csv.DictWriter(fh,fieldnames=["ID","Budova / část areálu","DNC / právní překážky","Dosavadní komunikace","Kontaktní bod (ověření)"])
                writer.writeheader()
                writer.writerow({"ID":"002","Budova / část areálu":"Hybešova 76",
                                 "DNC / právní překážky":"HARD CLOSED DNC","Dosavadní komunikace":"SENT 12 Oct",
                                 "Kontaktní bod (ověření)":"private.contact@example.invalid"})
            rows=load_crm_exports([str(f)])
            self.assertTrue(rows[0]["dnc"])
            output=reconcile([item("Hybešova 76")],rows)
            self.assertNotIn("private.contact",json.dumps(output))
            self.assertEqual(output[0]["existing_match_refs"][0]["case_id"],"002")
    def test_no_public_ci_execution(self):
        with patch.dict(os.environ,{"GITHUB_ACTIONS":"true"}):
            with self.assertRaises(SystemExit):
                main(["--scan","x","--crm","y","--out","z"])
    def test_no_permission_to_contact(self):
        for x in reconcile([item("Lidická 69"),item("nebytový prostor")],[]):
            self.assertFalse(x["contact_allowed"])

if __name__=="__main__":
    unittest.main()
