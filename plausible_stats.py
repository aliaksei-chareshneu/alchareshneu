#!/usr/bin/env python3
"""
Pull visitor/pageview/goal-conversion stats from a self-hosted Plausible
instance via the Stats API v2 (POST /api/v2/query).

Setup: see PLAUSIBLE-SETUP.md. Get an API key from the Plausible dashboard
-> account menu -> Settings -> API Keys -> New API Key (Stats API scope).

Usage:
    pip install requests --break-system-packages   # if not already installed
    python3 plausible_stats.py --key YOUR_KEY --days 30

Later this is the piece to lift into an n8n HTTP Request node for an
automated weekly report, same pattern as the invoicing automation.
"""
import argparse
import json
import sys
from datetime import date, timedelta

try:
    import requests
except ImportError:
    sys.exit("Missing dependency. Run: pip install requests --break-system-packages")

GOALS = [
    "Register-Druzina", "Register-Walkers",
    "Join-Chat-Druzina", "Join-Chat-Walkers",
    "Announce-WA-Druzina", "Announce-WA-Walkers",
    "Announce-TG-Druzina", "Announce-TG-Walkers",
]


def query(host, api_key, payload):
    resp = requests.post(
        f"{host}/api/v2/query",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=15,
    )
    if resp.status_code != 200:
        print(f"API error {resp.status_code}: {resp.text}", file=sys.stderr)
        resp.raise_for_status()
    return resp.json()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--key", required=True, help="Plausible Stats API key")
    ap.add_argument("--host", default="https://150-230-157-71.sslip.io",
                     help="Plausible instance base URL (default: the Oracle VM)")
    ap.add_argument("--domain", default="aliaksei-chareshneu.github.io",
                     help="Site ID / tracked domain (default: the GitHub Pages hostname)")
    ap.add_argument("--days", type=int, default=30, help="Look back this many days")
    args = ap.parse_args()

    end = date.today()
    start = end - timedelta(days=args.days)
    date_range = [start.isoformat(), end.isoformat()]

    # 1) Overall traffic
    overview = query(args.host, args.key, {
        "site_id": args.domain,
        "metrics": ["visitors", "pageviews", "bounce_rate", "visit_duration"],
        "date_range": date_range,
    })

    print(f"=== {args.domain} — last {args.days} days ({date_range[0]} to {date_range[1]}) ===\n")
    try:
        row = overview["results"][0]["metrics"]
        print(f"Visitors:        {row[0]}")
        print(f"Pageviews:       {row[1]}")
        print(f"Bounce rate:     {row[2]}%")
        print(f"Avg visit (sec): {row[3]}")
    except (KeyError, IndexError, TypeError):
        print("(unexpected response shape, raw JSON:)")
        print(json.dumps(overview, indent=2))

    # 2) Top pages
    print("\n--- Top pages ---")
    pages = query(args.host, args.key, {
        "site_id": args.domain,
        "metrics": ["visitors", "pageviews"],
        "date_range": date_range,
        "dimensions": ["event:page"],
        "order_by": [["pageviews", "desc"]],
        "pagination": {"limit": 10},
    })
    try:
        for r in pages["results"]:
            print(f"{r['dimensions'][0]:<40} visitors={r['metrics'][0]:<6} pageviews={r['metrics'][1]}")
    except (KeyError, TypeError):
        print(json.dumps(pages, indent=2))

    # 3) Named conversion goals (Register/Join-Chat/Announce — see PLAUSIBLE-SETUP.md §5)
    print("\n--- Goal conversions (Register / Join-Chat / Announce buttons) ---")
    goals = query(args.host, args.key, {
        "site_id": args.domain,
        "metrics": ["visitors", "events"],
        "date_range": date_range,
        "dimensions": ["event:goal"],
        "filters": [["is", "event:goal", GOALS]],
    })
    try:
        results = goals["results"]
        if not results:
            print("(no conversions yet, or goals not registered in Site Settings -> Goals)")
        for r in results:
            print(f"{r['dimensions'][0]:<25} visitors={r['metrics'][0]:<6} events={r['metrics'][1]}")
    except (KeyError, TypeError):
        print(json.dumps(goals, indent=2))


if __name__ == "__main__":
    main()
