# Družina booking: staging implementation and readback, 2 November 2026

Status: STAGED / PRODUCTION NO-GO. This increment continues draft PR #128 in the existing repository. No production merge/deployment, Apps Script push, live registration, email, bank request, price activation, real-record migration, class cancellation or spending was performed.

## Audit / gap map

| Component | Evidence | Status |
| --- | --- | --- |
| Existing booking source | Located original v2.1 ZIP in existing Drive booking-system-code folder, later p4 archive, local p10 source and saved independent p13 source readback dated 2 Nov | EXISTS; saved source is not a fresh cloud pull |
| Public Apps Script portal | Independently opened existing /exec in browser: Training enquiries open, paid reservations paused, CS/EN/RU/UA options, no payment collected | WORKS as enquiry-only; genuine OTP/paid E2E NOT VERIFIED |
| Existing Community Hub | Read-only inspection of Products, deployment checklist, sheet metadata and bounded ID columns. Bookings and Consents have no populated IDs in A2:A100. Payments has two rows; these are not evidence of bank verification. Registrations has 55 IDs within A2:A100 | EXISTS; no real paid booking proven |
| Existing Supabase | browser-bridge ACTIVE_HEALTHY; seven ACTIVE Edge Functions including imperion-register v10 and intake-bridge v3. Aggregate query: 53 RSVP submissions, 53 with crm_synced_at | WORKS at backend metadata level; sync timestamp is not an independent row-by-row CRM receipt |
| Consent ingestion | Current main source already separates Safety_Acknowledged and Waiver_Accepted. Canonical technical handoff flags live bound importer as requiring source verification/repair | SOURCE FIX EXISTS; LIVE bound importer NOT VERIFIED; this PR does not rewrite historical consents |
| Fio | Existing NGO-only FioBank source located; existing PR128 Bridge/Commit/Proof modules reused. Original p12/p13 handoff and installed-source evidence reviewed | SYNTHETIC TESTED; real token permissions, bank statement and settlement NOT VERIFIED |
| Pages | Historical growth-experience is not assumed current. Provider run 41430453500 completed successfully from main SHA 165a887d7e923098c43b242168b7016701010af5 using pages-production.yml. Public Družina page opened. Settings/Pages returned 404 in available browser; connector does not expose Pages configuration | Successful main deployment evidenced; current Settings source NOT independently accessible; unchanged |
| Notifications / individual calendar invitations | Existing queues/calendar functions found; local calendar fake tested twice without duplicates | STAGED; actual reminders, delivery and participant invitations NOT VERIFIED |

Read canon: 00 GLOBAL MASTER, Project 80, Project 20, Canonical Booking Portal Specification, Canonical Website Facts, existing Community Hub. Documents contain conflicting historical and later tariff statements. Actual November Products are inactive, with later 120-minute and validity proposals. The 240/800/+560 policy is retained as an explicitly synthetic compatibility scenario; this does not ratify or activate it. Senior4 validity/prices and alternative packages remain gated. Existing paid rights are not repriced.

## Implemented components

