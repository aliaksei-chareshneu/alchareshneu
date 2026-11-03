# Družina booking follow-up — 3 November 2026

**STAGED; PRODUCTION NO-GO; DONE not reached.** This change continues the existing `feat/druzina-booking-readback-20261102` branch at `7696df9fce852fc31448e64fc1f75726814c9594`. It does not replace the booking system or the Community Hub. Review against that branch, not as an independent replacement for PR #128. Its historical PR/deployment claims have not been freshly verified in this session.

## Current evidence / gap map

| Component | Current observation | Result |
| --- | --- | --- |
| Existing GitHub | HTTPS Git read succeeded; main observed at `eeae39ebaa1432e47e7577b6de9c1cef16dce23e`, growth-experience at `77a4f70f3d022a786154f790281406abe92ce2af` | EXISTS / Git read WORKS |
| Booking / billing | Recovered existing booking-readback and billing-account-staging branches, their p13 fixture and source fingerprints | EXISTS / local synthetic lifecycle WORKS |
| Original Fio | Located `FioBank.gs`, smoke test and integration guide in `feature/fio-ngo-readonly-20261016` at `baad3c7bb922e0eb873bb4f6c10fb5c0b5d56ee6`; NGO-scoped read-only importer is distinct from the staged portal adapter | EXISTS / deployment and token scope NOT VERIFIED; no bank request attempted |
| ZIP v2.1 | Prior report describes its Drive location; no original archive available in this checkout | NOT VERIFIED / not recovered in this session |
| Canon / Products / CRM | Six required Google sources are known from the user request; first 00 GLOBAL export blocked by proxy CONNECT 403, before Google authentication | Fresh contents NOT VERIFIED; do not use historical quotes as current approvals |
| OTP, Apps Script, Supabase | Source and prior report available; no owner-bound provider connection exposed to this task | Live deployment IDs/versions/properties, OTP delivery, CRM sync NOT VERIFIED |
| Pages source | GitHub API `/pages` and `/pulls` returned Forbidden; saved workflow/history cannot establish current settings | NOT VERIFIED; Pages source unchanged |
| Time conflicts | Reproduced overlapping different-ID bookings and settlement despite a conflicting booking | BROKEN before fix / fixed and tested STAGED |
| Private account | A raw VERIFIED booking could be presented as BOOKED without a unique matching bank payment | BROKEN before fix / fixed and tested STAGED |
| Operator view | Added authenticated read API in the existing dedicated Apps Script; aggregate counts, no personal roster | STAGED API; existing owner UI still needs integration |
| Paid UI / bank / calendar delivery | Source-only API, numeric VS and SPD string; local fake Calendar only | NOT VERIFIED externally; no hosted paid staging or complete OTP portal UI wiring |

The observed network policy is enforced, but its current custom-domain list remains empty. A draft adds `api.github.com`, `docs.google.com`, `www.googleapis.com`, `script.google.com`, `script.googleusercontent.com`, `aliaksei-chareshneu.github.io` and the existing `cmrknyhnnehyjpreehcf.supabase.co`. The draft tool reports `requires_publish=true`; saving a draft does not apply it. It grants no Google owner permission and no authority to enable payments.

## Changes

