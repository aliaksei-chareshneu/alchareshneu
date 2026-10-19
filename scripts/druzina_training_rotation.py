#!/usr/bin/env python3
"""Deterministic content tags for already-existing Družina training slots.

This module NEVER creates, sells, confirms or marks a session attended. The
canonical private session registry is Community Hub Druzina_Sessions, and
Druzina_Training_Rotation is its *content-only* overlay by Session_ID.
"""
from __future__ import annotations

import argparse
import json
from datetime import date

PILOT_MONDAY = date(2026, 11, 2)
WEEKDAY_ORDER = {0: 0, 3: 1, 5: 2}  # Mon, Thu, Sat
FORMAT_CODES = ("TECH", "GROUP", "SCENARIO")


def plan_for_day(day: date) -> dict:
    """Return content plan, not a confirmed lesson or official assessment."""
    if not isinstance(day, date) or day < PILOT_MONDAY:
        raise ValueError("Only real dates at/after 2026-11-02 are supported")
    if day.weekday() not in WEEKDAY_ORDER:
        raise ValueError("The cycle is defined only for Monday/Thursday/Saturday")
    weeks_since_start = (day - PILOT_MONDAY).days // 7
    phase = weeks_since_start % 3
    offset = WEEKDAY_ORDER[day.weekday()]
    return {
        "local_date": day.isoformat(),
        "week_number": weeks_since_start + 1,
        "cycle_phase": phase + 1,
        "weekday": ("Mon", "Thu", "Sat")[offset],
        "format_code": FORMAT_CODES[(phase + offset) % 3],
        "core_module_id": f"PESAK-{((weeks_since_start % 12) + 1):02d}",
        "status": "TEACHING_PLAN_ONLY",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dates", nargs="+", help="Local dates of already-staged sessions, YYYY-MM-DD")
    args = parser.parse_args()
    plans = [plan_for_day(date.fromisoformat(day)) for day in args.dates]
    print(json.dumps(plans, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
