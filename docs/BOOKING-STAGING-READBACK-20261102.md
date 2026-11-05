# Družina booking and payment engine: staging readback, 5 November 2026

Status: SOURCE STAGED / PRODUCTION NO-GO. Draft PR #197 continues #128 in the existing repository. The current public Apps Script deployment remains enquiry-only. Nothing in this increment was pushed to Apps Script, deployed, merged, enabled in production, or used to contact participants or a real bank.

## Existing systems and current evidence

| Component | Evidence | Result |
| --- | --- | --- |
| Portal source | Owner-authenticated `clasp pull`, 5 Nov: 24 files. Eleven recovered core files match the LF-normalized source fingerprints; local preparation succeeds against the fresh source | Existing portal reused; prepared output has 35 files, no .clasp configuration and bankAdapterLive=false |
| Community Hub source | Owner-authenticated `clasp pull`, 5 Nov: 20 files, including both FioBank and FioOSVC. Both bank modules match their recovered fingerprints | Existing bank readers reused; four source files prepared, zero new bank clients or copied bank tokens |
| Consent ingestion | Fresh bound ImperionIntakeSync source explicitly writes Waiver_Accepted empty and Safety_Acknowledged separately. Bounded sheet read on 4 Nov found no populated waiver cells, 53 YES safety acknowledgements and two blank safety cells | Earlier live-source uncertainty resolved; no historical consent migration or fabricated waiver |
| Canonical CRM | Bounded read on 2 Nov: Registrations 55 IDs, Druzina_Bookings and Druzina_Consents zero IDs, Payments two rows | Existing tables retained; rows alone do not establish bank verification |
| Supabase | 2 Nov metadata: seven ACTIVE functions; 53 RSVP submissions and 53 crm_synced_at values | Existing intake retained; timestamps are not independent CRM receipts |
| Public portal | Existing /exec independently opened: enquiry-only, four language options, no payment collection. Deployment @9 is p12; fresh HEAD source is p13 | Real paid checkout / OTP / bank / receipt cycle remains unverified |
| Owner execution | Read-only source pull works. `clasp run drusFioOwnerReadiness` returned NOT_FOUND / server error reading storage | Owner runtime readiness was not proven; no properties or credentials were read or changed |
| Pages | Prior main deployment run 41430453500 succeeded at 165a887d7e923098c43b242168b7016701010af5. Current Settings/Pages source was inaccessible | No Pages setting or production deployment changed |

Canon consulted: GLOBAL MASTER, Project 80, Project 20, Canonical Booking Portal Specification, Canonical Website Facts and existing Community Hub. Historical tariffs conflict with later proposals. November Products remain inactive. The 240 / 800 / +560 amounts are synthetic compatibility examples, not permission to sell. No repricing of existing rights, cancelled-date reopening, membership grant or automatic class cancellation is introduced.

## Implemented behavior

- Existing portal now has additive CS/EN/RU/UA account and checkout source: email-code identity, products and confirmed dates, total before payment, approved seller/terms acceptance, offline QR Platba, numeric VS, pending bank status and explicit status refresh. The actual rendered SVG QR is decoded in browser tests. Tokens remain in memory; no screenshot is accepted as payment evidence.
- Private APIs bind orders and account records to the verified member. Existing rescheduling rules are reused. Cancellation creates one organizer request without cancelling or refunding a booking. An organizer panel adds aggregate payment, booking, attendance, package, capacity, minimum-group and exception counts without participant PII.
- Payment instructions require current owner-approved purchase terms and record acceptance version/time in existing Requests. Idempotent request/cart binding prevents duplicate holds and preserves interrupted work for recovery. Instruction expiry cannot exceed the applicable price cutoff.
- Existing Bridge / Commit / Proof reconciliation rejects invalid expiry, conflicting bank IDs, partial/extra/wrong-VS/refund evidence and ambiguous duplicates. Individual consent, matching active products, safe capacity and bank provenance remain mandatory. Later settlement cannot reopen a cancelled session. Cancelled-session display preserves the financial record.
- Existing Fio importers can attach an HMAC receipt to their existing Review_Notes column after the original account/parser validation. A separate portal worker validates seller, entity, account, signature, freshness and unchanged row values, then delegates settlement to the existing engine. The bank token stays in the existing Hub. Old unsigned rows are not silently migrated or trusted.
- The NGO bank entry point previously lacked an explicit caller-owner guard. The prepared source adds it. A separately gated native Apps Script import job verifies its trigger identity and private owner-bound file before calling an existing reader; direct non-owner invocation is rejected. This fix is staged, not installed live.
- Optional native five-minute import/reconciliation jobs are source only, independently gated and installed idempotently. Existing hourly maintenance is reused. No ChatGPT automation or actual trigger was created.
- Existing notification queue supports deterministic payment receipts and T-48 reminders in four languages. Queueing and delivery have separate disabled-by-default flags. Cancelled/rescheduled records suppress stale notices; missing guardian contact routes minors to manual review. Durable claims prevent automatic resend after uncertain mail delivery. No real mail was sent.
- Account remaining visits = total minus Sessions_Used, which already includes no-shows; repeat attendance processing does not double-debit. Full Czech IBAN/BBAN prefix validation and duplicate safety-evidence checks remain enforced.

## Validation

- `node --test tests/druzina-*.test.cjs`: **108/108 PASS** on 5 Nov.
- New browser suite: **5/5 PASS** on 5 Nov. Four mobile language flows execute the generated portal and actual server functions with fake Google services; the fifth verifies the default paid pause. QR pixels decode back to the displayed SPD, pending precedes bank proof, and the status changes only after synthetic bank reconciliation.
- Bank tests execute the recovered existing Fio GET reader with a fake HTTP response in a separate Hub context, its real parser/row constructor, signature validation and portal settlement. Repeated import produces exactly one payment and booking; the portal has no bank token. Trigger identity, entity mismatch, tampering, stale receipts and ambiguous delivery are covered.
- Recovered-core integration covers actual OTP functions, verified consent, quote, synthetic statement, canonical CRM, Calendar deduplication, attendance and the one-time Starter upgrade. All services and bank data in these tests are synthetic. The future-release VM substitutes the FALSE constant only inside the test; production source keeps DRUS_PAID_BANK_ADAPTER_LIVE=false.
- Earlier remote head 7696df9 passed Site quality run 41514495331, including 256 browser cases. This older result does not validate the new increment; final new-head CI is reported separately in PR #197.
- A broader local `tests/*.test.cjs` run had 112 passes and one unrelated localized hike-CTA failure in imperion-rsvp-source.test.cjs. Concurrent website/navigation edits are outside this booking change and are excluded from its commit. Clean remote checks determine the submitted revision's result.

## Release conditions still open

1. Approve current products, prices, duration and validity against the canonical owner decision; keep disputed offers inactive.
2. Establish the actual seller, authorized activity, insurance, per-date venue/staff/capacity and genuine individual/guardian consent evidence.
3. Review the prepared source and the exact protected configuration for the correct seller-specific receiving account, shared import attestation and approved terms. No credentials belong in chat, GitHub or Sheets. No bank token duplication is needed.
4. After separate explicit GO, install reviewed source/configuration in the existing projects and perform the controlled real OTP -> correct-bank readback -> booking -> CRM -> calendar/receipt cycle, followed by independent provider readback. Source tests cannot establish delivery or bank authorization.

DONE is not reached. This is a reviewable, tested source implementation, not a production launch or evidence that a real participant has paid and been booked.
