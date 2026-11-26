"""Tests for Agent #3's bounded E09 editor interface (no installs or publishing)."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

TOOLS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOLS))
spec = importlib.util.spec_from_file_location('editor_agent', TOOLS / 'editor_agent.py')
editor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(editor)


class EditorAgentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.project = Path(self.temp.name) / 'job'

    def test_doctor_never_installs_or_claims_live(self):
        d = editor.tool_status(self.project)
        self.assertEqual(d['video_editor_agent'], 'IMPERION_AGENT_3_E09')
        self.assertFalse(d['published'])
        self.assertFalse(d['installed_by_this_command'])
        self.assertIn('ffmpeg', d['tools'])
        self.assertIn('remotion', d['tools'])
        self.assertIn('whisper', d['tools'])
        self.assertIn('yt-dlp', d['tools'])
        self.assertIn('hyperframes', d['tools'])
        self.assertFalse(d['tools']['hyperframes']['detected'])
        self.assertIn('piratex-mcp', d['tools'])

    def test_init_style_preserved(self):
        first = editor.init_project(self.project)
        self.assertTrue(first['style_created'])
        self.assertTrue((self.project / 'public').is_dir())
        self.assertTrue((self.project / 'out').is_dir())
        style = self.project / 'style.md'
        style.write_text('Keep a hard documentary style\n', encoding='utf-8')
        second = editor.init_project(self.project)
        self.assertFalse(second['style_created'])
        self.assertEqual(style.read_text(encoding='utf-8'), 'Keep a hard documentary style\n')

    def test_source_must_be_inside_public_folder(self):
        editor.init_project(self.project)
        source = self.project / 'public' / 'owned.mp4'
        source.write_bytes(b'locally supplied')
        self.assertEqual(editor.assert_source_in_project(source, self.project), source)
        outside = Path(self.temp.name) / 'outside.mp4'
        outside.write_bytes(b'unapproved outside video')
        with self.assertRaisesRegex(ValueError, 'inside project/public'):
            editor.assert_source_in_project(outside, self.project)
        symlink = self.project / 'public' / 'escape.mp4'
        symlink.symlink_to(outside)
        with self.assertRaisesRegex(ValueError, 'inside project/public'):
            editor.assert_source_in_project(symlink, self.project)

    def make_plan(self):
        p = self.project / 'out' / 'plans' / 'cut_proposals.json'
        p.parent.mkdir(parents=True)
        payload = {'schema': 'imperion.video_factory.v1', 'source': '/authorized/source.mp4',
                   'source_sha256': 'a' * 64, 'source_info': {'duration': 30.0},
                   'entity': 'OSVC', 'clips': [
                       {'start': 0.0, 'duration': 8.0, 'hook': 'First', 'title': 'A',
                        'caption': 'Intro', 'subtitles': [{'start': 2.1, 'end': 3.0, 'text': 'Speech'}]},
                       {'start': 10.0, 'duration': 6.0, 'hook': 'Second', 'title': 'B',
                        'caption': 'Payoff', 'subtitles': []}
                   ], 'video_published': False, 'editorial_approved': False}
        p.write_text(json.dumps(payload), encoding='utf-8')
        return p

    def test_revise_remove_and_change_preserves_source_and_resets_captions(self):
        path = self.make_plan()
        before = path.read_bytes()
        decisions = self.project / 'decisions.json'
        decisions.write_text(json.dumps({'decisions': [
            {'clip': 1, 'action': 'change', 'start': 1, 'duration': 7, 'hook': 'Outcome first'},
            {'clip': 2, 'action': 'remove'}
        ]}), encoding='utf-8')
        revised = self.project / 'out' / 'plans' / 'revised.json'
        result = editor.revise_plan(path, decisions, revised)
        self.assertEqual(result['clips_remaining'], 1)
        self.assertEqual(before, path.read_bytes())
        data = json.loads(revised.read_text(encoding='utf-8'))
        self.assertEqual(data['clips'][0]['hook'], 'Outcome first')
        self.assertEqual(data['clips'][0]['subtitles'], [])
        self.assertTrue(data['clips'][0]['subtitle_retranscription_required'])
        self.assertFalse(data['editorial_approved'])
        self.assertFalse(data['video_published'])
        with self.assertRaises(FileExistsError):
            editor.revise_plan(path, decisions, revised)

    def test_revise_rejects_bad_and_duplicate_decisions(self):
        path = self.make_plan()
        decisions = self.project / 'decisions.json'
        output = self.project / 'out' / 'edited.json'
        bad = [
            [{'clip': 1, 'action': 'remove'}, {'clip': 1, 'action': 'remove'}],
            [{'clip': 1, 'action': 'change', 'start': 31}],
            [{'clip': 1, 'action': 'change', 'duration': 1}],
            [{'clip': 1, 'action': 'change', 'command': 'curl example.com'}],
            [{'clip': 1, 'action': 'remove'}, {'clip': 2, 'action': 'remove'}],
            [{'clip': 1, 'action': 'keep', 'hook': 'secret'}]
        ]
        for row in bad:
            decisions.write_text(json.dumps({'decisions': row}), encoding='utf-8')
            with self.subTest(row=row), self.assertRaises(ValueError):
                editor.revise_plan(path, decisions, output)
            self.assertFalse(output.exists())

    def test_real_plan_uses_existing_factory_and_keeps_style_as_guide(self):
        editor.init_project(self.project)
        source = self.project / 'public' / 'take.mp4'
        source.write_bytes(b'test source (not rendered)')
        with mock.patch.object(editor.video_factory, 'sha256', return_value='c' * 64), \
             mock.patch.object(editor.video_factory, 'make_plan') as maker:
            def create_plan(src, out, *args):
                out.mkdir(parents=True)
                (out / 'editorial_handoff.md').write_text('Review original\n', encoding='utf-8')
                return {'status': 'CUT_PROPOSALS_NEED_REVIEW'}
            maker.side_effect = create_plan
            result = editor.plan_project(self.project, source, 'HEMA Training', 'OSVC', 'Use approved link')
        self.assertEqual(result['status'], 'CUT_PROPOSALS_NEED_REVIEW')
        self.assertFalse(result['style_applied_to_render'])
        handoff = next((self.project / 'out' / 'plans').rglob('editorial_handoff.md'))
        self.assertIn('style.md', handoff.read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
