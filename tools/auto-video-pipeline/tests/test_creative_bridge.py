import json
import subprocess
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import creative_bridge as cb
import video_factory as vf


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

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'Requires FFmpeg')
    def test_real_synthetic_e09_plan_and_review_render(self):
        # Exact E09 adapter -> canonical video_factory.plan -> canonical render.
        # Only synthetic video/sound. No customers, external media or publication.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / 'original.mp4'
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin',
                '-f', 'lavfi', '-i', 'color=c=0x183447:s=320x568:r=24:d=12',
                '-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=24000:duration=12',
                '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
                '-shortest', '-y', str(source)], capture_output=True, check=True, timeout=45)
            handoff_dir = root / 'handoff'
            handoff = cb.write_handoff(example(), handoff_dir, source)
            plan_dir = root / 'e09_plan'
            planned = vf.make_plan(source, plan_dir, handoff['topic'],
                handoff['entity'], handoff['cta'],
                transcript=handoff_dir / 'approximate_captions.srt', count=1, window=12)
            self.assertEqual(planned['status'], 'CUT_PROPOSALS_NEED_REVIEW')
            clearance = root / 'synthetic_clearance.json'
            clearance.write_text(json.dumps({
                'source_sha256': handoff['local_source_sha256'],
                'rights_status': 'owned',
                'rights_basis': 'Synthetic FFmpeg color pattern and sine audio created for this local test only.',
                'people_consents_checked': True, 'music_rights_checked': True,
                'contains_minors': False}))
            rendered = vf.render(plan_dir / 'cut_proposals.json', clearance, root / 'render')
            self.assertEqual(rendered['status'], 'MEDIA_RENDERED_REVIEW_REQUIRED')
            receipt = json.loads(Path(rendered['qa']).read_text())
            self.assertEqual(len(receipt['videos']), 1)
            self.assertFalse(receipt['published'])
            output = Path(receipt['videos'][0]['file'])
            self.assertTrue(output.is_file())
            media = vf.media_probe(output)
            self.assertEqual((media['width'], media['height']), (1080, 1920))
            self.assertFalse(receipt['editorial_approved'])

    def test_duplicate_ids_blocks(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'jobs.jsonl'
            row = json.dumps(example())
            path.write_text(row + '\n' + row + '\n')
            with self.assertRaisesRegex(ValueError, 'duplicate'):
                cb.load_job(path, 'E09-TEST-001')


if __name__ == '__main__':
    unittest.main()
