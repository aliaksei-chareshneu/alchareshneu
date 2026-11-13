"""Private, offline HQ Scout -> existing municipal-property CRM snapshot reconciliation.

This NEVER connects to or writes to Google Sheets, GitHub, Gmail or any owner.
Run ONLY on an authorized local computer with privately exported HQ CSV data.
No private CRM input is ever sent to the public GitHub Actions artifact.
"""
from __future__ import annotations
import argparse
import csv
import json
import os
from pathlib import Path
import re
import unicodedata

PROPERTY_COLUMNS = ("Budova / část areálu", "Objekt / adresa", "Název / lokalita",
                    "Adresa GIS", "Původní název", "Areál / lokace")
STATUS_COLUMNS = ("DNC / právní překážky", "Stav / připravenost", "Stav / priorita",
                  "Stav oslovení / screening 19.10", "Bezpečnost a právní riziko",
                  "Dosavadní komunikace", "Historie komunikace", "Kontaktováno / SENT")
DNC_WORDS = ("hard closed", "dnc", "neoslovovat", "no go", "no-go",
             "neopakovat", "closed", "odmit", "zam it", "stazen", "zamítn")
PREVIOUS_WORDS = ("sent", "odeslan", "osloveno", "kontaktovan", "uz kontakt",
                  "cekame na odpoved", "cek at na odpoved")
ADDRESS_RE = re.compile(r"\b([a-z][a-z'-]{3,})(?:\s+([a-z][a-z'-]{3,}))?\s+(\d{1,4})(?:/(\d{1,4}))?\b", re.I)

def norm(x: str) -> str:
    value=unicodedata.normalize("NFKD",str(x or "")).casefold()
    return re.sub(r"\s+"," ","".join(c for c in value if not unicodedata.combining(c))).strip()

def addresses(text: str) -> set[str]:
    """Require street-like proper token and exact house number, not just locality Brno."""
    out=set()
    for match in ADDRESS_RE.finditer(norm(text)):
        first, second, number, orient=match.groups()
        word=second or first
        if word in ("prostor","prostory","budova","obecni","mesto","brno","mistnost","vyuziti"):
            continue
        if int(number) >= 1900 and not orient:
            continue
        addr=word+" "+number+(("/"+orient) if orient else "")
        out.add(addr)
        # Street+house number is the minimum; bare city or parcel ID is never enough.
    return out

def load_crm_exports(files: list[str]) -> list[dict]:
    rows=[]
    for filepath in files:
        with open(filepath,encoding="utf-8-sig",newline="") as fh:
            for pos,row in enumerate(csv.DictReader(fh),start=2):
                if not isinstance(row,dict):
                    continue
                prop=" ".join(str(row.get(k) or "") for k in PROPERTY_COLUMNS)
                st=" | ".join(str(row.get(k) or "") for k in STATUS_COLUMNS)
                addr=addresses(prop)
                if not addr:
                    continue
                flags=norm(st)
                dnc=any(k in flags for k in DNC_WORDS)
                contacted=any(k in flags for k in PREVIOUS_WORDS)
                rows.append({"source_tab":Path(filepath).stem, "row":pos,
                             "case_id":str(row.get("ID") or row.get("Case ID") or "")[:40],
                             "address_keys":addr, "dnc":dnc, "already_contacted":contacted})
    return rows

def reconcile(notices: list[dict], records: list[dict]) -> list[dict]:
    results=[]
    for item in notices:
        key=addresses(item.get("title",""))
        matches=[x for x in records if key.intersection(x["address_keys"])] if key else []
        matched_dnc=any(m["dnc"] for m in matches)
        approached=any(m["already_contacted"] for m in matches)
        if matched_dnc:
            state="DNC_EXISTING_NO_CONTACT"
        elif matches and approached:
            state="ALREADY_CONTACTED_REVIEW_THREAD"
        elif matches:
            state="EXISTING_CRM_RECORD_REVIEW"
        else:
            state="NO_EXACT_ADDRESS_MATCH_NOT_PROVEN_NEW"
        results.append({"notice_id":item.get("notice_id",""),
                        "title":item.get("title",""),"official_link":item.get("document_url",""),
                        "private_match_status":state,"address_keys_count":len(key),
                        "existing_match_refs":[{"tab":m["source_tab"],"row":m["row"],"case_id":m["case_id"]} for m in matches[:8]],
                        "contact_allowed":False, "qualified_free_5year_offer":False,
                        "next":"Verify owner/LV, safe use, free term, existing Gmail SENT/DNC and owner GO before any external contact."})
    return results

def main(argv=None):
    cli=argparse.ArgumentParser()
    cli.add_argument("--scan",required=True)
    cli.add_argument("--crm",required=True,action="append")
    cli.add_argument("--out",required=True)
    a=cli.parse_args(argv)
    if os.getenv("GITHUB_ACTIONS") or os.getenv("CI"):
        cli.error("Private CRM reconciliation MUST NOT run in public GitHub Actions/CI")
    base=json.loads(Path(a.scan).read_text(encoding="utf-8"))
    records=load_crm_exports(a.crm)
    results=reconcile(base.get("public_notices",[]),records)
    if not Path(a.out).parent.exists():
        cli.error("Private output directory does not exist; create a secure owner-only directory first")
    Path(a.out).write_text(json.dumps({"case_id":base.get("case_id"),"private_review":results},ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"notice_count":len(results),"exact_matches":sum(bool(x["existing_match_refs"]) for x in results),
                      "blocked_dnc":sum(x["private_match_status"]=="DNC_EXISTING_NO_CONTACT" for x in results),
                      "external_contacts_sent":0},ensure_ascii=False))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
