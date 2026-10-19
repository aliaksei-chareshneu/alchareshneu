#!/usr/bin/env python3
"""Druzina private attendance -> public opt-in-only monthly leaderboard.

Reads existing (private) Google Sheets using a read-only service account. Publishes
ONLY fields permitted by independent, reviewed adult profile approvals.
Never sends raw member/evidence rows, email, phones, IDs or proof references to site.
No live credentials are stored in repo. Dataset can also come from local fixtures.
"""
from __future__ import annotations
import argparse
import calendar
import json
import os
import re
from collections import defaultdict
from datetime import datetime, timezone, date
from pathlib import Path
from zoneinfo import ZoneInfo

SHEET_ID = "1igxEHQ7wFFCoCA9lg4kzT2OoMrVLgbBogfqTxGeUftY"
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "druzina" / "leaderboard" / "results.json"
PROFILE_TAB = "Druzina_Public_Profiles"
EVIDENCE_TAB = "Druzina_Achievement_Evidence"
CHECKPOINTS_TAB = "Druzina_Track_Checkpoints"
PROGRESS_TAB = "Druzina_Track_Progress"
CATEGORIES = ("training", "battles", "archery", "skills", "volunteer", "mentor", "consistency")
TRUE = {"true", "yes", "y", "1", "ano", "approved"}
ALLOWED_AGE = {"adult", "18+", "18plus", "over18", "18_and_over"}
APPROVED_VISIBILITY = {"public_approved", "approved_public", "approved"}
DATE_RE = re.compile(r"^\d{4}-\d\d-\d\d")
PHOTO_RE = re.compile(r"^images/portraits/[a-z0-9_-]+\.(webp|jpg|png)$")

def yes(v):
    return str(v or "").strip().lower() in TRUE

def date_part(v):
    s = str(v or "").strip()
    return s[:10] if DATE_RE.match(s) else ""

def as_date(v):
    s = date_part(v)
    try:
        return date.fromisoformat(s) if s else None
    except ValueError:
        return None

def make_rows(values):
    if not values:
        return []
    headers = [str(x).strip() for x in values[0]]
    return [{key: (str(row[i]).strip() if i<len(row) else "")
             for i,key in enumerate(headers) if key} for row in values[1:]]

def from_private_sheet(tab):
    """Reads only private master sheet, never accesses an open CSV export."""
    import google.auth.transport.requests
    from google.oauth2 import service_account
    info = json.loads(os.environ["DRUZINA_GOOGLE_SA_JSON"])
    creds = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
    )
    req = google.auth.transport.requests.AuthorizedSession(creds)
    import urllib.parse
    a1 = urllib.parse.quote("'" + tab + "'!A1:U4000", safe="")
    url = "https://sheets.googleapis.com/v4/spreadsheets/" + SHEET_ID + "/values/" + a1
    response = req.get(url, timeout=25)
    response.raise_for_status()
    return make_rows(response.json().get("values",[]))

def adult_public_profiles(rows, today):
    accepted={}
    # Duplicated, conflicting or revoked profile records are never made public.
    # Staff must reconcile profiles first instead of letting row order pick consent.
    grouped=defaultdict(list)
    for p in rows:
        if p.get("Member_ID",""):
            grouped[p["Member_ID"]].append(p)
    for ident, candidates in grouped.items():
        if len(candidates)!=1:
            continue
        p=candidates[0]
        age=p.get("Age_Class","").strip().lower().replace(" ","")
        if age not in ALLOWED_AGE:
            continue
        if p.get("Visibility_Status","").strip().lower() not in APPROVED_VISIBILITY:
            continue
        if not all(yes(p.get(k)) for k in ("Name_Opt_In","Stats_Opt_In","Awards_Opt_In")):
            continue
        if not p.get("Consent_Evidence_Ref") or not p.get("Approved_By"):
            continue
        if as_date(p.get("Consent_Checked_At")) is None or as_date(p.get("Approved_At")) is None:
            continue
        expires=as_date(p.get("Consent_Expires_At"))
        if expires and expires<today:
            continue
        if p.get("Consent_Revoked_At","").strip():
            continue
        name=p.get("Display_Name","").strip()
        if not (2<=len(name)<=50) or "@" in name or "http" in name.lower():
            continue
        photo=None
        path=p.get("Approved_Photo_Path","")
        if yes(p.get("Photo_Opt_In")) and PHOTO_RE.fullmatch(path) and p.get("Portrait_Alt"):
            photo=path
        accepted[ident]={"display_name":name,"photo_path":photo,
                         "photo_alt":p.get("Portrait_Alt","")[:80] if photo else ""}
    return accepted

