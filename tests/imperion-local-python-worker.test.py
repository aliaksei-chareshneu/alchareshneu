"""Deterministic safety tests for IMPERION local Python coder; no Ollama access."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

worker_path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).with_name("safe_local_python_worker.py")
spec = importlib.util.spec_from_file_location("imperion_local_worker", worker_path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class LocalDevTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="imperion-dev-agent-")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "sample.py").write_text(
            "def price_total(items):\n    return sum(item['price'] for item in items)\n",
            encoding="utf-8"
        )
        (self.root / "test_sample.py").write_text(
            "import unittest\nfrom sample import price_total\n"
            "class Check(unittest.TestCase):\n"
            "    def test_empty(self): self.assertEqual(price_total([]),0)\n"
            "    def test_qty(self): self.assertEqual(price_total([{'price':8,'qty':4}]),32)\n",
            encoding="utf-8"
        )
        self.payload = {
            "job_id": "IMP-DEV-UNITTEST-20261108",
            "workspace": str(self.root),
            "source_file": "sample.py",
            "test_file": "test_sample.py",
            "function": "price_total",
            "requirement": "Return total of price times qty for all line items.",
            "public_only": True,
        }
    def task(self, overrides=None):
        o = dict(self.payload)
        o.update(overrides or {})
        f = self.root / "task.json"
        f.write_text(json.dumps(o),encoding="utf-8")
        return f

    def test_trusted_temp_manifest(self):
        t, workspace = mod.trusted_task(self.task())
        self.assertEqual(workspace,self.root.resolve())
        self.assertEqual(t["function"],"price_total")

    def test_fails_closed_on_private_and_traversal(self):
        with self.assertRaisesRegex(ValueError,"PRIVATE_INPUT_REJECTED"):
            mod.trusted_task(self.task({"public_only":False}))
        with self.assertRaisesRegex(ValueError,"FILE_PATH_RESTRICTED"):
            mod.trusted_task(self.task({"source_file":"../config.py"}))
        with self.assertRaisesRegex(ValueError,"TASK_SCHEMA_REJECTED"):
            mod.trusted_task(self.task({"extra":"unverified"}))

    def test_rejects_untrusted_python_behaviors(self):
        bad=[
            "import os\ndef price_total(items):\n return 1\n",
            "def price_total(items):\n return open('secret.txt').read()\n",
            "def price_total(items):\n return items.__class__\n",
            "def price_total(items):\n return __import__('os')\n",
            "def price_total(items):\n return sum(x for x in items)\ndef other():\n return 1\n",
        ]
        for code in bad:
            with self.subTest(code=code[:45]), self.assertRaises(ValueError):
                mod.candidate_is_safe(code,"price_total")

    def test_mocked_local_model_edits_only_test_workspace_with_readback(self):
        before = (self.root/"sample.py").read_text()
        fixed="def price_total(items):\n    return sum(item['price'] * item['qty'] for item in items)\n"
        with mock.patch.object(mod,"model_candidate",return_value=(fixed,{"prompt_tokens":22,"completion_tokens":13,"duration_ns":1})):
            self.assertTrue(mod.run(self.task()))
        after=(self.root/"sample.py").read_text()
        self.assertNotEqual(after,before)
        self.assertEqual(after,fixed)
        proof=json.loads((self.root/"imperion-dev-proof.json").read_text())
        self.assertEqual(proof["status"],"LOCAL_MODEL_CODE_TEST_PASS")
        self.assertEqual(proof["baseline_exit"],1)
        self.assertEqual(proof["attempts"][0]["test_exit"],0)
        self.assertFalse(proof["model_can_commit"])
        self.assertFalse(proof["model_can_deploy"])

    def test_already_passing_is_no_edit_and_no_model_call(self):
        source=self.root/"sample.py"
        code="def price_total(items):\n    return sum(item['price'] * item['qty'] for item in items)\n"
        source.write_text(code,encoding="utf-8")
        with mock.patch.object(mod,"model_candidate",side_effect=AssertionError("MODEL_CALLED")):
            self.assertTrue(mod.run(self.task()))
        self.assertEqual(source.read_text(),code)
        proof=json.loads((self.root/"imperion-dev-proof.json").read_text())
        self.assertEqual(proof["status"],"BASELINE_ALREADY_PASS_NO_EDIT")

if __name__=="__main__":
    unittest.main(argv=[sys.argv[0]],verbosity=2)
