"""Offline integration tests for safeguarded private, no-audio Drive previews."""
from __future__ import annotations
from unittest.mock import patch
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import tempfile
import unittest

import shortfactory_private_montage as montage


class PrivateMontageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="imperion_private_montage_")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.inbox = self.root / "IncomingApproved"
        self.inbox.mkdir()
        self.out = self.root / "private_previews"
        self.out.mkdir()
        self.suggestions = self.root / "edit_suggestions"
        self.suggestions.mkdir()
        self.video = self.inbox / "synthetic_original.mp4"
        cp = subprocess.run(
            [shutil.which("ffmpeg"), "-hide_banner", "-loglevel", "error", "-y",
             "-f", "lavfi", "-i", "testsrc2=size=160x90:rate=7",
             "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=24000",
             "-t", "4", "-c:v", "libx264", "-preset", "ultrafast",
             "-c:a", "aac", "-shortest", str(self.video)],
            capture_output=True, text=True, timeout=40)
        if cp.returncode:
            self.fail("FFmpeg test fixture failed: " + cp.stderr[-500:])
        self.sha = hashlib.sha256(self.video.read_bytes()).hexdigest()
        self.report = self.suggestions / (self.sha[:16] + ".json")
        self.cuts = self.suggestions / (self.sha[:16] + ".cuts.json")
        self.report.write_text(json.dumps({
            "status": "CUT_SUGGESTIONS_ONLY_RIGHTS_UNVERIFIED",
            "source_file_local": str(self.video),
            "source_sha256": self.sha}), encoding="utf-8")
        self.cuts.write_text(json.dumps({
            "rights_status": "unknown",
            "people_consents_checked": False,
            "music_rights_checked": False,
            "clips": [{"start": 0.5, "duration": 3, "title": "TEST PRIVATE ONLY"}]
        }), encoding="utf-8")
        self.patch = patch.object(montage, "INBOX", self.inbox)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def test_render_no_audio_visible_mark_and_repeat_readback(self):
        result = montage.preview(self.report, self.out, shutil.which("ffmpeg"), 1)
        self.assertEqual(result["results"][0]["status"], "PRIVATE_RENDERED")
        clip = Path(result["results"][0]["file"])
        self.assertTrue(clip.is_file())
        sidecar = json.loads(Path(str(clip) + ".json").read_text(encoding="utf-8"))
        self.assertEqual(sidecar["publish_allowed"], False)
        self.assertEqual(sidecar["people_consents"], "NOT_VERIFIED")
        self.assertEqual(sidecar["sha256"], hashlib.sha256(clip.read_bytes()).hexdigest())
        probe = subprocess.run(
            [shutil.which("ffprobe"), "-v", "error", "-show_entries",
             "stream=codec_type,width,height", "-of", "json", str(clip)],
            text=True, capture_output=True, check=True, timeout=10)
        streams = json.loads(probe.stdout)["streams"]
        self.assertTrue(any(s.get("codec_type")=="video" and s.get("width")==1080
                            and s.get("height")==1920 for s in streams))
        self.assertFalse(any(s.get("codec_type")=="audio" for s in streams))
        second = montage.preview(self.report, self.out, shutil.which("ffmpeg"), 1)
        self.assertEqual(second["results"][0]["status"], "EXISTING_VERIFIED")

    def test_changed_input_refused(self):
        self.video.write_bytes(self.video.read_bytes()+b"oops")
        with self.assertRaisesRegex(ValueError, "changed"):
            montage.preview(self.report, self.out, shutil.which("ffmpeg"), 1)

    def test_source_outside_explicit_inbox_refused(self):
        foreign = self.root / "not_allowed.mp4"
        shutil.copyfile(self.video, foreign)
        self.report.write_text(json.dumps({
            "status":"CUT_SUGGESTIONS_ONLY_RIGHTS_UNVERIFIED",
            "source_file_local":str(foreign),
            "source_sha256":self.sha}), encoding="utf-8")
        with self.assertRaises(PermissionError):
            montage.preview(self.report, self.out, shutil.which("ffmpeg"), 1)

    def test_rights_always_unverified(self):
        spec=json.loads(self.cuts.read_text(encoding="utf-8"))
        spec["rights_status"]="owned"
        self.cuts.write_text(json.dumps(spec),encoding="utf-8")
        with self.assertRaises(PermissionError):
            montage.preview(self.report, self.out, shutil.which("ffmpeg"), 1)


if __name__ == "__main__":
    unittest.main()
