"""Public OFN JSON-LD Brno official-board feed discovery.

The National Open Data Catalogue lists Brno, Brno-stred and Brno-sever
feeds (CC BY 4.0), and Brno-Slatina has a separate first-party feed.
A feed notice is never proof of vacancy, owner, safe HEMA use or a legally
approved bezúplatná výpůjčka for five years. No CRM/Gmail or outreach here.

Source schema: https://ofn.gov.cz/uredni-desky/2021-07-20/
"""
from __future__ import annotations

from datetime import date, datetime
from hashlib import sha256
import re
from urllib.parse import urlparse

import hq_scout
from official_notices import notice_status, normalize

MAX_ENTRIES = 6000
MAX_RECORDS = 120
KEYWORDS = (
    "nebytov", "pronajem", "najem", "vypujc", "bez uplat", "bez uplatn",
    "bezplatn", "majetku", "nemovit", "budov", "prostor", "objekt",
    "klubovn", "sklad", "zamer", "nabidka", "vyuziti",
)
STOPWORDS = ("osobni udaje", "rodne cislo", "kontaktni osoba", "telefon")
DIRECT_HOSTS = ("edeska.brno.cz", "mcslatina.cz", "www.mcslatina.cz")


def item_title(item: dict) -> str:
    name = item.get("název", item.get("nazev", item.get("title", "")))
    if isinstance(name, dict):
        name = name.get("cs") or name.get("sk") or name.get("en") or ""
    return name[:250].strip() if isinstance(name, str) else ""


def date_value(val) -> date | None:
    if isinstance(val, dict):
        val = val.get("datum") or val.get("date")
    if not isinstance(val, str):
        return None
    try:
        return date.fromisoformat(val[:10])
    except ValueError:
        return None


def official_notice_url(url: str, feed_url: str) -> str | None:
    if not isinstance(url, str) or not hq_scout.allowed(url):
        return None
    u = urlparse(url)
    if u.hostname not in DIRECT_HOSTS:
        return None
    if u.username or u.password or u.port not in (None, 443):
        return None
    # Accept only the municipal first-party board, no user-supplied offsite links.
    return hq_scout.canon(url)


