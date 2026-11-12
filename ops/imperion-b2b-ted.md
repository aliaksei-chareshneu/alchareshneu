# IMPERION / B2B Client Hunter - TED public notice adapter

Status: **CODE TESTED OFFLINE, NOT LIVE UNTIL MERGED AND PROVIDER READBACK**.

This adds a **source collector**, not a second CRM, sales system, sending bot or autonomous buyer-contact service.
It reuses the current `IMPERION_B2B_Open_Requests` tab (15 columns) of the existing Community Hub and current corporate request intake. It must not place the private CRM, Gmail, account tokens, grant projects, NGO data or personal contacts in public GitHub files.

## Entry point / outputs

Run `node --test tests/imperion-b2b-ted.test.cjs` then `node scripts/imperion-b2b-ted.cjs --out /tmp/imperion-b2b-review --state .cache/b2b-ted-state.json`.
The collector calls the official anonymous EU TED Search API v3. Four small bounded queries look for publicly indexed active competition notices for Czech IT/data services, research, training and cross-border IT in DE/AT/PL/SK. Returned notices are **not** evidence that a solo Czech OSVC meets procurement eligibility requirements; lots, dates, budget and procurement path must be checked in the actual notice.

The output directory includes `candidates.json` and `review.md` (public buyer organisations only) and `crm_review_import.csv`, whose headers match the EXISTING `IMPERION_B2B_Open_Requests` sheet. This CSV is a review staging import, NOT auto-imported: it has NOT been reconciled against the private CRM/SENT/opt-out history. When a prospect has been verified, use the existing private system and current pipeline; do not create a parallel Lead record or run the public-only content through the inbound customer-application endpoint.

GitHub Actions searches 4 times per UTC day (interval 6h) **only after the workflow is merged to the default branch**, with a read-only token. A review artifact is retained for seven days. Public source IDs are cached for deduplication; the cache can expire, so CRM checks are still required. A provider error fails the run closed. No paid APIs, Perplexity subscription, LLM quota or marketing email is used.

## Verification before external action

1. Read the original tender and verify open deadline, value/context, notice version, exact scope, award process, eligibility, language, mandatory certifications, travel, deposit, and whether a solo OSVC or subcontractor can apply. If uncertain: HOLD.
2. Search existing B2B Pipeline + Community Hub + Gmail Inbox/SENT + opt-outs. Never chase a refusal or contact a protected private person based on a guessed address. Official tender portal application can be considered independently of cold marketing; platform rules, bid requirements and owner approval still apply.
3. Estimate **all** hours, costs and possible time-to-cash. Rank against the OSVC commercial target but do not assume a tender's overall budget is a personal fee.
4. Draft a named, fixed-scope paid pilot or bid that fits the actual stated problem. No automatic messages, tenders, invoicing or contracts.
5. Verify actual portal submission receipt, buyer acceptance, signed order, invoice and bank statement in separate evidence stages. `INDEXED_NEEDS_LIVE_CHECK` is not `CLIENT` or `PAID`.

## Safety, limitations and next integration

- Czech regulator: https://uoou.gov.cz/index.php/profesional/qa-otazky-a-odpovedi/obchodni-sdeleni - public email is **not** permission to send an unsolicited commercial offer, including generic company inboxes. No Hunter/Snov email harvesting in this collector.
- Official source: https://docs.ted.europa.eu/api/latest/search.html and https://docs.ted.europa.eu/ODS/latest/reuse/search-api.html; official notice link format documented at https://docs.ted.europa.eu/ODS/latest/reuse/download-direct.html.
- This version covers **TED only**, not all Czech subthreshold procurements, Upwork jobs, or corporate procurement sites. Extend later using source-authorised RSS/official APIs on separate bounded adapters; no scraping around logins/robots or terms.
- Network/prod TED request is **NOT VERIFIED** in local QA environment. After merge, owner should run a single workflow_dispatch, inspect API response/report artifact and compare five notices against the original TED pages; if a query schema is rejected, fail closed and fix the adapter before claiming LIVE.
- Private next step: an authorized read-only CRM/Gmail matching worker and a private append-only review queue reconciler. It must not use GitHub public CI to handle contact PII or company correspondence.

`DRAFT PR` != `MERGED` != `SCHEDULED SUCCESS` != `CRM QUALIFIED` != `APPLICATION SUBMITTED` != `PAID`.