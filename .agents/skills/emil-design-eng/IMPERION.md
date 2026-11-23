# IMPERION site integration (22 November 2026)

Source: [Emil Kowalski's design engineering skill](https://github.com/emilkowalski/skills/tree/64eb3deb9a5fbfa041faf783e0bc3fd635872e9c/skills/emil-design-eng), pinned to upstream commit `64eb3deb9a5fbfa041faf783e0bc3fd635872e9c`. License: MIT (included in this directory). Instructions only — not a JS package and not a paid service.

## Existing implementation: reuse, do not re-install
- Motion/mini: isolated entry animations bundled into the Družina pages by `site-viz`.
- Anime.js: staggered card animation in the existing Družina enhancement.
- Recharts + **shadcn-style composition**: accessible React island on `druzina/ranks.html`. This is not a full shadcn/ui install.
- See merged [PR #378](https://github.com/aliaksei-chareshneu/alchareshneu/pull/378) and its tests for the actual implementation.

## Applying the fourth design input
- The skill is a design review lens for layouts, typography, transitions, micro-feedback, and accessibility. It does not add a fourth website runtime.
- Homepage polish belongs in the existing `visual-first.css` / `conversion-frontdoor.js` surface, coordinated with draft [PR #382](https://github.com/aliaksei-chareshneu/alchareshneu/pull/382). Do not add a competing theme.
- Prefer native CSS feedback: explicit transform/color properties, meaningful easing, pointer-only nonessential movement, no keyboard delay or hidden content, and `prefers-reduced-motion` behavior.
- Do not load Motion, Anime.js or a chart bundle globally unless a concrete UI task demonstrates an advantage that outweighs network, CPU and maintenance cost.
- Keep the three customer routes (Academy, Družina Moravy, BrnoWalkers), four main languages (CS/EN/RU/UK), truthful CTAs, OSVČ/NGO boundary and existing registration/payment paths intact.
- Verify with Playwright, mobile 320/390px, keyboard, no-JS fallback, reduced motion, source links and production readback after authorized merge. Passing CI or an open draft is **not** proof of live conversion.

Cash/cost: 0 Kč new dependencies; visitor bookings, payments and personal NET not verified by this document.
