# IMPERION cinematic design checkpoint — 12 November 2026

Case_ID: IMP-WEB-CINEMATIC-ROLLOUT-20261112
Owner GO: “Делай давай, делай.”
Pre-change published main: `0f298d8e4ed0a86c8363f37cf6c4e8f88e1a205f`
Reference design: approved earlier cinematic hero and calendar mockups, *not* screenshots of live content.

## Non-negotiable visual rules

- Czech is the clean-URL default; explicit language parameters still work.
- Hero has historical/fantasy atmosphere from owned/approved imagery, amber-on-deep-teal treatment and legible text.
- Primary CTA **dark text on yellow**, no white text on gold; secondary CTA light text on deep background.
- Readable sans-serif body text, restrained Georgia serif headings.
- Event calendar retains verified event dates, time, price, type and click-to-open details. No fabricated public events.
- Desktop event modal is centered, roughly 920 px wide with photograph and content side-by-side when space allows.
- Mobile event detail remains a bottom sheet, independently scrollable.
- Conditions and payment contacts appear only after intentional expansion. Never claim a form/PDF equals a bank-verified payment.
- Družina Moravy z. s. and OSVČ controller boundaries unchanged, no merged payment account.
- Comic-Con QR PR #269 remains independent; this design task does not authorize its release.

## Implementation

- `conversion-frontdoor.css`: contrast, type and responsive desktop event modal.
- `imperion-cinematic-site.css`: opt-in design system for public section pages; `data-imperion-design` indicates the theme.
- 40 section pages: stylesheet injected at end of head, theme only on body; no changes to the pages’ JS registration/price logic.
- Existing relevant imagery: `images/hero-scholar.webp`, `images/hero-knight.webp`, `images/hero-ranger.webp`, `images/main_hero.webp`, `images/walkers_group.webp` and approved `images/imperion-hero-cinematic-20261112.webp`.
- Production Pages whitelist and live readback must include the new CSS and representative nested routes.

## Release gate

Run existing security, DOM and frontend CI, the 40-route Playwright suite `tests/cinematic-sitewide-ux.spec.cjs`, plus direct GitHub Pages production readback. Do not call it LIVE before both deployment and HTTP inspection succeed. Report unrelated legacy test failures separately.

Rollback: use the GitHub commit immediately before merging this PR, or selectively remove `data-imperion-design` and its stylesheet link; prior routes, functions and controllers are untouched.

Time, date and status: Europe/Prague; record merge SHA and final LIVE readback in existing 00 CHANGELOG / 03 EXECUTION.
