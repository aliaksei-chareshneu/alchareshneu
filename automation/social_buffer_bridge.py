#!/usr/bin/env python3
"""IMPERION SocialPublishing -> Buffer, one approved row per invocation.

Dry-run by default. No Metricool. The canonical Google Sheet is the ONLY queue.
"""
import argparse
import datetime as dt
import json
import os
import sys
from urllib.parse import quote
from zoneinfo import ZoneInfo

import requests
from google.auth.transport.requests import AuthorizedSession
from google.oauth2.service_account import Credentials

HEADERS = [
    "Duplicate_Checked", "Job_ID", "Event_ID", "Channel", "Scheduled_At",
    "Status", "Caption", "Media_URL", "Video_Drive_ID", "Post_ID",
    "Post_URL", "Attempted_At", "Error", "Entity", "Grant_Funded",
    "Grant_Text", "Rights_OK", "Approved_At", "Visibility", "Made_For_Kids",
]
SHEET = "SocialPublishing"
ZONE = ZoneInfo("Europe/Prague")
APPROVAL_STATUS = "BUFFER_APPROVED"
MANUAL_STATUS = "BUFFER_REVIEW_REQUIRED"


def normalize_rows(values):
    if not values or values[0][:len(HEADERS)] != HEADERS:
        raise ValueError("Unexpected SocialPublishing column schema; refusing to publish")
    rows = []
    for number, raw in enumerate(values[1:], 2):
        padded = (raw + [""] * len(HEADERS))[:len(HEADERS)]
        record = dict(zip(HEADERS, padded))
        record["_row"] = number
        rows.append(record)
    return rows


def when_in_prague(value):
    naive = dt.datetime.strptime(value.strip(), "%Y-%m-%d %H:%M")
    return naive.replace(tzinfo=ZONE).astimezone(dt.timezone.utc)


def eligible(row, mapping, now):
    # Require current explicit, recorded rights/approval; don't act on stale
    # Metricool PENDING/ERROR or on automatically imported DRAFT rows.
    if (row["Status"] != APPROVAL_STATUS or
            row["Duplicate_Checked"].upper() != "YES" or
            row["Rights_OK"].upper() != "YES" or
            not row["Approved_At"] or
            row["Visibility"].lower() != "public" or
            row["Post_ID"] or
            row["Video_Drive_ID"] or
            row["Made_For_Kids"].upper() == "YES"):
        return False
    channel = mapping.get(row["Channel"])
    if not channel or row["Entity"] != channel.get("entity"):
        return False
    if not row["Caption"].strip() or not row["Event_ID"].strip():
        return False
    if row["Media_URL"] and not row["Media_URL"].startswith("https://"):
        return False
    try:
        when = when_in_prague(row["Scheduled_At"])
    except (ValueError, TypeError):
        return False
    return (now + dt.timedelta(minutes=10) < when <
            now + dt.timedelta(days=30))


def graphql_mutation(row, channel_id):
    # GraphQL string syntax permits JSON quoted strings; enums are unquoted.
    when = when_in_prague(row["Scheduled_At"]).isoformat().replace("+00:00", "Z")
    image = row["Media_URL"].strip()
    assets = ", assets: [{image: {url: " + json.dumps(image) + "}}]" if image else ""
    return (
        "mutation CreatePost { createPost(input: {text: " +
        json.dumps(row["Caption"], ensure_ascii=False) +
        ", channelId: " + json.dumps(channel_id) +
        ", schedulingType: automatic, mode: customScheduled, dueAt: " +
        json.dumps(when) + assets +
        "}) { ... on PostActionSuccess { post { id text dueAt } } " +
        "... on MutationError { message } } }"
    )


def google_session():
    blob = os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"]
    account = json.loads(blob)
    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    credentials = Credentials.from_service_account_info(account, scopes=scopes)
    return AuthorizedSession(credentials)


def sheet_values(session, spreadsheet):
    endpoint = (
        f"https://sheets.googleapis.com/v4/spreadsheets/{quote(spreadsheet)}/values/"
        f"{SHEET}%21A1%3AT250"
    )
    result = session.get(endpoint, timeout=25)
    result.raise_for_status()
    return result.json().get("values", [])


