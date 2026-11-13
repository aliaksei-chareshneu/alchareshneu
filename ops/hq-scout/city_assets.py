"""Bounded extraction of Brno city public property pages and official unused-property ZIP.

Never considers an index, historic vacancy list, sale, or market rent a confirmed
0 Kč 5+ year loan. Official ZIP is read only in memory with strict size limits.
"""
from __future__ import annotations

import io
import re
import subprocess
from urllib.parse import urljoin, urlparse
from urllib.request import Request
from zipfile import ZipFile, BadZipFile

from hq_scout import allowed, html_info

ARTICLE="https://www.brno.cz/w/material-cezoi-10463"
MAX_COMPRESSED=1_000_000
MAX_UNCOMPRESSED=7_000_000

def city_public_property_pages(results: list[dict]) -> list[dict]:
    pages=[]
    for x in results:
        if x.get("source") != "BRNO_ASSETS":
            continue
        url=x.get("url","")
        if urlparse(url).path.startswith("/w/") and any(term in x.get("title","") for term in ("nebytov","pronájem","prostor","křídlo","muzejka")):
            lower=x["title"]
            status=("SHORT_TERM_NOT_LONGTERM" if "krátkodob" in lower
                    else "MARKET_RENT_NO_CONFIRMED_0KC" if "pronájem" in lower
                    else "PUBLIC_PREMISES_PAGE_NO_0KC_TITLE")
            pages.append({"url":url,"public_title":x.get("title","")[:180],
                          "status":status,
                          "property_available_verified":False,"free_five_year_title_verified":False,
                          "owner_verified":False,"crm_checked":False,"contact_allowed":False})
    return pages

def archive_link(raw: str, base: str) -> str | None:
    _text,_title,links=html_info(raw)
    for href, label in links:
        candidate=urljoin(base,href)
        if "MMB-2026-0069.zip" in (candidate+" "+label) and allowed(candidate):
            return candidate
    return None

def pdf_bytes_text(blob: bytes) -> tuple[str,str]:
    # pdftotext is a fixed allowlisted program with no shell; it cannot download
    # URLs, and untrusted PDF content is never interpreted as instructions.
    try:
        r=subprocess.run(["pdftotext","-layout","-","-"],input=blob,capture_output=True,
                         timeout=15,check=False)
        if r.returncode == 0:
            return r.stdout[:100_000].decode("utf-8",errors="replace"),"PDF_TEXT_EXTRACTED"
        return "","PDF_TEXT_UNREADABLE"
    except (FileNotFoundError,subprocess.TimeoutExpired,OSError):
        return "","PDF_EXTRACTOR_UNAVAILABLE"

def extract_property_strings(text: str) -> list[str]:
    """Signals only. Requiring named street + house number; no verified owner/title."""
    lines=[]
    for row in text.splitlines()[:1200]:
        row=re.sub(r"\s+"," ",row).strip()
        if len(row)>220:
            continue
        if not re.search(r"\b[A-Za-zÁ-ž][A-Za-zÁ-ž' -]{3,45}\s+\d{1,4}(?:/\d{1,4})?\b",row):
            continue
        if re.search(r"(?:telefon|e-mail|identifikačn|číslo jednací|č\.\s*j\.)",row,re.I):
            continue
        if row not in lines:
            lines.append(row[:190])
        if len(lines)>=40:
            break
    return lines

def inspect_city_unused_archive(fetcher) -> dict:
    doc={"source_url":ARTICLE,"archive_url":None,"status":"NOT_CHECKED",
         "archive_entries":0,"property_address_mentions":[],
         "availability_verified":False,"free_5_year_use_verified":False,
         "current_owner_verified":False}
    body,status=fetcher.fetch(ARTICLE)
    if body is None:
        doc["status"]="ARTICLE_BLOCKED_"+status
        return doc
    url=archive_link(body,ARTICLE)
    if not url:
        doc["status"]="OFFICIAL_ATTACHMENT_URL_NOT_FOUND"
        return doc
    doc["archive_url"]=url
    try:
        base=urlparse(url)
        root=base.scheme+"://"+base.netloc
        # The article fetch must have populated the exact same-host robots rule.
        robots=fetcher.robots.get(root)
        if robots is None or robots is False or not robots.can_fetch("IMPERION-HQ-Scout/0.2",url):
            doc["status"]="ATTACHMENT_ROBOTS_DENIED"
            return doc
        req=Request(url,headers={"User-Agent":"IMPERION-HQ-Scout/0.2 (public property records)","Accept":"application/zip,application/octet-stream"})
        with fetcher.opener.open(req,timeout=15) as response:
            if not allowed(response.geturl()):
                doc["status"]="REDIRECT_NOT_ALLOWED"
                return doc
            raw=response.read(MAX_COMPRESSED+1)
        if len(raw)>MAX_COMPRESSED:
            doc["status"]="ZIP_TOO_LARGE"
            return doc
        with ZipFile(io.BytesIO(raw)) as z:
            entries=[n for n in z.infolist() if not n.is_dir()]
            if len(entries)>30 or sum(x.file_size for x in entries)>MAX_UNCOMPRESSED:
                doc["status"]="ZIP_EXPANSION_BLOCKED"
                return doc
            doc["archive_entries"]=len(entries)
            texts=[]
            for info in entries[:25]:
                if info.file_size>2_000_000:
                    continue
                if info.filename.lower().endswith(".pdf"):
                    extracted,_=pdf_bytes_text(z.read(info))
                    texts.append(extracted)
                elif info.filename.lower().endswith((".txt",".csv")):
                    texts.append(z.read(info).decode("utf-8",errors="replace")[:100_000])
            addresses=[]
            for text in texts:
                addresses.extend(extract_property_strings(text))
            doc["property_address_mentions"]=list(dict.fromkeys(addresses))[:40]
            doc["status"]="OFFICIAL_HISTORIC_ATTACHMENT_REVIEW_ONLY"
            doc["note"]="Official answer from 2026-02 is historical, not proof of 2026-11 vacancy, free use or safe occupancy."
    except (OSError,TimeoutError,ValueError,BadZipFile):
        doc["status"]="ARCHIVE_DOWNLOAD_OR_PARSE_FAILED"
    return doc
