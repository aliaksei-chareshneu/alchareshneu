"""Strict E09 technical-review gate: synthetic fixtures only, no private video in CI."""
import copy
import hashlib
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from e09_shortfactory_review_bridge import inspect, sha256

class E09BridgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.video = Path(self.temp.name) / "test.mp4"
        self.video.write_bytes(b"synthetic-ci-fixture")
        self.project = {
            "mode": "PRIVATE_DEMO_ONLY", "rights_status": "PUBLIC_RELEASE_BLOCKED",
            "media_controller": "DRUZINA_MORAVY_ZS",
            "published": False, "owner_accepted": False,
            "shots": [{"duration": 4.0}] * 5,
            "sources": {"demo": {
                "rights": "NOT_VERIFIED_PUBLIC_RELEASE", "consent": "NOT_VERIFIED",
                "sha256": "a" * 64}},
        }
        self.receipt = {
            "published": False, "owner_accepted": False,
            "sha256": sha256(self.video), "source_shas": {"demo": "a" * 64}}
        self.probe = {
            "streams": [
                {"codec_type": "video", "codec_name": "h264",
                 "width": 1080, "height": 1920, "r_frame_rate": "30/1"},
                {"codec_type": "audio", "codec_name": "aac"}],
            "format": {"duration": "20.0"}}
    def test_synthetic_valid_receipt_never_publishes(self):
        result = inspect(self.project, self.receipt, self.video, probe=self.probe)
        self.assertEqual(result["stage"], "TECHNICAL_REVIEW_ONLY")
        self.assertFalse(result["publish_allowed"])
        self.assertFalse(result["crm_write_performed"])
    def test_source_rights_upgraded_denied(self):
        bad = copy.deepcopy(self.project)
        bad["rights_status"] = "owned"
        with self.assertRaises(ValueError):
            inspect(bad, self.receipt, self.video, probe=self.probe)
    def test_acceptance_and_send_claims_denied(self):
        for label in ("owner_accepted", "published"):
            bad = copy.deepcopy(self.project)
            bad[label] = True
            with self.subTest(label=label), self.assertRaises(ValueError):
                inspect(bad, self.receipt, self.video, probe=self.probe)
    def test_modified_movie_denied(self):
        self.video.write_bytes(b"changed")
        with self.assertRaises(ValueError):
            inspect(self.project, self.receipt, self.video, probe=self.probe)
    def test_wrong_mobile_geometry_denied(self):
        wrong = copy.deepcopy(self.probe)
        wrong["streams"][0]["width"] = 720
        with self.assertRaises(ValueError):
            inspect(self.project, self.receipt, self.video, probe=wrong)
    def test_wrong_entity_denied(self):
        bad = copy.deepcopy(self.project)
        bad["media_controller"] = "UNKNOWN"
        with self.assertRaises(ValueError):
            inspect(bad, self.receipt, self.video, probe=self.probe)

if __name__ == "__main__":
    unittest.main()
