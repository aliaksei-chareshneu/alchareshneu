"""HQ Scout single scheduled read-only driver: existing source scanner + official board notices.

Runs in public GitHub Actions without any account secrets. No private CRM, no
communications and no pay-by-use model. Pages/records are mere public evidence.
"""
from __future__ import annotations
import argparse
import csv
from datetime import datetime
import json
from pathlib import Path
from zoneinfo import ZoneInfo

import hq_scout
from official_notices import Rows, combine_boards, parse_board
from city_assets import city_public_property_pages, inspect_city_unused_archive
from official_open_data import scan_feeds

def combined_scan(source_cfg: dict, official_cfg: dict, max_total: int = 20,
                  fetcher=None, delay: float = 0.4, today=None, scan_archive: bool = False,
                  feeds_config: dict | None = None) -> dict:
    worker = fetcher or hq_scout.PublicFetcher()
    old = hq_scout.run(source_cfg, [], max_total=max_total, fetcher=worker, delay=delay)
    found, diag, notices = [], [], []
    for source in official_cfg["boards"][:8]:
        url = source["url"]
        raw, state = worker.fetch(url)
        diag_item = {"source": source["id"], "url": url, "fetch_status": state,
                     "rows_seen": 0, "property_notices": 0}
        if raw is not None:
            parser = Rows()
            parser.feed(raw)
            parsed = parse_board(raw, url, today=today or datetime.now(ZoneInfo("Europe/Prague")).date())
            diag_item["rows_seen"] = len(parser.rows)
            diag_item["property_notices"] = len(parsed)
            notices.extend(parsed)
            found.append(url)
        diag.append(diag_item)
        if delay:
            import time
            time.sleep(delay)
    merged = combine_boards(notices)
    city_pages = city_public_property_pages(old['results'])
    city_archive = inspect_city_unused_archive(worker) if scan_archive else {'status': 'NOT_REQUESTED'}
    old["status"] = ("NOTICE_LEVEL_PUBLIC_SCAN_NOT_A_CONTRACT" if sum(x["rows_seen"] for x in diag)
                     else "GENERAL_ONLY_NO_MUNICIPAL_NOTICE_READBACK")
    old['city_public_property_pages'] = city_pages
    old['city_public_property_pages_count'] = len(city_pages)
    old['unused_city_property_archive'] = city_archive
    open_data = scan_feeds(worker, feeds_config or {'feeds': []}, checked=today or datetime.now(ZoneInfo('Europe/Prague')).date())
    old['official_open_data'] = open_data
    old['public_json_notices_count'] = open_data['candidate_count']
    if open_data['candidate_count'] > 0:
        old['status'] = 'OPEN_DATA_PUBLIC_NOTICES_UNVERIFIED_NO_FREE_USE_AGREEMENT'
    old["official_boards"] = diag
    old["municipal_boards_read"] = len(found)
    old["municipal_rows_seen"] = sum(x["rows_seen"] for x in diag)
    old["public_notices"] = merged
    old["public_notices_count"] = len(merged)
    old["fully_qualified_0kc_5y_property_offers"] = 0
    old["private_crm_verified"] = False
    if not found and city_pages:
        old['status'] = 'INDIVIDUAL_CITY_PROPERTY_PAGES_REVIEW_ONLY_NO_FREE_USE_TITLE'
    old["pages_ok"] += len(found)
    old["pages_attempted"] += len(diag) + len(open_data["feeds"])
    old["pages_ok"] += sum(1 for f in open_data["feeds"] if f["status"].startswith("OK_"))
    old["source_coverage"] = "OFFICIAL_BOARD_AND_PUBLIC_SOURCE" if found else "PUBLIC_SOURCE_ONLY"
    # Never transfer private Google CRM contents or Gmail to this public artifact.
    assert all(n["contact_allowed"] is False and n["private_crm_checked"] is False for n in merged)
    return old

