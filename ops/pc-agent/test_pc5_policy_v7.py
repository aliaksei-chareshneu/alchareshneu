"""M7 continuity and recovery QA, synthetic receipts only, no GUI or OS actions."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from browser_bridge_adapter import dispatch
import pc5_policy_v7 as p

AID = "IMP-PC5-M7-CI-20261115"


class PolicyTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.root=Path(self.tmp.name)/"audits"
    def tearDown(self):
        self.tmp.cleanup()
    def request(self,payload,**opts):
        return p.operate(payload,platform="win32",root=self.root,**opts)
    def create_valid_receipt(self, **override):
        self.root.mkdir()
        summary={"ram_total_mb":16384,"ram_available_mb":850,
                 "cpu_load_pct":10,"chrome_process_count":7,"chrome_working_set_mb":700,
                 "startup_count":18,"scheduled_task_count":51,
                 "suspicious_candidate_count":1,
                 "defender":{"status":"AVAILABLE","realtime":False,"detections_count":0},
                 "disks":[{"drive":"C:","free_gb":7.6}]}
        summary.update(override)
        doc={"case_id":"IMP-PC5-MAINT-20261110","audit_id":AID,"summary":summary}
        blob=(json.dumps(doc)+"\n").encode("utf-8")
        filename="audit-pc-"+AID+".json"
        (self.root/filename).write_bytes(blob)
        (self.root/(AID+".receipt.json")).write_text(
            json.dumps({"sha256":hashlib.sha256(blob).hexdigest(),"file":filename,"status":"DONE"}),
            encoding="utf-8")
    def test_status_good_ram(self):
        r=self.request({"mode":"continuity_status"},memory_reader=lambda:(5120,16384))
        self.assertEqual(r["status"],"DONE")
        self.assertTrue(r["gui_memory_ready"])
        self.assertTrue(r["local_4b_memory_ready"])
        self.assertFalse(r["worker_restarted"])
        self.assertFalse(r["can_restart_worker"])
    def test_status_low_ram_still_reports(self):
        r=self.request({"mode":"continuity_status"},memory_reader=lambda:(120,16384))
        self.assertEqual(r["status"],"DONE")
        self.assertFalse(r["gui_memory_ready"])
        self.assertFalse(r["local_4b_memory_ready"])
    def test_bad_ram_denied(self):
        for val in ((True,8192),(-2,9000),(10000,9000),("free",9000)):
            with self.subTest(ram=val):
                self.assertEqual(self.request({"mode":"continuity_status"},
                                 memory_reader=lambda:val)["status"],"BLOCKED")
    def test_wrong_os_denied(self):
        self.assertEqual(p.operate({"mode":"continuity_status"},platform="linux")["reason"],"WINDOWS_REQUIRED")
    def test_remote_fake_approval_denied(self):
        self.assertEqual(self.request({"mode":"maintenance_plan","audit_id":AID,"go":True})["reason"],"FIELDS_NOT_ALLOWED")
    def test_unknown_audit_never_scans(self):
        r=self.request({"mode":"maintenance_plan","audit_id":AID})
        self.assertEqual(r["reason"],"AUDIT_NOT_VERIFIED")
        self.assertFalse(self.root.exists())
    def test_invalid_audit_id_denied(self):
        self.assertEqual(self.request({"mode":"maintenance_plan","audit_id":"../../etc/passwd"})["reason"],"INVALID_AUDIT_ID")
    def test_existing_audit_priority_and_no_changes(self):
        self.create_valid_receipt()
        r=self.request({"mode":"maintenance_plan","audit_id":AID})
        self.assertEqual(r["status"],"REVIEW_REQUIRED")
        self.assertEqual(r["changes_applied"],0)
        self.assertFalse(r["auto_remediation"])
        codes=[x["code"] for x in r["recommendations"]]
        self.assertIn("DEFENDER_REVIEW",codes)
        self.assertIn("MEMORY_PRESSURE",codes)
        self.assertIn("LOW_DISK_FREE",codes)
        self.assertIn("STARTUP_REVIEW",codes)
        self.assertIn("UNVERIFIED_CANDIDATES",codes)
        self.assertEqual(r["recommendations"][0]["priority"],"P0")
        self.assertTrue(all(x["auto_action_allowed"] is False for x in r["recommendations"]))
    def test_tampered_evidence_denied(self):
        self.create_valid_receipt()
        (self.root/("audit-pc-"+AID+".json")).write_bytes(b"corrupt")
        r=self.request({"mode":"maintenance_plan","audit_id":AID})
        self.assertEqual(r["reason"],"AUDIT_READBACK_FAILED")
    def test_all_clear(self):
        self.create_valid_receipt(ram_available_mb=4096,startup_count=7,
            suspicious_candidate_count=0,disks=[{"drive":"C:","free_gb":40}],
            defender={"status":"AVAILABLE","realtime":True,"detections_count":0})
        r=self.request({"mode":"maintenance_plan","audit_id":AID})
        self.assertEqual(r["status"],"DONE")
        self.assertEqual(r["recommendations"],[])
    def test_adapter_continuity_denies_shell(self):
        r=dispatch("pc_operator",{"mode":"runtime_probe","command":"whoami"})
        self.assertEqual(r["result"]["reason"],"FIELDS_NOT_ALLOWED")
    def test_adapter_static_generation(self):
        r=dispatch("pc_operator",{"mode":"runtime_probe"})
        self.assertEqual(r["result"]["generation"],"M7-20261115")


if __name__=="__main__":
    unittest.main()
