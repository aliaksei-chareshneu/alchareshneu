# IMPERION HQ Scout — existing Project 80 / Družina venue responsibility

Case: IMP-HQ-SCOUT-20261110. Owner: Aliaksei Chareshneu. Legal applicant: Družina Moravy z.s., not IMPERION and not automatically owner's OSVČ.

## Objective / legal gate
Search for genuinely available, independently usable 50–250 m² property in Brno and its transit-accessible surroundings for a **written, 0 Kč rent bezúplatná výpůjčka lasting at least 5 years**, preferably >=10. Verify access, WC/water, power, noise, safe soft HEMA, culture, education, workshops, storage, permitted use/kolaudace, ownership of building **and** land (KN/LV), repair responsibility, notice/termination rules and mixed OSVČ use separately. Historic vacancy maps, building advertisements and model predictions are not offers or a signed legal title.

## Existing canonical CRM (never copy privately held CRM to GitHub)
OUTREACH CRM — Družina Moravy — 2026, spreadsheet ID 1rnc0AGZHhTGywao5J9RtTx_G80cGvij8mE3l7b-11JU.
Reuse HQ_BRNO_BROWNFIELDS, HQ_SPECIAL_LEADS, HQ_VACANCY_SOURCES, HQ_VACANCY_SCREENING, HQ_KAM_RUIAN_2018_2020, HQ_KAM_RETAIL_2025_813. Canonical narrative: Družina HQ — VENUE PIPELINE, 00 GLOBAL, 02 ORGS and 03 EXECUTION. Check Gmail Inbox/SENT/opt-outs before any **separately authorized** contact. Do not contact Libušino údolí 152a (HOLD), Kuřim Hybešova (DNC), Vinohradská 78 (withdrawn), Brno-střed general office (DNC), already approached CzechInvest/ÚZSVM generically. Treat Radostický mlýn (CzechInvest 312), Cihelna Sokolnice (994), Klobásova 9 and municipal sources as existing leads, not new ones.

## Cloud execution / zero-new-API spending
.github/workflows/imperion-hq-scout.yml uses existing public-repo GitHub Actions infrastructure: daily and manual read-only runs, no credentials, no writes to website, owners or CRM, no paid model APIs, no messages, a bounded official-domain scan. It uploads *public-only* source signals as a short-retention workflow artifact; the artifact is NOT an authorized secure storage location for personal data. GitHub Actions public-repo standard runners are documented as free; workflow state must be checked from provider run before calling the agent LIVE. If robots/network fails and 0 sources are successfully read, the workflow FAILS rather than reporting a valid scan.

## Local Qwen when the existing PC is online
Only optionally run local Ollama with installed model alias imperion-qwen35:4b. It uses loopback localhost, at most 3 PUBLIC page analyses, and treats generated output as unverified hints. Never pass private Google CRM, email, personal data or children's data to LLM. The existing production BrowserBridge public_ai_draft action is strictly for allowlisted first-party URLs — DO NOT smuggle unrelated venue URLs through it. This module is a separate bounded local read-only operation, not a new queue or CRM.

Commands:
  python3 -m unittest discover -s ops/hq-scout -p test_hq_scout.py -v
  python3 ops/hq-scout/hq_scout.py --sources ops/hq-scout/sources.json --out hq-scout-output --min-fetched 1
  python3 ops/hq-scout/hq_scout.py --sources ops/hq-scout/sources.json --existing PRIVATE_HQ_SPECIAL_LEADS.csv --out hq-scout-output --ollama

## READBACK / audit
Outputs: scan.json, screening.csv, review.md. page_ok > 0 means *some public page read*, not any real vacancy. A record is merely PUBLIC_SOURCE_RESEARCH_ONLY / RENTAL_NOT_ZERO_RENT / DOCUMENT_LEVEL_FREE_USE_SIGNAL_VERIFY_INDIVIDUAL_OBJECT / EXISTING_DNC_DO_NOT_CONTACT. Every record always says verified_available=false, legal_free_5plus_term_verified=false.

For an actual opportunity, manually verify URL, notice/deadline, address/parcel, owner authority, current occupancy, free term, safety, public access and full cost, deduplicate existing CRM + SENT and only then place a case record into existing HQ_VACANCY_SCREENING. No publicity, offer, contact, application, contract, grant or spending without distinct owner GO. No repeat generic municipal emails. No private CRM content in GitHub artifacts.
