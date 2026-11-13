import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline import captions_after_edit, cut_candidates, keep_from_removals, merge_intervals, parse_transcript, srt_time, write_srt, validate_broll


class TestVideoPipeline(unittest.TestCase):
    def test_merge_and_keep(self):
        self.assertEqual(merge_intervals([(1, 2), (1.9, 3), (4, 5)], 10), [(1, 3), (4, 5)])
        self.assertEqual(keep_from_removals([(1, 3), (4, 5)], 6), [(0., 1), (3, 4), (5, 6)])

    def test_caption_mapping_split(self):
        cues = [{"start": 0.5, "end": 2.5, "text": "hello"}]
        out = captions_after_edit(cues, [(0, 1), (2, 3)])
        self.assertEqual(out, [{"start": .5, "end": 1., "text": "hello"}, {"start": 1., "end": 1.5, "text": "hello"}])

    def test_disfluency_candidates(self):
        cues = [{"start": 0, "end": .2, "text": "Ну"}, {"start": .3, "end": .6, "text": "Привет"}, {"start": .6, "end": 1., "text": "Привет"}]
        self.assertEqual([x["kind"] for x in cut_candidates(cues)], ["filler", "duplicate"])

    def test_srt_roundtrip(self):
        with tempfile.TemporaryDirectory() as td:
            target = Path(td) / "1.srt"
            cues = [{"start": 0.123, "end": 1.234, "text": "Здравствуйте, мир!"}]
            write_srt(cues, target)
            self.assertEqual(parse_transcript(target), cues)
            self.assertEqual(srt_time(3661.123), "01:01:01,123")

    def test_unsafe_broll_blocked(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            (base / "photo.jpg").write_bytes(b"x")
            manifest = base / "broll.json"
            manifest.write_text('[{"file":"photo.jpg","start":0,"end":2}]')
            with self.assertRaises(ValueError):
                validate_broll(manifest, 3)
            manifest.write_text('[{"file":"photo.jpg","start":0,"end":2,"rights":"owned","evidence":"original camera file"}]')
            self.assertEqual(len(validate_broll(manifest, 3)), 1)

    def test_completely_cut_fails_closed(self):
        self.assertEqual(keep_from_removals([(0, 3)], 3), [])


if __name__ == '__main__':
    unittest.main()