def parse_ofn(doc: object, feed: dict, checked: date | None = None) -> dict:
    checked = checked or date.today()
    out = {"source": feed["id"], "source_url": feed["url"],
           "status": "INVALID_OFN_JSON_STRUCTURE", "feed_items": 0,
           "relevant_notices": [], "permission": "CC BY 4.0; attribution to publishing municipality",
           "qualified_0kc_five_year_offers": 0}
    if isinstance(doc, dict):
        items = doc.get("informace")
        if not isinstance(items, list):
            # Metadata-only or unexpected schema; fail closed rather than
            # inventing a success.
            return out
    elif isinstance(doc, list):
        items = doc
    else:
        return out
    if len(items) > MAX_ENTRIES:
        out["status"] = "FEED_TOO_MANY_ITEMS_BLOCKED"
        return out
    out["feed_items"] = len(items)
    seen = set()
    for raw in items:
        if not isinstance(raw, dict):
            continue
        title = item_title(raw)
        lower = normalize(title)
        if not title or not any(k in lower for k in KEYWORDS):
            continue
        if any(x in lower for x in STOPWORDS) or re.search(r"[\w.+-]+@[\w.-]+\.\w+",title):
            # Avoid accidentally relaying title-level personal contact data.
            continue
        expiry = date_value(raw.get("relevantní_do") or raw.get("relevantni_do") or raw.get("konec"))
        published = date_value(raw.get("vyvěšení") or raw.get("vyveseni") or raw.get("zacatek"))
        if expiry and expiry < checked:
            # Keep expired postings as a distinct source status for dedup,
            # not as an actionable open opportunity.
            expiry_status = "EXPIRED_NOTICE_NO_CURRENT_OFFER"
        else:
            expiry_status = ""
        link = raw.get("url")
        # OFN requires a first-party web link for individual records. The
        # "iri" is a stable identifier, not necessarily the readable page.
        official_url = official_notice_url(link, feed["url"])
        if not official_url:
            continue
        agenda = raw.get("agenda") or ""
        if isinstance(agenda,dict):
            agenda = str(agenda.get("název",agenda.get("nazev","")))
        if isinstance(agenda,list):
            agenda = " ".join(str(x.get("název", x)) if isinstance(x,dict) else str(x) for x in agenda[:3])
        agenda = str(agenda)[:160]
        reference = raw.get("číslo_jednací") or raw.get("cislo_jednaci") or ""
        if not isinstance(reference,str):
            reference=""
        status, score = notice_status(title,agenda,expiry,checked)
        if not status or status=="NOT_RELEVANT":
            if "vypujc" in lower or "bezplatn" in lower:
                status, score = "FREE_USE_WORDING_ONLY_DOCUMENT_REVIEW", 35
            elif any(x in lower for x in ("nebytov", "prostor", "budov", "objekt", "sklad", "klubovn")):
                status, score = "POSSIBLE_BUILDING_NOTICE_REVIEW", 25
            elif any(x in lower for x in ("nemovit", "majetku", "zamer")):
                status, score = "GENERAL_PROPERTY_NOTICE_DOCUMENT_REVIEW", 10
            else:
                continue
        if expiry_status:
            status, score = expiry_status, 0
        if published and published > checked:
            status, score = "FUTURE_DATE_NOT_ACTIVE", 0
        ident = raw.get("iri") or official_url
        # Distinct records can share generic titles: use official identity.
        if not isinstance(ident,str):
            ident=official_url
        fingerprint=sha256((feed["id"]+"|"+ident).encode("utf-8")).hexdigest()[:18]
        notice_id="OFN-"+fingerprint.upper()
        if notice_id in seen:
            continue
        seen.add(notice_id)
        out["relevant_notices"].append({
            "notice_id":notice_id, "source":feed["id"], "title":title[:220],
            "reference":reference[:110], "category":agenda,
            "published":published.isoformat() if published else None,
            "deadline":expiry.isoformat() if expiry else None,
            "document_url":official_url,
            "status":status, "research_score":score,
            "explicit_free_5_year_agreement_verified":False,
            "available_now_verified":False, "owner_verified":False,
            "private_crm_checked":False, "contact_allowed":False,
        })
    out["relevant_notices"].sort(
        key=lambda r:(-r["research_score"],r["deadline"] or "9999-12-31",r["notice_id"]))
    if len(out["relevant_notices"])>MAX_RECORDS:
        out["relevant_notices"]=out["relevant_notices"][:MAX_RECORDS]
        out["status"]="OK_CANDIDATES_CAPPED"
    else:
        out["status"]="OK_DATA_ONLY_NO_PROPERTY_CONFIRMED"
    return out


def fetch_one(fetcher, feed: dict, checked: date | None = None) -> dict:
    url=feed["url"]
    if not hq_scout.allowed(url) or urlparse(url).hostname not in DIRECT_HOSTS:
        return {"source":feed["id"],"source_url":url,
                "status":"DENIED_HOST","feed_items":0,"relevant_notices":[],
                "qualified_0kc_five_year_offers":0}
    raw,state=fetcher.fetch_json(url)
    if raw is None:
        return {"source":feed["id"],"source_url":url,
                "status":state,"feed_items":0,"relevant_notices":[],
                "qualified_0kc_five_year_offers":0}
    try:
        import json
        doc=json.loads(raw)
    except (ValueError,UnicodeError):
        return {"source":feed["id"],"source_url":url,
                "status":"INVALID_JSON_RESPONSE","feed_items":0,
                "relevant_notices":[],"qualified_0kc_five_year_offers":0}
    return parse_ofn(doc,feed,checked)


def scan_feeds(fetcher, config: dict, checked: date | None = None) -> dict:
    reports = [fetch_one(fetcher,f,checked) for f in config.get("feeds",[])[:8]]
    all_items, seen = [], set()
    for feed in reports:
        for row in feed["relevant_notices"]:
            # Same eDeska notice may be repeated across mirrored feeds;
            # identity includes official URL, not personal entity names.
            key = row["document_url"].split("#")[0]
            if key not in seen:
                all_items.append(row)
                seen.add(key)
    all_items.sort(key=lambda x:(-x["research_score"],x["deadline"] or "9999-12-31",x["notice_id"]))
    return {"feeds":reports, "total_feed_items":sum(x["feed_items"] for x in reports),
            "candidate_count":len(all_items),
            "candidate_notices":all_items[:MAX_RECORDS],
            "verified_0kc_five_year_offers":0,
            "private_crm_checked":False,"paid_api_calls":0,"emails":0}
