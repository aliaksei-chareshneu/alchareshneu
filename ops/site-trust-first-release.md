## CURRENT READBACK 04 NOV 2026 (overrides earlier staged assumptions)

- OWNER GO: website change/test authorised; publication ONLY after CI + synthetic form -> private source -> existing Leads UUID/ACK independent proof.
- Existing public Supabase Edge imperion-b2b-intake ACTIVE v3 and DB CHECK already permit EVENT_HOST, EVENT_PROGRAM and MEDIA_SPONSOR. Repository source was updated byte-for-byte to ACTIVE v3. Do not deploy stale v1 source or reset support for MEDIA_SPONSOR.
- Existing privileged intake bridge ACTIVE v4 excludes only MEDIA_SPONSOR while existing owner-bound Apps Script version/trigger runtime cannot be verified with current connector access.
- Run 41815012009 verified production public form HTTP200, staged HTML on public-origin Chromium and two real synthetic POSTs to Supabase API with proper on-screen UUIDs.
- Synthetic private source UUIDs: DATA_PILOT 09c4c318-ae3f-4820-8b7b-5fd3ba1b7000 and EVENT_HOST 8875af50-bb92-4fea-91c3-2ac17e73819a. Owner email and source contain no real customer data; no invoice, contract, payment, booking or marketing.
- Immediate source readback found 0 CRM IDs. After removing the strict QA-only unsupported EVENT_HOST record, the next original 5-minute importer run synced DATA_PILOT to one canonical Leads!A407 entry, matching source UUID and ACK 2026-11-04T10:44:20.582Z. This verifies ONLY the legacy offer path; EVENT_HOST / EVENT_PROGRAM delivery still BLOCKED, public site HOLD.
- Earlier new synthetic duplicate test fixture failed after form.reset, corrected service re-selection; subsequent Site quality browser+static CI passed at https://github.com/aliaksei-chareshneu/alchareshneu/actions/runs/41815905832 and /41815896941.
- Synthetic QA cleanup DONE: strict predicate deleted both test-only Supabase rows, after ACK cleared only synthetic Leads!A407:AF407 values without shifting real rows. DB exact IDs remaining=0, CRM row empty; immutable IMPERION receipts retain proof.

---
# Event Command website — release gate (staged 2026-11-04)

**State: P0 OWNER-GO FOR CODE AND SYNTHETIC TESTS; PUBLIC RELEASE HOLD ON EVENT CRM READBACK.** No real customer outreach, public site merge, invoice or payment executed in this effort. Existing backend v3 was already LIVE; repo was aligned, not deployed.

## Purpose, Project 00 / Project 10
Solve an organiser's real problems (keeping the programme clear, participants engaged and responsibilities explicit). Ground public trust in a named accountable OSVČ, transparent steps, nonbinding enquiry, real public evidence with legal-person separation. No claims that buyers pay any price, no fake organiser testimonials or unsupported corporate statistics.

## Files and owner
- `index.html` and `experience.js` — problem-first homepage with 4 languages, removal of stale AI-price headline and unverified Google review counters.
- `corporate/index.html` — Event Command / facilitator, clear 3 use cases, written scope, and a clearly attributed public association programme. The Brno Convention Bureau deep link was NOT independently accessible from verification tools; no independent third-party endorsement is claimed. Add outside validation later only after URL and permission readback.
- `corporate/request/index.html` — existing single corporate form, event-specific values EVENT_HOST and EVENT_PROGRAM, pricing cards secondary.
- `supabase/functions/imperion-b2b-intake/index.ts` — source aligned byte-for-byte to confirmed ACTIVE v3 (including MEDIA_SPONSOR); no Edge deploy. Do NOT treat repository source as runtime deployed.
- `ops/site-event-offers-go.sql` — existing CHECK constraint expansion, never run without separate approval.
- `imperion-intake-sync.gs` — extend the EXISTING authorised private CRM importer allowlist, keeping event offers in OSVČ Leads (not NGO). Source update is NOT an Apps Script deployment.
- `tests/corporate-intake.spec.cjs` — tests 4 language landing and simulated event enquiry API contract.

## P0: publication requires owner-authorised full E2E and independent readback
1. Inspect and approve public claims and the coordinated release. No event quote should be presented as an approved tariff before buyer qualification and rights/insurance/venue checks.
2. Apply checked DB constraint, deploy the reviewed version of existing Edge Function, and update the EXISTING bound Apps Script importer (no new trigger or CRM). Confirm GET health; test with approved non-personal test data (do not create fake business leads without separate test authorization), verify private intake record and existing Community Hub Leads classification.
3. Merge this review PR to main and verify deployed GitHub Pages, 4 languages, keyboard/mobile, form submission, private intake-to-CRM delivery, and attribution (source codes event_hero, event_process, event_proof). No PR/CI result by itself proves LIVE.

## Do not disturb
- Existing HEMA private-group enquiry `src=private_hema` and its valid 9,900 Kč quoted group offer.
- Non-event AI/Python/scientific categories, unchanged request backend fields and legitimate deep pages.
- GDPR, no marketing consent, rate limits, idempotency and private access.
- Community association `Družina Moravy z.s.` legally distinct from OSVČ.

## Acceptance
- No duplicate IDs, one main h1, all en/cs/ru/uk copy and links, non-event paths unchanged.
- DB + API and form accept both new event offer codes, actual `RECEIVED_UNCONFIRMED` receipt without payment/booking.
- Existing private importer places the event offer in existing CRM and an independent readback confirms it. If not: HOLD public release, fix importer mapping.
- Real traffic and paid results must be measured after release; design copy is hypothesis until measured.
