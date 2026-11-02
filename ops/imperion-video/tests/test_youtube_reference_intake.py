"""Research-only YouTube link intake test: no media acquisition or publishing."""
import csv
import json
import tempfile
import unittest
from pathlib import Path

import youtube_reference_intake as ref


class YouTubeReferenceTests(unittest.TestCase):
    def test_accepts_single_video_link_and_shorts(self):
        self.assertEqual(ref.video_id("https://www.youtube.com/watch?v=abcXYZ123_-"),
                         "abcXYZ123_-")
        self.assertEqual(ref.video_id("https://youtu.be/abcXYZ123_-"),"abcXYZ123_-")
        self.assertEqual(ref.video_id("https://www.youtube.com/shorts/abcXYZ123_-"),"abcXYZ123_-")

    def test_rejects_non_video_urls_and_untrusted_domains(self):
        for url in ("http://youtube.com/watch?v=abcXYZ123_-",
                    "https://evil-youtube.com/watch?v=abcXYZ123_-",
                    "https://youtube.com/playlist?list=PL123",
                    "https://youtube.com/watch?v=bad"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                ref.video_id(url)

    def test_csv_creates_only_unlicensed_reference_and_is_idempotent(self):
        with tempfile.TemporaryDirectory(prefix="ytref_") as root:
            data=Path(root)/"sources.csv"
            out=Path(root)/"out"
            fields=("youtube_url","creator","title","rights_status","content_policy","research_angle")
            with data.open("w",encoding="utf-8",newline="") as h:
                writer=csv.DictWriter(h,fieldnames=fields)
                writer.writeheader()
                writer.writerow({
                    "youtube_url":"https://youtu.be/abcXYZ123_-",
                    "creator":"Test creator","title":"Research video",
                    "rights_status":"UNKNOWN","content_policy":"REFERENCE_ONLY_NO_DOWNLOAD",
                    "research_angle":"Independent critique and local club workshop"})
            result=ref.run(data,out)
            self.assertEqual(result["new"],1)
            self.assertEqual(result["downloaded"],0)
            self.assertEqual(result["published"],0)
            items=list(out.glob("*.json"))
            self.assertEqual(len(items),1)
            j=json.loads(items[0].read_text(encoding="utf-8"))
            self.assertFalse(j["may_use_video_or_audio"])
            self.assertEqual(j["commercial_derivative_rights"],"UNVERIFIED")
            again=ref.run(data,out)
            self.assertEqual(again["new"],0)
            self.assertEqual(again["existing"],1)


if __name__=="__main__":
    unittest.main()
