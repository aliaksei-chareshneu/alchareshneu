import copy
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

import owned_video_shorts as o

BASE = {"slug": "owned-test-cut", "rights_status": "owned", "rights_basis": "Recorded and controlled by organizer",
        "people_consents_checked": True, "music_rights_checked": True,
        "contains_minors": False, "clips": [
            {"start": 0.0, "duration": 2.0, "title": "Original owned recording",
             "caption": "Original clip and a concrete explanation", "cta": "Ask about a training",
             "subtitles": [{"start": 0.0, "end": 1.5, "text": "Naše originální video"}]},
        ]}


class OwnedVideoShortsTests(unittest.TestCase):
    def test_rights_and_minors_fail_closed(self):
        for key, val in (("rights_status", "unknown"), ("rights_status", "transformative_review"),
                         ("people_consents_checked", False), ("music_rights_checked", False),
                         ("contains_minors", "no")):
            value = copy.deepcopy(BASE)
            value[key] = val
            with self.subTest(key=key, value=val), self.assertRaises(ValueError):
                o.validate(value, 5)
        minors = copy.deepcopy(BASE)
        minors["contains_minors"] = True
        with self.assertRaises(ValueError):
            o.validate(minors, 5)
        minors["guardian_consents_checked"] = True
        self.assertEqual(len(o.validate(minors, 5)), 1)

    def test_injected_and_unbounded_timecodes_rejected(self):
        for value in ("0; rm -rf /", -1, True, float("nan"), 4):
            spec = copy.deepcopy(BASE)
            spec["clips"][0]["start"] = value
            with self.subTest(value=str(value)), self.assertRaises(ValueError):
                o.validate(spec, 5)
        for duration in (float("inf"), 0, 61):
            spec = copy.deepcopy(BASE)
            spec["clips"][0]["duration"] = duration
            with self.subTest(duration=duration), self.assertRaises(ValueError):
                o.validate(spec, 5)
        spec = copy.deepcopy(BASE)
        spec["clips"] *= 6
        with self.assertRaises(ValueError):
            o.validate(spec, 5)

    def test_srt_is_local_timestamped_text(self):
        result = o.subtitle_file(BASE["clips"][0]["subtitles"])
        self.assertIn("00:00:00,000 --> 00:00:01,500", result)
        self.assertIn("Naše originální video", result)

    def test_real_draft_and_immutable_manifest(self):
        if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
            self.skipTest("ffmpeg not installed")
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "original.mp4"
            subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi",
                            "-i", "color=c=blue:s=320x180:r=10", "-t", "3", "-pix_fmt", "yuv420p", str(source)],
                           check=True, timeout=35)
            preview = o.execute(BASE, source, root / "outputs")
            self.assertEqual(preview["status"], "PREVIEW_ONLY")
            self.assertFalse((root / "outputs").exists())
            manifest = o.execute(BASE, source, root / "outputs", render=True)
            self.assertEqual(manifest["status"], "DRAFT_NEEDS_EDITORIAL_REVIEW")
            self.assertFalse(manifest["published"])
            movie = Path(manifest["clips"][0]["file"])
            self.assertTrue(movie.is_file())
            self.assertEqual(movie.suffix, ".mp4")
            self.assertEqual(len(o.sha256(movie)), 64)
            self.assertEqual(round(o.duration_seconds(movie, o.tool("ffprobe"))), 2)
            streams = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0",
                                               "-show_entries", "stream=width,height", "-of", "json", str(movie)], text=True)
            self.assertEqual([(v["width"], v["height"]) for v in json.loads(streams)["streams"]], [(1080, 1920)])
            self.assertTrue(movie.with_suffix(".srt").exists())
            self.assertFalse(json.loads(movie.with_suffix(".json").read_text())["approved"])
            with self.assertRaises(FileExistsError):
                o.execute(BASE, source, root / "outputs", render=True)


if __name__ == "__main__":
    unittest.main()
