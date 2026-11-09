# IMPERION Cash Path — local QA handoff (09.11.2026 evening, Europe/Prague)

## Scope and evidence
- Repository: aliaksei-chareshneu/alchareshneu; fresh `main` clone at `63b054f7926b3ffcc9bad75cb8586f6a50f59263`.
- Morning independent Codex found Academy and BrnoWalkers P1 defects on `76045b0c`. Evening operator verified both defects persist in fresh GitHub main (Academy HTML blob `acd7a0de`, Walkers `8527a956`) and are not addressed by existing draft PR #239/#233.
- This is isolated local QA/repair on zmrzlina. Not pushed, not merged, not deployed, no public messages, PII, financial submission, or charge.

## Local repair
1. `academy/index.html`: first-screen CTA in EN/RU/CS/UK now says Request / enquiry instead of promising confirmed booking. An immediately visible localized disclaimer says enquiry is not booking or payment. The destination remains the previously approved Google Form. Existing draft self-service booking PR #239 was not touched.
2. `walkers/index.html`: all five current private-tour mailto links have neutral-year subject `BrnoWalkers private Brno tour enquiry` and `body=Source%3Dwalkers_private_tour`. Rates remain 3,500 CZK / 2h through 31 Dec 2026 and 3,900 CZK starting 1 Jan 2027. Existing Advent draft PR #233 was not touched.
3. `tests/cash-path-independent-qa.test.cjs`: 4 independent no-network tests prove Academy disclosure, Walkers handoff, consent/price/HTTPS Stripe gate and fail-closed digital checkout behavior.
4. `tests/imperion-public-gates.test.cjs`: repaired a pre-existing ineffective negative test. It used to replace the first approved form URL in Academy, although production audit reads the separate `navBookBtn` (WhatsApp) link. It now alters the actual `navBookBtn` HTML tag, proves an approved Academy Form is accepted, and an unrelated external form is blocked.

## Tests (fresh main with local patches)
- `node --test tests/imperion-public-gates.test.cjs tests/cash-path-independent-qa.test.cjs tests/druzina-enquiry-backend.test.cjs tests/registration-help-copy.test.cjs tests/rsvp-attribution.test.cjs tests/universal-rsvp.test.cjs tests/imperion-rsvp-source.test.cjs tests/imperion-registration-window.test.cjs tests/imperion-intake-bridge-source.test.cjs`
- **32 tests, 32 PASS, 0 FAIL** (09.11.2026 evening).
- `node ops/imperion-public-gates.cjs --json`: `status=PASS`, `checked=16`, `errors=[]`, `production_verified=false`, `cash_verified=false`.
- `git diff --check`: exit 0.
- Playwright visual/mobile/production HTTP live verification NOT DONE; dependencies absent from this fresh isolated checkout, no permission changes or new spending.

## GO and next step
- State: **LOCAL_REVIEW_READY**, NOT PR, NOT PUBLISHED, NOT LIVE, NOT CASH.
- Owner can authorize a draft GitHub PR and independent CI; merge or public deployment requires separate GO. Before any merge, rebase or cherry-pick onto current main and check conflicts with PR #239/#233.
- Owner's legal entity for Academy/Walkers is OSVC; no NGO financial mixing. Budget 0 CZK; no payment activity.
