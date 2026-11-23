import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import creative_bridge as cb


def example():
    return {'id': 'E09-TEST-001', 'entity': 'DRUZINA_ZS', 'status': 'SCRIPT_READY',
            'publish_allowed': False, 'topic': 'One real myth', 'hook': 'Swords were not bricks.',
            'script': 'Swords were not bricks. Museums provide records. We can check them.',
            'cta': 'Follow for museums', 'claim_check': 'Source reviewed',
            'duration_s': 12, 'scene_prompts': ['0-4s: First original drawing.',
                                              '4-9s: Second original drawing.',
                                              '9-12s: Closing frame.'], 'source_urls': []}


class CreativeBridgeTest(unittest.TestCase):
    def test_valid_handoff_restrictive(self):
        row, captions = cb.prepare(example())
        self.assertEqual(row['status'], 'SCRIPT_READY')
        self.assertFalse(row['publish_allowed'])
        self.assertEqual(row['caption_timing'], 'ESTIMATED_REQUIRES_AUDIO_ALIGNMENT')
        self.assertEqual(len(row['scenes']), 3)
        self.assertEqual(round(captions[-1][1]), 12)

    def test_count_mismatch_blocks(self):
        row = example() | {'list_count_claimed': 2, 'list_items': ['one']}
        with self.assertRaisesRegex(ValueError, 'Count/list'):
            cb.prepare(row)

    def test_scene_gap_blocks(self):
        row = example()
        row['scene_prompts'][1] = '5-9s: gap'
        with self.assertRaisesRegex(ValueError, 'gap'):
            cb.prepare(row)

    def test_published_status_blocks(self):
        row = example()
        row['status'] = 'PUBLISHED'
        with self.assertRaisesRegex(ValueError, 'SCRIPT_READY'):
            cb.prepare(row)

    def test_output_no_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'creative'
            cb.write_handoff(example(), out)
            self.assertTrue((out / 'creative_handoff.json').exists())
            with self.assertRaises(FileExistsError):
                cb.write_handoff(example(), out)

    def test_source_plan_no_publish(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / 'original.mp4'
            source.write_bytes(b'synthetic-local-file-placeholder')
            out = Path(tmp) / 'review'
            handoff = cb.write_handoff(example(), out, source)
            self.assertIn('--count 1', (out / 'e09_plan_command.txt').read_text())
            self.assertFalse(handoff['human_editorial_approved'])
            self.assertEqual(len(handoff['local_source_sha256']), 64)

    def test_provided_timed_srt_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / 'original.mp4'
            source.write_bytes(b'synthetic video placeholder')
            transcript = Path(tmp) / 'real.srt'
            transcript.write_text('1\n00:00:00,000 --> 00:00:02,000\nHello\n')
            out = Path(tmp) / 'review'
            handoff = cb.write_handoff(example(), out, source, transcript)
            self.assertEqual(handoff['caption_timing'], 'PROVIDED_SRT_REQUIRES_EDITOR_QA')
            self.assertEqual((out / 'provided_captions.srt').read_text(), transcript.read_text())
            self.assertIn('provided_captions.srt', (out / 'e09_plan_command.txt').read_text())

    def test_duplicate_ids_blocks(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'jobs.jsonl'
            row = json.dumps(example())
            path.write_text(row + '\n' + row + '\n')
            with self.assertRaisesRegex(ValueError, 'duplicate'):
                cb.load_job(path, 'E09-TEST-001')


if __name__ == '__main__':
    unittest.main()
