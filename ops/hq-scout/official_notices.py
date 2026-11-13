"""Read-only parsing of concrete municipal notice entries, not general venue pages.

Source rows are untrusted public data. Nothing here sends, writes, books or agrees.
Only official eDeska Brno HTML is accepted by caller. A municipal notice is not
evidence of actual vacancy, 0 Kč free use, legal 5-year term or permission for HEMA.
"""
from __future__ import annotations

from datetime import date, datetime
from hashlib import sha256
from html.parser import HTMLParser
import re
import unicodedata
from urllib.parse import urljoin, urlparse

DATE_RE = re.compile(r"\b(?:[0-3]?\d)\.\s*(?:[01]?\d)\.\s*20\d{2}\b")
REF_RE = re.compile(r"\b(?:MMB|MCB[A-Z]{1,7}|MCBS)/[0-9]{3,}[/0-9A-Z.-]*", re.I)
LOCATION_RE = re.compile(r"\b(?:ul\.?\s*)?[\wČčŘřŠšŽžĚěÁáÍíÝýÉéÚúŮůŤťĎďŇň'-]{3,}\s+\d{1,4}(?:/\d{1,4})?\b", re.U)
INTEREST = ("nebytov", "nebytovych", "prostor", "budov", "objekt", "sklad", "klubovn", "mistnost", "dilna", "areal", "vypujck", "vyuziti", "nemovit", "majetku")
LEGAL_INTENT = ("pronajem", "vypujck", "zamery", "zamer", "majetku", "nebytov", "uzivani")
NEGATIVE = ("prodlouzit dobu trvani najemniho", "prodlouzeni smlouvy", "zmena smlouvy", "prevod bytove", "vyberove rizeni - referent")
FLAT = ("bytu", "byt c.", "bytove jednotky", "bytova jednotka", "podnajem bytu")
PLOT_ONLY = ("pozemku", "pozemky", "parcely", "parcela", "predzahradky")
ASSET_TOKENS = ("nebytov", "prostor", "budov", "objekt", "sklad", "klubovn", "mistnost", "dilna", "areal", "sportov")

