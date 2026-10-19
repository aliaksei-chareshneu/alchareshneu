import importlib.util
import pathlib
import unittest
from datetime import date, timedelta

PATH = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "druzina_training_rotation.py"
SPEC = importlib.util.spec_from_file_location("training_rotation", PATH)
rotation = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(rotation)


class RotationRules(unittest.TestCase):
    def test_three_week_latin_square(self):
        start = date(2026, 11, 2)
        expected = [
            ["TECH", "GROUP", "SCENARIO"],
            ["GROUP", "SCENARIO", "TECH"],
            ["SCENARIO", "TECH", "GROUP"],
            ["TECH", "GROUP", "SCENARIO"]
        ]
        for week, trio in enumerate(expected):
            dates = [start + timedelta(weeks=week, days=d) for d in (0, 3, 5)]
            actual = [rotation.plan_for_day(day)["format_code"] for day in dates]
            self.assertEqual(actual, trio)

    def test_every_fixed_weekday_sees_three_formats(self):
        start = date(2026, 11, 2)
        for offset in (0, 3, 5):
            codes = {rotation.plan_for_day(start + timedelta(weeks=w, days=offset))["format_code"] for w in range(3)}
            self.assertEqual(codes, {"TECH", "GROUP", "SCENARIO"})

    def test_core_module_independent_from_format(self):
        start = date(2026, 11, 2)
        for week in range(12):
            modules = {rotation.plan_for_day(start + timedelta(weeks=week, days=d))["core_module_id"] for d in (0, 3, 5)}
            self.assertEqual(modules, {f"PESAK-{week+1:02d}"})
        self.assertEqual(rotation.plan_for_day(start + timedelta(weeks=12))["core_module_id"], "PESAK-01")

    def test_no_phantom_days(self):
        for day in (date(2026, 10, 19), date(2026, 11, 3), date(2026, 11, 6)):
            with self.assertRaises(ValueError):
                rotation.plan_for_day(day)

    def test_holidays_are_content_only_and_need_human_check(self):
        result = rotation.plan_for_day(date(2026, 12, 24))
        self.assertEqual(result["format_code"], "SCENARIO")
        self.assertEqual(result["status"], "TEACHING_PLAN_ONLY")


if __name__ == "__main__":
    unittest.main()