def approved_evidence(rows, eligible, period, today):
    metrics=defaultdict(lambda:defaultdict(int))
    active_weeks=defaultdict(set)
    seen=set()
    valid=0
    rejected=0
    latest=""
    allowed={"training","archery","battle","volunteer","mentor"}
    for e in rows:
        mid=e.get("Member_ID","")
        when=as_date(e.get("Event_Date"))
        typ=e.get("Event_Type","").strip().lower()
        track=e.get("Track","").strip().lower()
        key=e.get("Unique_Key","").strip()
        if (mid not in eligible or not when or (period is not None and when.strftime("%Y-%m")!=period)
            or when>today or typ not in allowed or e.get("Verification","").strip().lower()!="verified"
            or not yes(e.get("Approved_For_Count"))
            or not key or not e.get("Event_ID") or not e.get("Verified_By")
            or not as_date(e.get("Verified_At"))
            or as_date(e.get("Verified_At"))>today
            or as_date(e.get("Verified_At"))<when or not e.get("Proof_Ref")):
            rejected+=1; continue
        # ARCHERY and TRAINING are one attended session, not two visits.
        # Staff must classify that event with one canonical record and Track.
        family="practice" if typ in ("archery","training") else typ
        canonical=(mid,family,e["Event_ID"])
        if key in seen or canonical in seen:
            rejected+=1;continue
        seen.add(key);seen.add(canonical)
        valid+=1
        latest=max(latest,when.isoformat())
        if typ in ("training","archery"):
            metrics[mid]["training"]+=1
            active_weeks[mid].add(when.isocalendar()[:2])
            if typ=="archery" or track in ("archery","ranged","bow","lucistnik"):
                metrics[mid]["archery"]+=1
        if typ=="battle":
            metrics[mid]["battles"]+=1
            active_weeks[mid].add(when.isocalendar()[:2])
        if typ=="mentor":
            metrics[mid]["mentor"]+=1
        if typ=="volunteer":
            try:minutes=int(float(e.get("Volunteer_Minutes",0)))
            except ValueError:minutes=0
            if 0<minutes<=1440:
                metrics[mid]["volunteer"]+=minutes
    for mid,weeks in active_weeks.items():
        metrics[mid]["consistency"]=len(weeks)
    return metrics,valid,rejected,latest

def approved_skill_checks(progress, catalog, eligible, period, today):
    """First supervised pass counts once; verified revocation removes that skill."""
    active=set()
    for item in catalog:
        if item.get("Status","").upper()=="ACTIVE" and item.get("Checkpoint_ID"):
            active.add((item.get("Track_ID","").upper(),item.get("Tier",""),
                        item["Checkpoint_ID"]))
    revoked=set()
    for item in progress:
        d=as_date(item.get("Verified_At"))
        if (item.get("Assessment_Status","").upper()=="REVOKED" and d and d<=today
            and item.get("Instructor_Ref") and item.get("Evidence_Ref")):
            revoked.add((item.get("Member_ID",""),item.get("Checkpoint_ID","")))
    counted=defaultdict(int)
    seen=set()
    ordered=sorted(progress,key=lambda item:(
        as_date(item.get("Verified_At")) or date.max,item.get("Check_ID","")))
    for p in ordered:
        member=p.get("Member_ID","")
        check=p.get("Checkpoint_ID","")
        track=p.get("Track_ID","").upper()
        tier=p.get("Tier","")
        checked=as_date(p.get("Verified_At"))
        demonstrated=as_date(p.get("Demonstrated_On"))
        key=(member,check)
        if (member not in eligible or (track,tier,check) not in active
            or key in revoked or key in seen
            or not checked or checked>today or not demonstrated
            or demonstrated>checked
            or p.get("Assessment_Status","").upper()!="PASSED"
            or not yes(p.get("Safety_Verified")) or not yes(p.get("Skill_Verified"))
            or not p.get("Instructor_Ref") or not p.get("Session_ID")
            or not p.get("Evidence_Ref") or not p.get("Check_ID")):
            continue
        seen.add(key)
        if period is None or checked.strftime("%Y-%m")==period:
            counted[member]+=1
    return counted