- `DruzinaFioBridge.gs`: reject invalid expiry and conflicting same-bank-ID payloads; classify partial payment, overpayment, refund/debit, invalid/wrong VS, duplicate VS, repeated imports and expired orders for manual review; owner preview exposes these exceptions and performs zero settlements. Sanitize transport/JSON failures without leaking token-bearing URLs.
- Same module: member-bound idempotency reservation in existing Druzina_Requests under the existing reentrant script lock; stable requestId, cart binding, numeric unique VS, replay of the existing order, no duplicate holds. Interrupted processing stays reserved for owner recovery. No second order/CRM store: Order_ID is the existing Quote_ID. Replays recheck price, product activity and cutoffs before returning payment instructions.
- `DruzinaFioCommit.gs`: require individual consent/guardian evidence and currently active matching catalogue price before a new settlement; Starter credit requires an exact bank-referenced verified payment and actual checked attendance. Historical proof reconciliation retains the original contracted price.
- `DruzinaFioProofReconcile.gs`: later clearing cannot reopen a cancelled session, choose arbitrary duplicate safety evidence or bypass individual consent.
- `DruzinaFioReadiness.gs`: match the entire Czech BBAN, including account prefix, to the configured IBAN, rather than only its bank code.
- `DruzinaSafetyRelease.gs`: duplicate date/consent records fail closed; guardian classification/verification timestamps must be valid and not future-dated.
- `DruzinaMemberAccount.gs`: server OTP-bound account read API, ignoring caller-supplied member IDs; no private reads when verification is configured off. Bank-referenced payment state, separate booking/attendance state, per-person safe Calendar links. Fix double deduction: canonical Sessions_Used already includes no-shows, so remaining = total - used. Purchasing a package grants no statutory membership.
- Existing Site quality CI runs new statement-review and recovered-core integration tests. Existing localhost browser CORS fixture corrected; production CORS unchanged.

## Reproducible validation

`node --test tests/druzina-*.test.cjs`: **90/90 PASS**, including five integration scenarios executing recovered p13 functions with current staging extensions and an independent fixture-fingerprint readback. Eleven recovered core files retain original saved-source and LF-normalized Git SHA256 fingerprints; resource IDs in fixture Config are synthetic. No .clasp credentials or real member data are included.

Synthetic sequence: actual requestBookingCode/verifyBookingCode -> consent reviews -> authenticated quote -> numeric VS/SPD -> parsed synthetic statement -> exactly one payment/booking in in-memory canonical CRM -> existing session Calendar sync -> second sync creates zero duplicates -> authorized actual check-in -> one attendance increment. Same member can upgrade once for +560 after the verified 240 attended visit; exactly four total bookings and one plan. A separate actual-package test checks repeated NO_SHOW consumes one visit and leaves three of four.

All Google services in this sequence are in-memory fakes. The explicit future-release test substitutes the FALSE bank-adapter constant only in its isolated VM. Default recovered runtime remains paused. This is neither a hosted staging deployment nor real mail delivery, Fio verification or Google Calendar publication.

Browser regression: **251/256 initially passed**. Five failures were traced to a mocked CORS response allowing the production origin instead of localhost. After correcting only that fixture, affected `druzina-fast-path.spec.cjs` passed **10/10**, including all four enquiry languages on mobile. All 256 distinct browser scenarios have therefore been exercised successfully across those runs; no claim of one final all-green full-suite run. `test:security` PASS; DOM/language checks **24/24 PASS**. No browser test submits a real production registration.

## Remaining release blockers

1. Resolve conflicting tariff/product duration/validity approvals against current owner evidence; keep disputed products inactive. Do not treat the synthetic compatibility prices as permission to sell.
2. Independently verify the actual seller, permitted activity, insurance, per-date venue/staff/capacity, individual safety/guardian records and correct seller-specific receiving account. NGO Fio source must never receive an OSVČ token.
3. Verify and repair the live bound consent importer without fabricating waivers or overwriting historical evidence. This increment changes no production importer.
4. Integrate/review these source changes against a fresh owner-authenticated Apps Script pull, complete portal UI/API wiring and real OTP/privacy tests, and verify actual notification/invitation delivery. The cached fixture is not installation proof.
5. Only after separate explicit GO and protected owner connection, perform the controlled genuine OTP -> correct bank readback -> booking -> CRM -> calendar/receipt cycle and independent provider readback. Real bank tests were deliberately not attempted here.

Minimum next owner action: authorize a protected owner-side acceptance session for the existing portal and correct account, with payment release still OFF. Store any eventual account-watch token only in the existing private server properties, never in chat, GitHub or Sheets. This action unlocks verification; it does not itself constitute production GO or resolve missing legal evidence.

DONE is not reached. Production remains NO-GO until the real complete cycle and all release prerequisites are proven. Draft PR/source/CI alone cannot change this status.