def save_report(result: dict, output: Path) -> None:
    hq_scout.save(result, output)
    columns = ("notice_id","title","category","reference","status","research_score",
               "published","deadline","document_url","board_url","additional_boards",
               "explicit_free_5_year_agreement_verified","private_crm_checked","contact_allowed")
    with (output/"notices.csv").open("w", encoding="utf-8-sig", newline="") as out:
        writer=csv.writer(out)
        writer.writerow(columns)
        for r in result["public_notices"]:
            writer.writerow([(";".join(r.get(c, [])) if isinstance(r.get(c),list) else r.get(c,""))
                             for c in columns])
    with (output/"city_object_pages.csv").open("w",encoding="utf-8-sig",newline="") as out:
        writer=csv.writer(out)
        writer.writerow(("Official_URL","Title","Status","Free_Five_Years_Verified","Availability_Verified","CRM_Checked"))
        for row in result["city_public_property_pages"]:
            writer.writerow((row["url"],row["public_title"],row["status"],"NO","NO","NO"))
    (output/"city_unused_archive.json").write_text(
        json.dumps(result["unused_city_property_archive"],ensure_ascii=False,indent=2),encoding="utf-8")
    feed_report=result.get("official_open_data", {"feeds":[],"candidate_notices":[],"candidate_count":0})
    (output/"official_open_data.json").write_text(
        json.dumps(feed_report,ensure_ascii=False,indent=2),encoding="utf-8")
    with (output/"official_feed_notices.csv").open("w",encoding="utf-8-sig",newline="") as out:
        writer=csv.writer(out)
        columns=("notice_id","source","title","reference","published","deadline",
                 "status","research_score","document_url","private_crm_checked","contact_allowed")
        writer.writerow(columns)
        for row in feed_report["candidate_notices"]:
            writer.writerow([row.get(c) for c in columns])
    (output/"scan.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    original=(output/"review.md").read_text(encoding="utf-8")
    lines=["# Object-level Brno official notices","",
           "**No 0 Kč free-use 5+ year agreement or present availability has been verified.**",
           "**No private CRM or Gmail was connected to the public cloud runner.**",
           "OFFICIAL OFN JSON-LD feed notices: "+str(result["public_json_notices_count"]),
           "First-party individual city pages: "+str(result["city_public_property_pages_count"]),
           "Unused-property city ZIP status: "+result["unused_city_property_archive"]["status"],
           "Boards read: "+str(result["municipal_boards_read"]),
           "Table records observed: "+str(result["municipal_rows_seen"]),
           "Relevant public notices: "+str(result["public_notices_count"]),""]
    for item in result["official_open_data"]["candidate_notices"][:40]:
        lines += ["## OPEN DATA / "+item["title"], "Source: "+item["source"],
                  "Reference: "+item["reference"],"Deadline: "+str(item["deadline"]),
                  "Status: "+item["status"],"Official URL: "+item["document_url"],""]
    for feed in result["official_open_data"]["feeds"]:
        lines += ["OFN FEED "+feed["source"]+" "+feed["status"]+": "+str(feed["feed_items"])+" items / "+str(len(feed["relevant_notices"]))+" relevant"]
    for item in result["public_notices"][:45]:
        lines += ["## "+item["title"],"Official reference: "+item["reference"],
                  "Notice expiry: "+str(item["deadline"]), "Status: "+item["status"],
                  "Official link: "+item["document_url"],""]
    for row in result["official_boards"]:
        if row["rows_seen"] == 0:
            lines += ["BLOCKED or NO STRUCTURED ROWS: "+row["source"]+": "+row["fetch_status"]+" "+row["url"]]
    (output/"review.md").write_text("\n".join(lines)+"\n\n---\n\n"+original,encoding="utf-8")

def main(argv=None) -> int:
    a=argparse.ArgumentParser()
    base=Path(__file__).parent
    a.add_argument("--sources",default=str(base/"sources.json"))
    a.add_argument("--boards",default=str(base/"official_boards.json"))
    a.add_argument("--feeds",default=str(base/"official_feeds.json"))
    a.add_argument("--out",default="ops/hq-scout/output")
    a.add_argument("--max-total",type=int,default=16)
    a.add_argument("--min-board-rows",type=int,default=0)
    a.add_argument("--min-city-pages",type=int,default=0)
    a.add_argument("--scan-archive",action="store_true")
    args=a.parse_args(argv)
    if not 1 <= args.max_total <= 32 or not 0 <= args.min_board_rows <= 50 or not 0 <= args.min_city_pages <= 30:
        a.error("Invalid scan limits")
    source_cfg=json.loads(Path(args.sources).read_text(encoding="utf-8"))
    boards_cfg=json.loads(Path(args.boards).read_text(encoding="utf-8"))
    feeds_cfg=json.loads(Path(args.feeds).read_text(encoding="utf-8"))
    if any(not hq_scout.allowed(x["url"]) or not x["url"].startswith("https://edeska.brno.cz/") for x in boards_cfg["boards"]):
        a.error("Official board domain allowlist violated")
    if any(not hq_scout.allowed(x["url"]) for x in feeds_cfg["feeds"]):
        a.error("OFN feed domain allowlist violated")
    result=combined_scan(source_cfg,boards_cfg,max_total=args.max_total,
                         scan_archive=args.scan_archive,feeds_config=feeds_cfg)
    save_report(result,Path(args.out))
    print(json.dumps({"status":result["status"],"source_pages_ok":result["pages_ok"],
                      "board_rows_seen":result["municipal_rows_seen"],
                      "notices":result["public_notices_count"],
                      "official_json_feed_notices":result["public_json_notices_count"],
                      "city_object_pages":result["city_public_property_pages_count"],
                      "unused_city_archive":result["unused_city_property_archive"]["status"],
                      "qualified_free_five_year_properties":0,"out":args.out},ensure_ascii=False))
    return 0 if (result["municipal_rows_seen"] >= args.min_board_rows and
                 result["city_public_property_pages_count"] >= args.min_city_pages) else 2

if __name__ == "__main__":
    raise SystemExit(main())
