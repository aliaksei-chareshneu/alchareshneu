# Ecosystem experience update — review branch

Base: main at 11445ceb36a81964b6fb42059814c0c7b0724d8d.
Branch: growth-experience-2026-09-28.

This is a reviewable implementation, NOT a deployed or browser-certified release.
GitHub's connected integration rejected branch creation with 403 Resource not accessible by integration. Git CLI has no credentials. No production files or Pages settings were changed.

## Implemented
- Clear ecosystem homepage, localized photo cards and direct routes to services/events.
- Shared editorial design, responsive grids, readable type and visible keyboard focus.
- Academy goal selector and normalized subject search across all nine existing service categories; prices retained; contextual WhatsApp enquiry; referral offer restored as a valid destination.
- Three-step newcomer journeys, first Družina training clearly 120 Kč, cross-project discovery.
- Calendar: distinct empty/failure states, announcement links and public-calendar fallback; event time in Prague; malformed-record filtering, safe prices and registration URLs.
- Shareable ?lang= selection, persisted language, localized page metadata, corrected Academy/Calendar navigation.
- WebP derivatives (main_hero: 2,949,642 → 182,330 bytes); no automatic ambient-video loading; reduced motion; reserved image areas.
- Local conversion CustomEvents, without a vendor or external collection. Subscribe with document.addEventListener('ecosystem:conversion', handler). Payload: name, page, language, referrer hostname, placement, optional service ID. No search strings, PII, complete URLs or parameters. Registration completion is NOT tracked: the cross-origin Google Form needs its own completion integration.
- Apps Script webhook rejects empty secrets, missing submission identity and absent deduplication column; neutralizes spreadsheet formula text; returns generic public errors. Existing Calendar/Telegram/Facebook automation retained. Apps Script code must be deployed separately after its tests/review.

## Executed checks
- All five pages × EN/RU/CS/UK: 20 DOM execution cases passed, including language switches, unique IDs, local anchors, nine-category search and Družina prices.
- Inline/external JavaScript syntax and JSON-LD parsing passed.
- Static internal link targets and git diff --check passed.
- Webhook: empty/wrong secret rejection, input validation, duplicate suppression, spreadsheet formula escaping, checkbox handling and lock release passed.
- Event DOM checks in all four languages: malicious markup/URLs, prototype-like category keys, missing prices, malformed/past events, empty results and network-error fallbacks passed.
- Follow-up: missing event prices no longer display 0 Kč; service search expands matching subject details.
- Existing production inspected in Chrome (Home, Academy, Družina, Calendar). Public calendar displays events; event cards fell back to the calendar in that browser. This is baseline inspection, not validation of this branch.

## Required before merge
- Run npm ci; npm run test:dom; npx playwright install --with-deps chromium; npm test.
- Prepared browser suite: 100 page/language/viewport combinations (360/390/430/768/1440), plus persistence/history, malformed event input, API error and timeout checks. Suite is NOT executed in this session. Review screenshots for visual layout/contrast, verify real links and form entry points without submitting registrations, and check console/network errors and performance.
- Verify disputed/unsupported legacy trust claims before publishing. Numeric ratings and unsourced hero testimonials are not used in new hero content. Existing legacy footer audience figures remain owner-provided, not independently verified.
- Fetch main immediately before integration; preserve concurrent work. CI must pass before merge.
- Keep GitHub Pages main / root. Verify live deployment in Chrome after merge.
- No measured conversion lift, Lighthouse/Core Web Vitals score or production readiness is claimed.

## Apply safely
The accompanying git bundle contains only this branch's commits and requires the base commit in the existing repository.

```sh
git fetch origin main
git fetch /path/to/growth-experience.bundle growth-experience-2026-09-28:review/growth-experience
git switch review/growth-experience
npm ci
npm run test:dom
npx playwright install --with-deps chromium
npm test
```

Use a PR to integrate after tests and visual review. Do not replace main/index.html with a stale standalone file.