def patch_cells(session, spreadsheet, row_number, patches):
    # Only modify F=Status, J=Post_ID, L=Attempted_At, M=Error.
    allowed = {"F", "J", "L", "M"}
    if not set(patches).issubset(allowed):
        raise ValueError("Unexpected write column")
    updates = [
        {"range": f"'{SHEET}'!{col}{row_number}",
         "values": [[value]]}
        for col, value in patches.items()
    ]
    response = session.post(
        f"https://sheets.googleapis.com/v4/spreadsheets/{quote(spreadsheet)}/values:batchUpdate",
        params={"valueInputOption": "RAW"},
        json={"data": updates}, timeout=25)
    response.raise_for_status()
    if response.json().get("totalUpdatedCells") != len(updates):
        raise RuntimeError("Sheet write was not fully acknowledged")


def create_buffer_post(api_key, query):
    response = requests.post(
        "https://api.buffer.com",
        json={"query": query},
        headers={"Authorization": "Bearer " + api_key,
                 "Content-Type": "application/json"},
        timeout=30)
    response.raise_for_status()
    answer = response.json()
    result = (answer.get("data") or {}).get("createPost") or {}
    post = result.get("post") or {}
    if answer.get("errors") or not post.get("id"):
        raise RuntimeError("Buffer returned no confirmed post ID")
    return post["id"]


def run(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--publish", action="store_true",
                        help="Queue one fully approved record (disabled by default)")
    parser.add_argument("--fixture", help="Local synthetic sheet rows JSON; dry run only")
    args = parser.parse_args(argv)
    if args.fixture and args.publish:
        parser.error("--fixture cannot be combined with --publish")

    mapping = json.loads(os.environ.get("BUFFER_CHANNEL_MAP_JSON", "{}"))
    if not isinstance(mapping, dict):
        raise ValueError("BUFFER_CHANNEL_MAP_JSON must be an object")
    if args.fixture:
        with open(args.fixture, encoding="utf-8") as handle:
            values = json.load(handle)
        session = None
    else:
        spreadsheet = os.environ["IMPERION_SPREADSHEET_ID"]
        session = google_session()
        values = sheet_values(session, spreadsheet)

    now = dt.datetime.now(dt.timezone.utc)
    candidates = [row for row in normalize_rows(values)
                  if eligible(row, mapping, now)]
    candidates.sort(key=lambda row: row["Scheduled_At"])
    if not candidates:
        print("NO_APPROVED_POSTS. Nothing queued.")
        return 0
    row = candidates[0]
    print("Candidate", row["Job_ID"], row["Channel"], row["Scheduled_At"])
    if not args.publish:
        print("DRY_RUN. Nothing queued or changed.")
        return 0
    if os.environ.get("ENABLE_BUFFER_PUBLISH") != "true":
        raise RuntimeError("ENABLE_BUFFER_PUBLISH must explicitly equal true")
    api_key = os.environ["BUFFER_API_KEY"]
    channel_id = mapping[row["Channel"]]["id"]
    if not channel_id:
        raise RuntimeError("Missing Buffer channel ID")
    stamp = now.isoformat(timespec="seconds")
    # Record intent BEFORE the potentially ambiguous network side effect.
    # Never retry BUFFER_SUBMITTING automatically: manual provider reconciliation.
    patch_cells(session, spreadsheet, row["_row"],
                {"F": "BUFFER_SUBMITTING", "L": stamp, "M": ""})
    try:
        post_id = create_buffer_post(api_key, graphql_mutation(row, channel_id))
    except Exception as exc:
        # Do not overwrite BUFFER_SUBMITTING after ambiguous remote outcome;
        # it is a hard manual reconcile gate to avoid duplicate posts.
        print("MANUAL_RECONCILIATION_REQUIRED", row["Job_ID"],
              type(exc).__name__, file=sys.stderr)
        return 2
    patch_cells(session, spreadsheet, row["_row"],
                {"F": "BUFFER_QUEUED", "J": post_id, "M": ""})
    print("BUFFER_QUEUED", row["Job_ID"], post_id,
          "(not proof of publication; verify sent permalink later)")
    return 0


if __name__ == "__main__":
    sys.exit(run())
