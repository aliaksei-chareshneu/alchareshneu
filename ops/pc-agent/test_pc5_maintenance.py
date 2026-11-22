"""Agent5 M6 safe audit tests: synthetic runner only, no Windows or device I/O."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pc5_maintenance as maintenance
from browser_bridge_adapter import dispatch


AUDIT_ID = "IMP-PC5-M6-CI-20261115"


def synthetic_document(ident=AUDIT_ID):
    return {
        "case_id": "IMP-PC5-MAINT-20261110",
        "audit_id": ident,
        "summary": {
            "ram_total_mb": 16384, "ram_available_mb": 3072,
            "cpu_load_pct": 12, "chrome_process_count": 5,
            "chrome_working_set_mb": 1024, "startup_count": 9,
            "scheduled_task_count": 48, "suspicious_candidate_count": 0,
            "defender": {"status": "AVAILABLE", "realtime": True, "detections_count": 0},
            "disks": [{"drive": "C:", "free_gb": 24.3}],
        },
    }


class MaintenanceSafety(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "private"
        self.script = Path(maintenance.__file__).resolve().with_name("pc5_audit.ps1")
        self.audit_calls = 0

    def tearDown(self):
        self.temp.cleanup()

    def fake_runner(self, argv, **kwargs):
        self.audit_calls += 1
        self.assertEqual(argv[0:3], ["powershell.exe", "-NoProfile", "-NonInteractive"])
        self.assertNotIn("shell", kwargs)
        self.assertEqual(argv[-1], AUDIT_ID)
        content = (json.dumps(synthetic_document())+"\n").encode("utf-8")
        self.root.mkdir(parents=True, exist_ok=True)
        outfile = self.root / ("audit-pc-" + AUDIT_ID + ".json")
        outfile.write_bytes(content)
        envelope = {"status": "LOCAL_AUDIT_SAVED",
                    "file_name": outfile.name,
                    "sha256": hashlib.sha256(content).hexdigest()}
        return SimpleNamespace(returncode=0, stdout=json.dumps(envelope))

    def call(self, payload, *, runner=None, free=3072):
        return maintenance.operate(
            payload, platform="win32", root=self.root, script=self.script,
            runner=self.fake_runner if runner is None else runner,
            memory_reader=lambda:(free,16384))

    def test_preview_is_nonmutating(self):
        report = self.call({"mode":"remediate_pc","dry_run":True,
            "action_ids":["startup.discord","startup.teams"]})
        self.assertEqual(report["status"],"DRY_RUN_ONLY")
        self.assertEqual(report["changes_applied"],0)
        self.assertEqual(report["reboots"],0)
        self.assertFalse(self.root.exists())

    def test_non_dry_run_and_fake_go_denied(self):
        self.assertEqual(self.call({"mode":"remediate_pc","dry_run":False,
            "action_ids":["startup.discord"]})["status"],"BLOCKED")
        self.assertEqual(self.call({"mode":"remediate_pc","dry_run":True,
            "action_ids":["startup.discord"],"go":True})["reason"],"FIELDS_NOT_ALLOWED")

    def test_arbitrary_names_and_duplicates_denied(self):
        for actions in (["start.not_on_list"],["startup.discord","startup.discord"],["shell"],[42]):
            with self.subTest(actions=actions):
                self.assertEqual(self.call({"mode":"remediate_pc","dry_run":True,
                    "action_ids":actions})["status"],"BLOCKED")

    def test_import_private_file_path_denied(self):
        report=self.call({"mode":"audit_pc","audit_id":AUDIT_ID,
                          "path":"C:/Users/other"})
        self.assertEqual(report["reason"],"FIELDS_NOT_ALLOWED")

    def test_windows_required(self):
        report=maintenance.operate({"mode":"audit_pc","audit_id":AUDIT_ID},platform="linux")
        self.assertEqual(report["reason"],"WINDOWS_REQUIRED")

    def test_low_ram_denied_before_subprocess(self):
        runner=Mock()
        report=self.call({"mode":"audit_pc","audit_id":AUDIT_ID},runner=runner,free=800)
        self.assertEqual(report["reason"],"AUDIT_LOW_MEMORY_NO_EXECUTION")
        runner.assert_not_called()

    def test_audit_readback_and_idempotent_replay(self):
        request={"mode":"audit_pc","audit_id":AUDIT_ID}
        first=self.call(request)
        self.assertEqual(first["status"],"DONE")
        self.assertFalse(first["replay"])
        self.assertEqual(self.audit_calls,1)
        self.assertTrue(first["owner_go_required_for_changes"])
        self.assertTrue(first["no_public_process_paths"])
        self.assertEqual(first["summary"]["defender_realtime"],True)
        self.assertNotIn("processes",first["summary"])
        second=self.call(request,runner=Mock(),free=0)
        self.assertEqual(second["status"],"DONE")
        self.assertTrue(second["replay"])
        self.assertEqual(self.audit_calls,1)

    def test_evidence_tamper_denied(self):
        self.assertEqual(self.call({"mode":"audit_pc","audit_id":AUDIT_ID})["status"],"DONE")
        path=self.root/("audit-pc-"+AUDIT_ID+".json")
        path.write_bytes(b'{"tampered":true}')
        self.assertEqual(self.call({"mode":"audit_pc","audit_id":AUDIT_ID})["reason"],
                         "REPLAY_EVIDENCE_MISMATCH")

    def test_bad_defender_and_disk_types_fail_closed(self):
        bad=synthetic_document()
        bad["summary"]["defender"]["status"]="PRIVATE_CREDENTIALS"
        with self.assertRaises(ValueError):
            maintenance.safe_summary(bad)
        bad=synthetic_document()
        bad["summary"]["disks"]=[{"drive":"C:/private","free_gb":20}]
        with self.assertRaises(ValueError):
            maintenance.safe_summary(bad)

    def test_adapter_new_route_preview(self):
        report=dispatch("pc_operator",{"mode":"remediate_pc","dry_run":True,
             "action_ids":["startup.discord"]})
        self.assertEqual(report["result"]["status"],"DRY_RUN_ONLY")

    def test_adapter_rejects_privilege_escalation(self):
        report=dispatch("pc_operator",{"mode":"remediate_pc","dry_run":False,
             "action_ids":["startup.discord"],"approved":True})
        self.assertEqual(report["result"]["status"],"BLOCKED")


if __name__=="__main__":
    unittest.main()