- `DruzinaFioBridge.gs` / `DruzinaFioCommit.gs`: under the existing lock, reject overlapping session intervals in a cart, existing own bookings and unexpired own holds. Replays exclude their own quote holds. Recheck conflicts before recording a synthetic bank credit. Duplicate session IDs, invalid intervals and malformed hold expiry require review; existing rights are never moved or cancelled.
- `DruzinaMemberAccount.gs`: BOOKED requires an OPEN session and unique recorded bank settlement belonging to the same member. Duplicate payment IDs or reused bank IDs, including another member's record, cannot confirm payment or produce a Calendar link. Cancelled sessions display CANCELLED. Bank IDs, other members and raw source rows never enter the response. This checks recorded evidence, not a fresh statement.
- `DruzinaBookingApi.gs`: public OTP-based `createDruzinaBankOrder` delegates to the existing locked quote/VS adapter. `getDruzinaBookingOperations` is admin-only and read-only: occupied/held/available places, unpaid/expired orders, recorded bank matches, active packages, review counts. Fewer than two confirmed participants produces a review flag and zero automatic cancellations. UI binding is not claimed complete.
- `RegistrationPortal.gs`: explicitly zero-price free events remain NOT_REQUIRED; blank/unknown prices do not become free through JavaScript coercion. Declined RSVPs never require payment. Existing separate safety/waiver fields remain separate.
- Existing Playwright configuration accepts an optional system Chromium path; existing CI adds the new financial/identity/conflict tests. No new service, CRM, schedule or agent network.

No current Products rows, prices, paid rights, bank settings, real records, production flags or deployments were changed. The 240 / 800 / +560 cases and 30-day validity are inherited **synthetic compatibility fixtures**, not a resolution of the current tariff conflict. Senior and other disputed products remain gated.

## Executed validation

- Ran every `tests/druzina-*.test.cjs` directly with Node: **99 passed, 0 failed, 0 skipped**. Includes wrong account/amount/VS, partial/overpayment/refund review, repeated bank movements, expired orders, absent consent/guardian/OTP, interrupted commits, upgrade credit, double no-show debit, six new overlap/interval cases, three API authorization/readback cases and duplicate financial identifiers.
- `node tests/universal-rsvp.test.cjs`: PASS, including actual synthetic form submissions with free/unknown prices and a declined RSVP; no fabricated waiver.
- Chromium / Playwright: **38 passed** across `imperion-rsvp`, `registration-catalog`, `registration-pending`, `druzina-fast-path`, `druzina-paths`. CS/EN/RU/UA and 375/390px mobile cases executed. Browser API responses are mocked; no production forms submitted.
- `npm run test:security`: PASS. `npm run test:dom`: **24/24 PASS**. `git diff --check`: PASS.
- Frozen `npm ci --ignore-scripts --no-audit --no-fund` succeeded twice, preserving dependency declarations and lockfile.

Separate readback command: `node scripts/druzina-staging-readback.cjs`. It runs actual recovered server functions and current extensions, then reconstructs account and operator responses from fake persisted Sheet cells rather than trusting a mutation receipt. It verifies **1 order, 1 payment, 1 booking, 1 Calendar event and 1 actual test check-in**; retries produce **0 duplicates**. Default runtime separately stays PAUSED. No network-capable bank service is installed in the harness. Google services, OTP mailbox and bank statement are synthetic; `providerReadback=NOT_PERFORMED`. This is local staging evidence, not independent Google/Fio evidence.

## Remaining work / access

Apply the saved environment network draft through environment settings (review/save, then publish the **development environment**). Recheck access; do not treat publication as payment GO. Then obtain authorized owner read access to the six canonical sources, current Products, dedicated Apps Script source and deployments, original ZIP, Supabase and actual Pages settings. No secret should be pasted into chat. Where owner MFA is required, use the owner's protected sign-in.

Finish the existing OTP portal UI binding (including QR rendering, account/operator screens), free-event-to-booking semantics against actual approved schema, cancellation/reschedule policies and notification/Calendar delivery checks against fresh source. No automatic reactivation or assumed duration/price approval. Hosted staging and real provider tests remain unrun. Financial/legal entity, receiving account, permitted service, insurance, per-date safety/capacity and current tariff approvals are prerequisites to any later explicit production GO. Real Fio operations require the owner's protected read-only account-watch binding and separate GO.

Reusable development `install_script` and `start_skill` were saved in the cloud-environment draft. They do not deploy or enable this application. Current dependencies and local workflow were tested; new-task snapshot restoration and configuration publication have not been verified.