def normalize(value: str) -> str:
    a = unicodedata.normalize("NFKD", value or "")
    a = "".join(c for c in a if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", a.casefold()).strip()

def parse_day(value: str) -> date | None:
    m = DATE_RE.search(value or "")
    if not m:
        return None
    try:
        return datetime.strptime(re.sub(r"\s+", "", m.group()), "%d.%m.%Y").date()
    except ValueError:
        return None

def official_link(base: str, href: str) -> str | None:
    if not href or href.strip().lower().startswith(("javascript:", "data:", "mailto:", "file:", "#")):
        return None
    url = urljoin(base, href.strip())
    u = urlparse(url)
    if u.scheme != "https" or u.hostname != "edeska.brno.cz" or u.username or u.password:
        return None
    try:
        if u.port not in (None, 443):
            return None
    except ValueError:
        return None
    return url

class Rows(HTMLParser):
    """Extract table cells and their links without relying on website CSS classes."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.cell_depth = 0
        self.current = []
        self.parts = []
        self.href = None
        self.anchor = []
        self.links = []
        self.rows = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("script", "style", "svg", "noscript"):
            self.hidden += 1
        if self.hidden:
            return
        if tag == "tr":
            if self.depth == 0:
                self.current = []
            self.depth += 1
        elif tag in ("td", "th") and self.depth:
            if self.cell_depth == 0:
                self.parts, self.links = [], []
            self.cell_depth += 1
        elif tag == "a" and self.cell_depth and self.depth:
            self.href, self.anchor = attrs.get("href"), []
        elif tag in ("br", "p", "div") and self.cell_depth:
            self.parts.append(" ")

    def handle_data(self, data):
        if self.hidden or not self.cell_depth:
            return
        self.parts.append(data)
        if self.href is not None:
            self.anchor.append(data)

    def handle_endtag(self, tag):
        if tag in ("script", "style", "svg", "noscript"):
            self.hidden = max(0, self.hidden - 1)
            return
        if tag == "a" and self.cell_depth and self.href:
            self.links.append((self.href, normalize(" ".join(self.anchor))[:140]))
            self.href, self.anchor = None, []
        if tag in ("td", "th") and self.cell_depth:
            self.cell_depth -= 1
            if self.cell_depth == 0:
                self.current.append({"text": re.sub(r"\s+", " ", " ".join(self.parts)).strip()[:900],
                                     "links": self.links[:10]})
                self.parts, self.links = [], []
        if tag == "tr" and self.depth:
            self.depth -= 1
            if self.depth == 0 and len(self.current) >= 4:
                self.rows.append(self.current[:12])
                self.current = []

def notice_status(title: str, category: str, deadline: date | None, today: date) -> tuple[str, int]:
    t, cat = normalize(title), normalize(category)
    if deadline and deadline < today:
        return "NOTICE_EXPIRED_NO_ACTIVE_OFFER", 0
    if any(x in t for x in NEGATIVE):
        return "EXISTING_AGREEMENT_OR_CHANGE_NOT_NEW_HQ", 0
    if any(x in t for x in FLAT) and not "nebytov" in t:
        return "RESIDENTIAL_NOT_HQ", 0
    if any(x in t for x in PLOT_ONLY) and not any(x in t for x in ASSET_TOKENS):
        return "PLOT_ONLY_NO_SAFE_BUILDING", 0
    if "vypujck" in t and any(x in t for x in ASSET_TOKENS):
        return "FREE_USE_INTENT_VERIFY_DOCUMENT_AND_DURATION", 75
    if "pronajem" in t and any(x in t for x in ASSET_TOKENS):
        return "MARKET_RENT_INTENT_NOT_ZERO_RENT", 15
    if any(x in t for x in ASSET_TOKENS) and ("nebytov" in cat or "zamery" in cat):
        return "POSSIBLE_PREMISE_NOTICE_DOCUMENT_REVIEW", 40
    if "zamery" in cat and ("majetku" in cat or "majetku" in t):
        return "GENERAL_ASSET_NOTICE_DOCUMENT_REVIEW", 15
    return "NOT_RELEVANT", 0

def parse_board(html: str, board_url: str, today: date | None = None, maximum: int = 60) -> list[dict]:
    today = today or date.today()
    parser = Rows()
    parser.feed(html[:2_000_000])
    seen = set()
    out = []
    for cells in parser.rows:
        if len(cells) < 4:
            continue
        title = cells[2]["text"].strip()
        category = cells[1]["text"].strip()
        # Never treat dates/header rows, public tenders for jobs or private residential flats as premises.
        if not title or normalize(title) in ("nazev", "title"):
            continue
        tc = normalize(title+" "+category)
        if not any(w in tc for w in INTEREST):
            continue
        references = REF_RE.findall(" ".join(x["text"] for x in cells[:5]))
        reference = references[0] if references else ""
        dates = []
        for c in cells[3:]:
            for raw in DATE_RE.findall(c["text"]):
                parsed = parse_day(raw)
                if parsed:
                    dates.append(parsed)
        posted, ends = (dates[0], dates[-1]) if len(dates) >= 2 else (None, None)
        if not (reference or posted):  # no stable evidence or date
            continue
        status, score = notice_status(title, category, ends, today)
        if status == "NOT_RELEVANT":
            continue
        all_links = [(a,b) for x in cells for a,b in x["links"]]
        links = []
        for href, label in all_links:
            url = official_link(board_url, href)
            if url and url not in links:
                links.append(url)
        docs = [u for u in links if ".pdf" in urlparse(u).path.lower()]
        evidence_link = docs[0] if docs else (links[0] if links else board_url)
        # Many Brno district boards syndicate the same city record. Same official
        # reference number identifies one notice, regardless of board and date.
        key_text = normalize(reference) if reference else normalize(title+"|"+(posted.isoformat() if posted else ""))
        notice_id = "BRNO-ED-" + sha256(key_text.encode()).hexdigest()[:16].upper()
        if notice_id in seen:
            continue
        seen.add(notice_id)
        obj = {"notice_id": notice_id, "title": title[:220],
               "category": category[:160], "reference": reference[:100],
               "authority": cells[4]["text"][:150] if len(cells)>6 else "",
               "published": posted.isoformat() if posted else None,
               "deadline": ends.isoformat() if ends else None,
               "status": status, "research_score": score, "board_url": board_url,
               "document_url": evidence_link, "document_links": docs[:3],
               "explicit_free_5_year_agreement_verified": False,
               "available_now_verified": False, "owner_verified": False,
               "private_crm_checked": False, "contact_allowed": False}
        out.append(obj)
        if len(out) >= maximum:
            break
    return out

def combine_boards(pages: list[dict], max_records: int = 120) -> list[dict]:
    result: dict[str,dict] = {}
    for row in [x for x in pages if isinstance(x,dict) and x.get("notice_id")]:
        k = row["notice_id"]
        if k not in result:
            result[k] = dict(row)
            result[k]["additional_boards"] = []
        elif row["board_url"] not in result[k]["additional_boards"] and row["board_url"] != result[k]["board_url"]:
            result[k]["additional_boards"].append(row["board_url"])
    rank = sorted(result.values(),key=lambda x:(-x["research_score"],x["deadline"] or "9999-12-31",x["notice_id"]))
    return rank[:max_records]