def leaders(metrics, eligible):
    """Rank participation only; no win-rate, combat strength or purchased hours."""
    results={}
    for category in CATEGORIES:
        rows=[]
        for mid,values in metrics.items():
            count=values.get(category,0)
            if not count:
                continue
            rows.append({**eligible[mid],"count":count})
        results[category]=sorted(
            rows,key=lambda r:(-r["count"],r["display_name"].casefold())
        )[:3]
    return results

def build(profiles,evidence,period=None,today=None,skill_checks=None,catalog=None):
    today=today or datetime.now(ZoneInfo("Europe/Prague")).date()
    period=period or today.strftime("%Y-%m")
    if not re.fullmatch(r"20\d\d-(0[1-9]|1[0-2])",period):
        raise ValueError("month format must be YYYY-MM")
    eligible=adult_public_profiles(profiles,today)
    current,month_valid,_,_=approved_evidence(evidence,eligible,period,today)
    lifetime,total_valid,rejected,latest=approved_evidence(
        evidence,eligible,None,today
    )
    skill_checks=skill_checks or []
    catalog=catalog or []
    for mid,count in approved_skill_checks(skill_checks,catalog,eligible,period,today).items():
        current[mid]["skills"]+=count
    for mid,count in approved_skill_checks(skill_checks,catalog,eligible,None,today).items():
        lifetime[mid]["skills"]+=count
    month_rows=leaders(current,eligible)
    all_rows=leaders(lifetime,eligible)
    status=("verified_public_results" if any(all_rows.values())
            else "awaiting_verified_entries")
    public={
        "version":2,
        "period":period,
        "as_of":today.isoformat(),
        "status":status,
        "categories":month_rows,
        "all_time_categories":all_rows,
        "last_verified_event_date":latest or None
    }
    stats={"profiles_eligible":len(eligible),"records_verified":total_valid,
           "period_records_verified":month_valid,"records_ineligible":rejected}
    return public,stats

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--profiles-fixture",type=Path)
    p.add_argument("--evidence-fixture",type=Path)
    p.add_argument("--month")
    p.add_argument("--skills-fixture",type=Path)
    p.add_argument("--catalog-fixture",type=Path)
    p.add_argument("--output",type=Path,default=DEFAULT_OUTPUT)
    p.add_argument("--dry-run",action="store_true")
    a=p.parse_args()
    if bool(a.profiles_fixture)!=bool(a.evidence_fixture):
        p.error("both fixture inputs required")
    if bool(a.skills_fixture)!=bool(a.catalog_fixture):
        p.error("both skills and catalog fixtures are required together")
    if a.profiles_fixture:
        profiles=json.loads(a.profiles_fixture.read_text(encoding="utf-8"))
        evidence=json.loads(a.evidence_fixture.read_text(encoding="utf-8"))
        skill_checks=(json.loads(a.skills_fixture.read_text(encoding="utf-8"))
                      if a.skills_fixture else [])
        catalog=(json.loads(a.catalog_fixture.read_text(encoding="utf-8"))
                 if a.catalog_fixture else [])
    else:
        if "DRUZINA_GOOGLE_SA_JSON" not in os.environ:
            p.error("DRUZINA_GOOGLE_SA_JSON service-account credential is required")
        profiles=from_private_sheet(PROFILE_TAB)
        evidence=from_private_sheet(EVIDENCE_TAB)
        skill_checks=from_private_sheet(PROGRESS_TAB)
        catalog=from_private_sheet(CHECKPOINTS_TAB)
    result,stats=build(profiles,evidence,period=a.month,
                       skill_checks=skill_checks,catalog=catalog)
    if not a.dry_run:
        a.output.parent.mkdir(parents=True,exist_ok=True)
        a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    # Never log private person names, proofs, email, member IDs, source rows, or photos.
    print("RESULT status=%s eligible=%d verified=%d ineligible=%d" %(
          result["status"],stats["profiles_eligible"],stats["records_verified"],stats["records_ineligible"]))
if __name__=="__main__":
    main()
