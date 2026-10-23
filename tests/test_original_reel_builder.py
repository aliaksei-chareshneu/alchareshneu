import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

module_path = Path(__file__).parents[1] / 'original_reel_builder.py'
if not module_path.is_file():
    module_path = Path(__file__).with_name('original_reel_builder.py')
spec = importlib.util.spec_from_file_location('reel', module_path)
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)

SAMPLE = {
    'slug': 'demo-original-reel', 'brand': 'Druzina / Academy',
    'slides': [
        {'headline': 'A short original video', 'body': 'Only our own text, with no borrowed video.', 'seconds': 2},
        {'headline': 'Human review comes first', 'body': 'No external post or unreviewed booking.', 'seconds': 2},
    ],
}

class OriginalReelTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.target = Path(self.temp.name) / 'draft.mp4'

    def test_preview_does_not_create_output_or_call_ffmpeg(self):
        status = r.render(SAMPLE, self.target, execute=False)
        self.assertEqual(status['status'], 'PREVIEW_ONLY')
        self.assertEqual(status['duration'], 4)
        self.assertFalse(self.target.exists())

    def test_unverified_or_invalid_script_blocked(self):
        cases = [
            {'slug': 'Bad/slug', 'brand': 'A', 'slides': SAMPLE['slides']},
            {'slug': SAMPLE['slug'], 'brand': 'A', 'slides': SAMPLE['slides']},
            {'slug': SAMPLE['slug'], 'brand': 'good', 'slides': [SAMPLE['slides'][0]]},
            {'slug': SAMPLE['slug'], 'brand': 'good', 'slides': [{**SAMPLE['slides'][0], 'seconds': True}, SAMPLE['slides'][1]]},
            {'slug': SAMPLE['slug'], 'brand': 'good', 'slides': [{**SAMPLE['slides'][0], 'headline': 'x' * 300}, SAMPLE['slides'][1]]},
            {'slug': SAMPLE['slug'], 'brand': 'good', 'slides': [{**SAMPLE['slides'][0], 'seconds': 60}, SAMPLE['slides'][1]]},
        ]
        for example in cases:
            with self.subTest(example=example), self.assertRaises(ValueError):
                r.render(example, self.target, execute=False)

    def test_original_render_is_vertical_and_sidecar_never_says_published(self):
        if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):
            self.skipTest('FFmpeg not installed')
        result = r.render(SAMPLE, self.target)
        self.assertTrue(result['rendered'])
        self.assertTrue(self.target.is_file())
        sidecar = json.loads(Path(str(self.target) + '.json').read_text())
        self.assertEqual(sidecar['status'], 'LOCAL_DRAFT_REQUIRES_HUMAN_REVIEW')
        self.assertEqual(sidecar['publish_status'], 'NOT_PUBLISHED')
        self.assertEqual(len(sidecar['media_sha256']), 64)
        info = json.loads(subprocess.check_output([
            'ffprobe', '-v', 'error', '-show_entries', 'stream=width,height',
            '-show_entries', 'format=duration', '-of', 'json', str(self.target)
        ]))
        self.assertEqual(info['streams'][0]['width'], 1080)
        self.assertEqual(info['streams'][0]['height'], 1920)
        self.assertAlmostEqual(float(info['format']['duration']), 4, delta=0.25)
        with self.assertRaises(FileExistsError):
            r.render(SAMPLE, self.target)

if __name__ == '__main__':
    unittest.main()
