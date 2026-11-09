"""Offline safety regression of real public-site repo patch controller."""
import importlib.util
import json
from pathlib import Path
from unittest import TestCase, main, mock
local = Path(__file__).with_name("safe_public_repo_worker.py")
if not local.is_file():
    local = Path(__file__).resolve().parents[1] / "scripts" / "imperion-public-repo-worker.py"
spec = importlib.util.spec_from_file_location("imperion_public_repo_worker", local)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)

class PublicRepoControllerTests(TestCase):
    def setUp(self):
        self.baseline = '<!doctype html><html><head>' + worker.ANCHOR + '<main>Public</main></body></html>'
    def test_audited_policy_patch_accepted(self):
        new = worker.check_patch(worker.EXPECTED, self.baseline)
        self.assertEqual(new.count('brand-theme.css'), 1)
        self.assertEqual(new.count('site-design.css'), 1)
        self.assertIn('data-imperion-scope="shop"', new)
        self.assertEqual(new.replace(worker.EXPECTED, worker.ANCHOR), self.baseline)
        self.assertIn('content="#0b1729"', new)
    def test_reject_unsafe_or_wrong_model_patch(self):
        for bad in (
            '<script>alert(1)</script>', '<a onclick="evil()">Go</a>',
            worker.EXPECTED.replace('shop.css', 'evil.css'),
            worker.EXPECTED + '<script>evil()</script>',
            worker.EXPECTED.replace('20261027','20261028'),
            worker.EXPECTED.replace('data-imperion-scope','data-privacy'),
            '',
        ):
            with self.subTest(bad=bad[:52]), self.assertRaises(ValueError):
                worker.check_patch(bad, self.baseline)
    def test_missing_or_duplicate_anchor_rejected(self):
        for html in ('before only', self.baseline*2,
                     self.baseline + 'brand-theme.css'):
            with self.assertRaises(ValueError):
                worker.check_patch(worker.EXPECTED, html)
    def test_unknown_job_fails_closed_without_network(self):
        with mock.patch.object(worker, 'shell', side_effect=AssertionError('shell must not run')):
            with self.assertRaisesRegex(ValueError, 'UNAPPROVED_JOB'):
                worker.run(job='unapproved', upload=True)
    def test_never_uses_unreviewed_model_code_as_shell(self):
        self.assertNotIn('subprocess.run(proposed', Path(worker.__file__).read_text())
        self.assertNotIn('shell(proposed', Path(worker.__file__).read_text())
        self.assertEqual(worker.BRANCH,'agent/imperion-dev-roi-brand-20261109')
        self.assertEqual(worker.TARGET,'shop/ai-workflow-roi/index.html')
        self.assertEqual(worker.REPOSITORY,'https://github.com/aliaksei-chareshneu/alchareshneu.git')
    def test_cli_requires_explicit_push_switch(self):
        self.assertIn('action="store_true"',Path(worker.__file__).read_text())
        self.assertIn('if upload:',Path(worker.__file__).read_text())
        self.assertIn('model_can_merge": False',Path(worker.__file__).read_text())
        self.assertIn('production_changed": False',Path(worker.__file__).read_text())

if __name__=="__main__":
    main(verbosity=2)
