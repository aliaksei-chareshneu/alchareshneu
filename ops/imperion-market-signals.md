# IMPERION market-signal research — existing Deal Hunter workflow

## Goal and exact scope
This is the research half of the 2026-11-03 video pattern:
official consulting industry research -> identify recurring operational pain
-> propose a small paid validation offer -> test actual buyer demand -> only then consider product development.
**Not** a promise of a billion-CZK idea, and not a copied SaaS demo.

Built alongside the already existing .github/workflows/imperion-b2b-ted.yml;
no new CRM, Supabase tables, AI subscriptions, bot, domain or outbound process.
The existing public TED monitor, private Supabase staging and Community Hub sheet
remain canonical for *actual* B2B public requests.

## Public sources (allowlisted URLs, primary pages)
- PwC CEE 29th Global CEO Survey (2026), AI value gap
- PwC/FERMA Global Risk Manager Survey (2026-10-05)
- PwC Global CEO Snapshot (2026-10-19)
- Deloitte State of AI in the Enterprise (2026)
Exact URLs and source identifiers: scripts/imperion-market-signals.cjs.
Publication dates not visible on a source are deliberately null.

## Mechanics
1. Fetch only the above four public official HTML pages (GET, 15s timeout/source,
   <=2.5MB each, no redirects accepted, no cookies or personal information).
2. Strip scripts, navigation and HTML; require AI plus an operational pain term
   **in the same sentence**. No external AI inference and no scraping of contacts.
3. Map evidenced themes to **unvalidated** commercial hypotheses:
   measurable AI ROI, responsible implementation, practical workplace skills
   and scenario workshops. Preserve source IDs and URLs.
4. Keep public-only evidence set hashes in the existing workflow's action cache.
   Reruns mark unchanged evidence sets, not new customer opportunities.
5. Write market-signals.json and market-signals.md to the same
   imperion-b2b-review-<run> workflow artifact as TED reports.
   The artifact expires after 7 days (current workflow setting).
6. Fail closed on all sources unavailable. The new step is fault-isolated
   (continue-on-error) so third-party source outages do not break the current TED job.

## Hard gates
- Stage remains RESEARCH_SIGNAL_ONLY, never VERIFIED_BUYER.
- All commercial value, purchasing power, competitor analysis, current willingness
  to pay, market size and legal procurement route: NOT_VERIFIED.
- No direct source page is permission to contact named people.
- For OSVC, estimated (quote - direct costs) / ALL owner hours >= 1,000 Kč
  is the **minimum** economic test; unknown quote/hours -> REVIEW_UNCOSTED.
- No automatic Gmail, sales proposals, applications, CRM writes, public publication,
  personal data processing, paid inference or payments.
- Only after 3 buyer-specific confirmations + full-hour economics + Gmail/SENT/CRM/
  opt-out check should an owner approve a real offer.
- The PwC/Deloitte page content is not duplicated in the output: only source
  URLs, topical classification and independently worded product hypotheses.

## Local readback
node --test tests/imperion-market-signals.test.cjs
node scripts/imperion-market-signals.cjs --out /tmp/imperion-research --state /tmp/imperion-market-state.json

Required independent production readback: Github Action has PASS test, a market
scan step with successful fetch count, and two market-signals files in the
actual run artifact. A green Workflow badge **alone** is insufficient.
If official domains block GitHub's fetch, status is SOURCE_PARTIAL / SOURCE_FAILED
and the result is NOT LIVE for that source; adapt only after reviewing evidence.
