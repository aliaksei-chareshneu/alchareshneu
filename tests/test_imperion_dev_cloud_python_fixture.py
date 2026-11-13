"""Independent trusted tests for the deliberately broken public Python fixture."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "ops" / "imperion-dev-cloud-fixture" / "normalize_py.py"
spec = importlib.util.spec_from_file_location("imperion_public_python_math", SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class PublicArithmeticFixture(unittest.TestCase):
    def test_empty(self):
        self.assertEqual(module.total([]), 0)

    def test_quantities(self):
        self.assertEqual(module.total([{"price": 8, "qty": 3}, {"price": 5, "qty": 2}]), 34)

    def test_single_quantity(self):
        self.assertEqual(module.total([{"price": 9, "qty": 2}]), 18)
