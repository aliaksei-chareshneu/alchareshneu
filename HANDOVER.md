# Handover — Moravian Host / Družina Moravy Website

**Read this first.** This document is self-contained — written so an AI or
developer with zero prior context on this conversation can pick this up
and understand the current state, what changed, why, and what's left.

---

## 1. What this is

Static site on GitHub Pages for a solo entrepreneur (Aliaksei Chareshneu,
Brno, Czech Republic) running three ventures under one umbrella:

- **Eternal Learning** — PhD-level tutoring (top revenue source)
- **BrnoWalkers** — guided hikes, cave tours, city walks in Moravia
- **Družina Moravy** — HEMA (historical fencing) & LARP club

Live URL: `https://aliaksei-chareshneu.github.io/alchareshneu/`
Stack: vanilla HTML/CSS/JS, **no build step**, **$0 hosting** (GitHub
Pages). Backend automation lives in a separate `Code.gs` (Google Apps
Script) — **not part of this handover, not touched, do not rewrite it**
(see §7).

## 2. The problem this work solved

The site originally rendered 100% via JavaScript — `<body>` shipped as an
empty `<div id="app">`, filled entirely by `innerHTML` after page load.
This meant:
- Any crawler that doesn't execute JS saw a blank page
- Tabs were hash-routed (`#walkers`, `#druzina`) — Google treats
  `/`, `/#walkers`, `/#druzina` as the *same URL*, so BrnoWalkers and
  Družina Moravy could never independently rank in search
- The page had grown very content-heavy (full pricing catalog, FAQ,
  subject list, rank ladder) with no way to find one specific thing
  without scrolling past everything

Fixed, in order: made real content exist in the raw HTML (crawlable
without JS) → gave Walkers/Družina real separate URLs → added a search
that jumps straight to the exact price instead of requiring scroll.

## 3. File manifest — what's in this handover

| File | What it is |
|---|---|
| `index.html` | Main umbrella page. All three ventures. ~4,500 lines. |
| `styles.css` | Full shared stylesheet, extracted from what used to be an inline `<style>` block in `index.html`. All three HTML files link to this — **don't let them diverge into separate stylesheets.** |
| `walkers/index.html` | Standalone, real, separately-rankable BrnoWalkers page. Own title/meta/canonical/schema. |
| `druzina/index.html` | Standalone, real, separately-rankable Družina Moravy page. Own title/meta/canonical/schema. |
| `sitemap.xml` | Lists all three real URLs. |
| `verify.js` | **Dev tool, not part of the site.** `jsdom` harness that loads `index.html`, stubs the browser APIs it needs, runs `render()`, and checks the real resulting DOM for duplicate ids/missing elements/broken functions. Run with `node verify.js index.html` (needs `npm install jsdom` first). Don't upload this to the repo root — keep it wherever you're doing verification, or delete it. |

Deploy by placing the first five files at the repo root, preserving the
`walkers/` and `druzina/` subfolders exactly. GitHub Pages serves
`folder/index.html` automatically for `folder/` — no config needed.

**Not included here, already exist in the real repo, don't need
touching:** `Code.gs`, `appsscript.json`, images, favicons,
`site.webmanifest`, `robots.txt`, `404.html`.

## 4. Architecture — how `index.html` actually works now

### The core split: static vs. dynamic

```
<body>
  <nav>...</nav>                          ← static, unchanged
  <div class="tabs-bar">
    <div id="tabsNav"></div>              ← JS-filled (nav button highlight only)
  </div>

  <main id="static-content">              ← REAL HTML, exists before any JS runs
    <section id="main">...</section>          Main hero + trust strip + venture picker
    <div id="main-dynamic"></div>             ← JS fills: reviews, matrix table, etc.
    <section id="pricing">...</section>       All 10 pricing categories, full content
    <section id="walkers">...</section>       Walkers hero + facts + event types + about
    <div id="walkers-dynamic"></div>          ← JS fills: calendar embed, board games
    <section id="faq">...</section>           All 12 FAQ questions
    <section id="druzina">...</section>       Družina hero + facts + schedule + onboarding
    <div id="druzina-dynamic"></div>          ← JS fills: tariff table, contacts, ecosystem
    <section id="ranks">...</section>         Rank ladder, roles, conduct/discipline
    <section id="terms">...</section>         Shared legal terms (both ventures link here)
    <section id="canoe-safety">...</section>
    <div id="site-footer"></div>              ← JS fills: footer
  </main>
</body>
```

**The rule:** anything a search engine or a first-time visitor should see
immediately lives as real HTML in `<main id="static-content">`. Anything
still genuinely dynamic (live calendar embed, content not yet migrated)
renders into a named placeholder `<div>` positioned where it belongs.

### `render(lang)` — what it does now

Used to: fully rebuild `#app` based on `currentTab` (only one tab's
content existed in the DOM at a time).

Now: runs once on load and again on every language switch. Does **not**
touch `<main id="static-content">` at all. Only fills the `*-dynamic`
placeholders and the footer, using the *same* `renderMainTab()` /
`renderWalkersTab()` / `renderDruzinaTab()` functions as before — those
were trimmed down to only the pieces that are genuinely still dynamic
(see the `TRIMMED for static-first migration` comments at each function).

**Important:** all three ventures' dynamic content now renders on *every*
call, not gated by `currentTab` — there is no more "current tab"
content-wise. `currentTab` only drives nav-highlight state and where
`switchTab()` scrolls to.

### `switchTab(tabId, sectionId)`

Used to: destroy and rebuild `#app` for the clicked tab.

Now: updates `currentTab`, pushes history state, toggles the active nav
button, and calls `document.getElementById(sectionId || tabId).scrollIntoView()`.
Each venture hero's `id` matches its `tabId` exactly (`id="main"`,
`id="walkers"`, `id="druzina"`) so no lookup table is needed.

### `initScrollReveal()`

Selector widened from `#app section` to `#app section, main#static-content section`
so it also catches the new static sections. Made idempotent (filters out
already-`reveal`-classed elements) since the static sections now persist
across language switches instead of being destroyed and rebuilt — without
that filter, every language switch would stack a duplicate
`IntersectionObserver` onto the same elements.

### Translation system

`data-i18n="some.key"` attributes on static elements + `applyTranslations(lang)`
(called from inside `render()`) walk every `[data-i18n]` element and set
its `innerHTML`. Resolution isn't a naive `T[lang][key]` lookup — it goes
through `resolveI18nValue(key, lang)`, which:
- Special-cases `reviewsBadge` → `REVIEWS_BADGE_TEXT[lang]` and
  `pricing.*` → `PRICING[key][lang]` (these live in separate top-level
  consts, not under `T[lang]`)
- Checks `STATIC_ADAPTED_I18N[key]` for genuinely new copy written during
  this migration that doesn't exist in the original `T[lang]` object
  (longer, more SEO-adapted phrasing than the original shorter strings)
- Falls back to a dotted-path walk into `T[lang]` for everything else

**Five entries in `STATIC_ADAPTED_I18N`** (`main.title`, `main.tagline`,
`walkers.title2`, `ui.druzinaName2`, `pricing.title2`) have AI-drafted
ru/uk/cs translations — **flagged for native-speaker review**, since ru
is this project's primary audience per the original brief.

### Service finder

`SERVICE_INDEX` (built by `buildServiceIndex()`) is **not a hand-maintained
list** — it's built by walking the live DOM at page-load time: every
2-column `<tr>` inside a `.price-cat` table, every `.event-card`, every
`.subj-card` (plus its sub-item text as searchable `keywords`, since
specific terms like "Python" or "IELTS" only appear as sub-items, not
card titles). This means it can never drift out of sync with the actual
displayed prices — if you edit a price in the HTML, the index picks it up
automatically on next load.

`renderFinderResults(query)` filters on name/category/keywords substring
match, renders up to 6 results. Clicking a result calls
`jumpToService(elId)`, which walks up through any `<details>` ancestors
and opens them (generic — works for both the pricing-category collapse
below and any pre-existing accordion), scrolls to the element, and pulses
a `.svc-highlight` CSS animation so the answer is unmistakable.

Rebuilt on every `render()` call (language switch) via
`SERVICE_INDEX = buildServiceIndex()` inside `render()`, so search stays
in the currently-active language.

### Pricing category collapse

`collapsePricingCategories()` wraps everything after each `.price-cat`'s
title/subtitle into a `<details class="price-cat-details">`, applied
**uniformly via JS** to all 10 categories rather than hand-restructured
per category — can't drift out of sync with any one category's internal
markup. One deliberate exception: **Tutoring's subject catalog
(`.academy-subjects`) stays outside the collapse** — it's a compact,
scannable card grid, genuinely different from the long price tables that
were the actual bulk problem, and it's what most subject-name searches
jump to. The anchor logic in `collapsePricingCategories()` explicitly
prefers `.academy-subjects` over the title/subtitle when present.

Idempotent (`cat.dataset.collapsible === 'done'` guard) — safe to call
more than once.

### Trial price (date-aware)

Real, confirmed price change: HEMA trial training is **100 Kč through 31
August 2026, 120 Kč from 1 September 2026** (previously it was free —
that's now wrong everywhere and was corrected). Every mention on the site
uses `<span class="trial-price-auto">100 Kč</span>` instead of a
hardcoded number. `getTrialPrice()` checks the date against the Sept 1
cutoff; `updateTrialPriceDisplays()` sets the text on every matching span.
Called both on initial load and from inside `render()` (some of the
15 instances live in still-dynamic `T[lang]` strings that get regenerated
on every language switch, which would otherwise silently reset the price
back to the static "100 Kč" fallback baked into those strings).

**This was an exhaustive, multi-pass fix** — the same "first training is
free" claim existed in at least three independently-authored forms across
the codebase (the original `T[lang]` data object, a hand-paraphrased
version in the static hero, and orphaned dead-code copies in sections
that had already been made static). Don't assume a single find-and-replace
catches everything if this needs touching again — grep broadly, in every
language, including partial phrasings.

---

## 5. What's done (comprehensive)

- **SEO:** `LocalBusiness` JSON-LD (geo coordinates are an approximation —
  see §6), `FAQPage` and `Event` structured data generated from live data
  (`injectFAQSchema()`, `injectEventSchema()`), viewport fix for the
  sticky mobile CTA, `sitemap.xml` trimmed to real URLs only
- **Static content, all real, all in the raw HTML:** all three venture
  heroes with trust signals, both facts/About sections, all 10 pricing
  categories in full (base rates + every package tier + special
  programs), the full `ACADEMY_SUBJECTS` catalog, Combo
  Packages/Loyalty/Gear Rental, shared legal Terms. Event types, Walkers'
  About/Rules, Canoe Safety, FAQ, Schedule, Onboarding, Rank
  ladder/Roles/Conduct used to be static here too — see the duplication
  fix below for why they moved.
- **Real per-venture URLs:** `walkers/index.html` and `druzina/index.html`
  exist as actual separate pages with their own metadata and schema, and
  now carry the *only* copy of the content listed above
- **Content-duplication fix (done this session):** the main page's
  Walkers/Družina sections that duplicated `walkers/`/`druzina/` verbatim
  (Event Types, Walkers' About, Walkers' Rules, Canoe Safety, FAQ,
  Schedule, Onboarding, Rank ladder, Roles, Conduct/Discipline) were
  removed from `index.html` and replaced with a short callout + link to
  the dedicated page, placed right after each venture's (unchanged) hero
  and facts/About section. `injectFAQSchema('walkers')` was also removed
  from `index.html`'s JS — it was emitting FAQPage schema for FAQ content
  that no longer appears on that page, which is exactly the
  schema/visible-content mismatch Google's structured-data guidelines
  warn against; `walkers/index.html` already carries its own correct
  FAQPage schema tied to its own visible FAQ. The hero art/animations,
  facts grids, and both dynamic-content placeholders (`walkers-dynamic`,
  `druzina-dynamic` — Medals, the live calendar embed, Board Games,
  Tariff, Payment, Ecosystem, Contacts) were **not** touched.
- **Service finder taught about the moved content:** searching e.g.
  "canoe" or "rank" on the main page used to jump to an in-page element;
  now that element doesn't exist on this page, so `buildServiceIndex()`
  gained nine hand-written entries (one per moved section) that carry a
  `url` instead of an `elId`. `jumpToService`'s caller now checks for
  `dataset.url` first and navigates (`window.location.href`) instead of
  scrolling. See §7 for the maintenance implication.
- **Decorative hero animations** (floating notebook/pencil, walker
  figure/clouds, campfire particles) restored — content was prioritized
  first, decoration added back once content was solid. Left fully intact
  during the duplication fix, deliberately — see above.
- **Language switching** works for the new static content, not just the
  legacy dynamic pieces — verified by actually executing the resolution
  logic, not just reading the code
- **Service finder + pricing collapse** — verified via `jsdom` (see §8)
- **Trial price correction** applied everywhere, exhaustively verified
- **"Shortest path to payment/arrival" pass (done this session)**,
  requested directly by the site owner — everything reuses existing CSS
  (`.mobile-cta`, `.hero-ctas`, `.callout`, `.btn`), nothing new added to
  styles.css except one `margin-top` on `.hero-secondary-row`:
  - **Site-wide sticky CTA activated.** `.mobile-cta` already existed in
    `styles.css` and was already wired up on `/walkers/` and `/druzina/`
    — but never on the main page. Added the matching markup + a small
    `initMobileCta()` (hides while `#main` hero is in view, shows once
    scrolled past) so a one-tap "Register / Book" + WhatsApp icon is
    always in reach on the main page too, in every language.
  - **Main hero got its own primary CTA.** It previously had *zero*
    action buttons — only trust badges (reviews, alerts) — unlike
    `#walkers`/`#druzina` which both have `.hero-ctas`. Added "See
    pricing & book →" (`#pricing`) + a WhatsApp button, so a first-time
    visitor who doesn't scroll as far as the service finder or venture
    picker still has something to click immediately.
  - **Quick-pay callout added near the top of `#pricing`.** The real
    Payment info (Revolut link, booking buttons) already existed but
    only at the very bottom of `#pricing`, past nine full category
    tables plus Combos/Loyalty/Gear/Cancellation. Someone arriving at
    `#pricing` via the new hero CTA, the venture picker, or the service
    finder had to scroll past all of that just to find out *how* to
    pay. Surfaced the same real info immediately in a `.callout`; the
    full breakdown further down wasn't touched — one click away via
    `#pricing-payment`, not deleted. New translation keys added to
    `STATIC_ADAPTED_I18N` (`pricing.quickPayLabel/quickPayNote/
    fullPaymentInfo`) — same "draft, not native-reviewed" caveat as the
    rest of that object.
  - **Event cards get one-click directions.** Each upcoming-event card's
    location name is now a link to a Google Maps search for that exact
    text (`ev.locationName`, real live data — no coordinates invented),
    not just a plain `<span>`.
  - **Družina teaser surfaces schedule + address with zero clicks.** The
    link-out callout added during the duplication fix (see below) now
    also states the fixed schedule (Mon/Thu/Sat 18:00) and venue address
    directly, plus a "Get directions" Maps link — the one fact genuinely
    needed to show up, as opposed to the deeper Rank/Roles/Conduct
    content that's still one click away on `/druzina/`. BrnoWalkers
    wasn't given the same treatment: it has no single fixed venue (varies
    per event), so there's nothing analogous to surface here — that's
    what the event cards' new directions links are for instead.
  - Registration itself still goes through the Tally form (events) or
    the Google Form (`REGISTER_FORM`, everything else) — deliberately
    **not** shortened to a raw Revolut link, since payment tracking
    depends on the `Full_Name – Event_ID` reference generated from that
    form submission (see `Code.gs`); skipping the form would break
    reconciliation, and that's Phase 3 territory regardless.
- **Tabs bar no longer hides behind the nav on scroll (done this
  session).** `.tabs-bar` (main/BrnoWalkers/Družina) sticks right below
  `.nav` using a hardcoded `top:55px` — but `.nav`'s real height varies:
  the bilingual brand text wraps to a different number of lines per
  language, and on narrow phones the brand + 4 language buttons + audio
  toggle + Housing button can wrap across multiple lines too. Whenever
  the real nav was taller than 55px, `.nav` (z-index:50) stuck on top of
  and covered the top portion of `.tabs-bar` (z-index:45) — this is what
  was reported as "tabs tend to hide while scroll down". Fixed with a
  `--nav-height` CSS custom property (default `55px` in `:root`, real
  value written by a small `initNavHeightSync()` in the JS) that
  `.tabs-bar{top:...}` now reads instead of a hardcoded number.
  `ResizeObserver` on `.nav` keeps it correct automatically — window
  resize, orientation change, font load, or a language switch changing
  the brand text length all re-trigger it, no need to hook it into
  `render()` separately. Only touches the main `index.html` +
  `styles.css`; the dedicated `/walkers/` and `/druzina/` pages have
  `.nav` but no `.tabs-bar` underneath it, so nothing there could
  exhibit this bug in the first place.
- **Page reordered — pricing moved right after the venture picker (done
  this session).** The site owner's follow-up feedback after the
  shortcuts above ("sticky CTA / hero CTA / quick-pay callout") was that
  the page was "still a portyanka" (still a long haul). Those shortcuts
  only help someone who clicks a button — anyone who just scrolls
  normally still had to pass eight full sections (intro video, upcoming
  events, academy priority, policy, About-the-founder, reviews, activity
  matrix, conversion cards — everything `renderMainTab()` outputs into
  `#main-dynamic`) before ever reaching a price. The fix: moved the
  **empty `<div id="main-dynamic"></div>` placeholder** itself from right
  after the venture picker to right after `</section>` closing
  `#pricing`. That's it — a one-element move, not a rewrite. `render()`
  still does `document.getElementById('main-dynamic').innerHTML =
  renderMainTab(lang, t)` exactly as before; JS doesn't care where in the
  DOM that div physically sits. New page order: hero → trust-strip →
  service-finder → venture-picker → **pricing** → intro
  video/events/reviews/etc. → BrnoWalkers → Družina → terms → footer.
  Verified in `jsdom` with `compareDocumentPosition` (not just "both
  elements exist somewhere" — actual document order), see §8.
  **Deliberately not done in the same pass** (would need a business call,
  not just a mechanical move): trimming content *within* `#pricing`
  itself (still 9 full category tables, even though collapsed by
  default) or within the now-pushed-down `#main-dynamic` block (e.g.
  whether `matrix-activities` is redundant with the pricing tables
  themselves). Flagged as the next candidate if the page still feels
  long after this.
- **Družina rank IV bracelet color: green → orange**, per the site
  owner's note (bracelet colors were reconsidered; green is now a
  separate "Senior tier" status marker unrelated to rank, not yet
  reflected on the site — see below). Fixed in the one place this is
  actually live and visible: `druzina/index.html`'s rank table (English,
  no language switcher on that page — see §2's static-first migration
  note, this table stopped being multi-language along with everything
  else that moved off `index.html`). Also fixed the same field in the
  **orphaned** `RANKS` JS array still sitting in `index.html` — confirmed
  via search that `renderRanksElement()` (the function that used to
  render this array) no longer exists anywhere in the script, so this
  data currently has zero effect on anything rendered. Updated anyway,
  in all 4 languages, so it isn't a stale landmine if it's ever revived.
  Red/blue/black+gold were left untouched, as instructed. **Not done**
  (needs the owner's decision, not just a color swap): adding the new
  green "Senior tier" status marker anywhere — the note flagged
  `#tariff` (Junior/Senior tier table, §II) as the logical spot if he
  wants it added, but that's new content, not a fix, and pricing-table
  wording is exactly the kind of thing this project's global directives
  say to confirm rather than invent.
- **Three-way venture fork added directly in the main hero (done this
  session).** Follow-up to the reorder above: "give a fork to
  Ecosystem/BrnoWalkers/Družina right from the first screen." The actual
  fork (`.venture-picker`, with full descriptions) already existed, but
  a full scroll down — past the hero, trust-strip, and service finder —
  so on most phones it was below the fold on first load. Replaced last
  session's 2-button hero row (Tutoring pricing + WhatsApp) with three
  buttons — Tutoring/BrnoWalkers/Družina Moravy — the same three
  destinations as the picker, just also reachable with zero scrolling.
  The picker itself wasn't touched; it's still there for anyone who
  scrolls a little and wants the fuller description before choosing.
  WhatsApp dropped out of the hero specifically (still in the sticky CTA
  the moment you scroll, and in the footer/contacts) — three buttons
  plus WhatsApp felt like one too many for a first screen. New
  translation key `ui.forkTutoring` added in all 4 languages (reuses the
  word already established in `pricing.title2`); `ui.heroSeePricing`
  from last session removed since nothing points to it anymore — didn't
  want to leave two competing "unused string" landmines side by side.
  BrnoWalkers/Družina Moravy kept as literal brand names (not
  translated) to match `.venture-picker`'s own card titles right below —
  having the hero fork say something different from the card for the
  same destination would read as a bug.
- **Audit: is the site actually static HTML, and do anchors actually
  work? (done this session, in response to a direct ask)** Answer for
  both: **mostly, not entirely** — verified by literally stripping every
  `<script>` tag from each file and checking what's left, not by
  assuming the earlier "static-first migration" finished everything it
  set out to.
  - `walkers/index.html` and `druzina/index.html`: **fully clean.** 100%
    of visible content survives with zero JS, and every single in-page
    anchor (`#event-types`, `#faq`, `#schedule`, `#ranks`, etc.) resolves
    to something that's actually there pre-JS. No changes needed.
  - `index.html`: **partially static.** Everything in `<main
    id="static-content">`'s literal markup — hero, trust-strip,
    service-finder, venture-picker (+ the new hero fork), all 9 pricing
    categories, combos/loyalty/gear/cancellation/payment, terms — reads
    fine with zero JS. But `#main-dynamic`, `#walkers-dynamic`,
    `#druzina-dynamic`, and (until this session) `#site-footer` were
    **100% empty** in raw HTML — meaning academy-priority, policy,
    leader-about, reviews, matrix-activities, conversion cards, medals,
    the live calendar, board games, the HEMA tariff table, payment
    sub-rules, ecosystem links, **the entire footer, and (until this
    session) all contact info** were invisible to anything that doesn't
    execute JavaScript. That's a real gap against the original SEO-
    overhaul goal ("static HTML, not 100% JS-rendered"), which this
    migration never fully finished — not a regression from this session's
    other work, but not something to leave unflagged either. Of the 21
    in-page anchors on this page, 10 pointed into that JS-only content
    (`#tariff`, `#reviews`, `#medals`, `#leader-about`, etc.) — those
    still work fine for a normal visitor with JS enabled (`render()` runs
    within milliseconds of page load), but would silently fail for a
    direct external link straight to that hash fragment, or for a crawler
    that doesn't execute JS at all.
  - **Fixed this session** (the two most business-critical gaps of that
    kind): `#site-footer` (all primary contact/conversion CTAs, on every
    single page load) and the Contacts part of `#druzina-dynamic` (email,
    phone, WhatsApp, Telegram for all three ventures) are now static
    HTML, byte-matched against what the JS itself generates for English
    (verified with a Python script replicating `renderContactsGrid()` and
    `detectContactIcon()`'s exact logic, not hand-typed from memory).
    Also converted the BrnoWalkers calendar embed (`#walkers-schedule`) —
    trivial since it's just a static `<iframe>`, no per-language data
    involved, and directly relevant to the earlier "shortest path to
    arrival" work (a visitor without JS had no way to see the schedule at
    all before this). In each case, the matching block was **removed**
    from the JS render function (`render()`, `renderDruzinaTab()`,
    `renderWalkersTab()`) so there's no duplicate id — verified zero
    duplicate ids in the live DOM both before and after, via `verify.js`.
  - **Not converted (flagged, not done)** — same technique would apply,
    just needs the same careful byte-matching effort repeated per
    section: `academy-priority`, `policy`, `leader-about`, `reviews`,
    `matrix-activities`, `conversion` (all in `#main-dynamic`); `medals`,
    `boardgames` (in `#walkers-dynamic`); `tariff`, `druzina-payment`,
    `ecosystem` (in `#druzina-dynamic`). Rough priority if this continues
    next session: `tariff` (real HEMA pricing — same "can't see the price
    without JS" problem the earlier pricing work was about) and
    `leader-about` (PhD/credentials — the core trust signal for Tutoring)
    are the two with the most SEO/trust value; `medals`/`boardgames`/
    `academy-priority`/`policy`/`conversion` are lower-stakes filler-ish
    content. `#upcoming-events` is a **deliberate exception** — it pulls
    live data from `EVENTS_API_URL`, so it genuinely can't be static; the
    honest fix there would be a static fallback message ("see the full
    calendar at walkers/#schedule") rather than real content.
- **"Fix buttons — they don't lead to pages" (done this session).** The
  static-HTML audit above found the missing content; this found the
  other half of the same underlying problem — several buttons meant to
  take someone to the actual BrnoWalkers/Družina Moravy content were
  `<button onclick="switchTab('walkers'|'druzina')">` with **no `href` at
  all**. Two compounding issues: (1) zero default behavior without JS —
  clicking did literally nothing, not even a same-page scroll: buttons
  have no native navigation, unlike `<a>`; (2) even WITH JS, `switchTab`
  just scrolls to the on-page hero teaser (a short callout that itself
  links out) — not the actual content the button's own label promises,
  since that content moved to the dedicated pages during the earlier
  duplication fix. Fixed everywhere found, all converted to real `<a
  href="walkers/">` / `<a href="druzina/">`:
  - The new static Contacts section's "Go to BrnoWalkers" CTA (this
    session's own addition, inherited the bug from the JS it was copied
    from — introduced and fixed in the same session)
  - Both "Open BrnoWalkers" / "Open Družina Moravy" buttons in the
    `#conversion` cards (`renderMainTab()`)
  - All 12 `<span onclick="switchTab(...)">` fake-links in the old
    `ecosystem.rows` table data (3 rows × 4 languages) — these weren't
    even real `<a>` tags, just styled `<span>`s, so screen readers and
    keyboard navigation treated them as inert text regardless of JS.
    "Moravian Squad" rows left pointing at `#main` (unchanged behavior —
    there's no real Moravian Squad section or page anywhere on the site
    to link to instead, and inventing one wasn't this fix's job); the
    Tutoring/Репетиторство/Doučování rows now go to `#pricing`
    specifically rather than a generic top-of-page scroll, matching what
    the label actually promises.
  - `#navHousingBtn` (top nav) — was a bare `<button>` with the
    destination entirely inside a JS `onclick` handler; now a real `<a
    href="#price-hous">`, JS only updates the label text on top of that.
  - The top tab bar (`#tabsNav`, `renderTabsNav()`) — "BrnoWalkers" and
    "Družina Moravy" tabs are now real links to the dedicated pages;
    "Ecosystem" stays a same-page-scroll button, since that content
    genuinely is on this page.
  Verified two ways: `verify.js`'s existing checks all still pass (zero
  duplicate ids, all functions present), plus a dedicated functional
  test confirming zero remaining `onclick="switchTab('walkers'|
  'druzina')"` anywhere in the rendered DOM and the exact real `href` on
  each fixed element (see the test output referenced in §8). **Not
  changed:** `switchTab()`/`parseHash()` themselves, and the legacy
  `#walkers`/`#druzina` hash-URL handling — an old bookmark or shared
  link to `mysite.com/#walkers` still lands on the on-page teaser (which
  itself links out), which is a reasonable graceful-degradation path,
  not a button someone clicks expecting a specific destination.
- **Družina Moravy price increase, effective 1.09.2026 (done this
  session)** — per a brief found in the Google Drive "Site Updates"
  folder (`001-druzina-pricing-and-subscription-mechanic.md`, publicly
  announced Telegram channel post #515, 12.08.2026). All figures below
  updated in all 4 languages, verified against the real rendered DOM
  (not just text search) via a one-off `jsdom` script:
  - Per-visit: Senior 100→**120 Kč**, Junior 200→**240 Kč**
  - Standard subscription: Senior 350→**420 Kč**, Junior 700→**840 Kč**
  - Unlimited subscription: Senior 1,000→**1,200 Kč**, Junior
    2,000→**2,400 Kč**
  - 3-month subscription: Senior 3,000→**3,600 Kč**, Junior
    6,000→**7,200 Kč**
  - The rollback rate mentioned in the tariff's fine print (what a
    lapsed Senior pays) updated to match: 200→**240 Kč/session**
  - **Part 2 of the brief** — Standard subscription reads as a flexible
    "any 4 days" pass but isn't; members declare specific days from the
    Mon/Thu/Sat schedule in advance. Added one clarifying sentence to
    `subsNote` (the paragraph under the table) in all 4 languages rather
    than cramming it into a table cell — kept the existing table
    structure untouched, per the brief's "keep formatting, just correct
    numbers" instruction.
  - **Found and fixed beyond the brief's own list** (the brief flagged
    "first training free" as stale on the main page; the actual
    scope was larger once traced through):
    - `#druzina`'s teaser callout on the main page (this session's own
      earlier work, two sessions ago) said "First training is free —
      just show up." — genuinely wrong, not just stale; fixed to use
      the same `trial-price-auto` mechanism every other instance of this
      value on the page already uses, so it won't drift out of sync
      again at the next price change.
    - **`druzina/index.html` — 7 separate "free" claims**, none of which
      would ever self-correct: this page has no `trial-price-auto`/
      date-aware logic at all, so these were hardcoded wrong text with
      no mechanism to catch up automatically. Fixed: meta description,
      OG description, Twitter description, the hero free-note, the
      schedule section's LARP-cancellation-logic note, the onboarding
      table's "Bring" row, and the onboarding callout. This is the
      single most important fix in this pass — that page is the
      canonical, most-linked destination for Družina content, and it
      was telling every visitor the wrong price with no way to notice.
    - The matrix-activities comparison table and the "Try HEMA Fencing"
      conversion-card CTA also had stale "0 Kč"/"100–200 Kč" ranges
      baked into surrounding sentences (not just the isolated trial
      price) — updated in all 4 languages.
    - Two **orphaned/dead** data structures — `T[lang].about.facts` and
      `T[lang].onboarding.rows` (confirmed via `grep` that neither is
      referenced by any live render function, same status as the old
      `RANKS` array from an earlier session) — also had stale "100 Kč"
      text. Fixed for the same reason `RANKS` was: cheap to do, avoids a
      landmine if this content is ever revived.
  - **Confirmed unrelated, deliberately left untouched:** "700 Kč" for
    individual/private fencing lessons outside the club (a different
    product from the Junior/Senior club tariff table — not mentioned in
    the brief, no confirmed new number, would have been inventing a
    price) — every other tutoring/fitness/coaching/web-design price on
    the page (unrelated services); the rank/discount system (5/10/15/20%
    — brief explicitly says leave as is).
  - The brief's file in Drive
    (`1VfvPZDrLyqtY3ibtz_bVw4BbU7kiKdTf` folder, "Site Updates") renamed
    to `001-druzina-pricing-and-subscription-mechanic-DONE.md` per the
    folder's own README convention.
- **Architecture fix: "venture content lives ONLY on its own page" (done
  this session).** The site owner flagged a real, confusing inconsistency:
  scrolling the main page showed Družina's schedule and (until the price
  session) some pricing detail directly, but Rank ladder/Roles/Conduct
  were ONLY on `/druzina/` — two places carrying different pieces of the
  same venture's story, with no consistent rule for what lived where.
  Root cause: `renderWalkersTab()`/`renderDruzinaTab()` still had
  leftover dynamic content (Tariff, Payment, Ecosystem, Medals, Board
  Games) that was never part of the original duplication-fix migration,
  sitting awkwardly alongside the fully-migrated static teasers. Fixed by
  finishing that migration properly instead of patching around it:
  - **Moved to static HTML on `/druzina/`:** the Tariff table
    (Junior/Senior pricing, this session's already-corrected numbers) and
    the "How Payment Works" rules — inserted right after `#schedule`,
    using `<h3>` to match that page's heading level (not `<h2>`, which
    `index.html` uses).
  - **Moved to static HTML on `/walkers/`:** the Medals/rewards system
    and the Board Game Evening section — inserted after `#faq`, same
    `<h3>` convention, with the one image reference (`boardgames.jpg`)
    corrected to the `../images/` relative path that page already uses
    elsewhere (a straight copy would have 404'd — this page lives one
    directory down from `index.html`).
  - **Extracted byte-accurate, not reconstructed from memory:** ran the
    site's own `render('en')` in a one-off `jsdom` script and read the
    resulting `#walkers-dynamic`/`#druzina-dynamic` innerHTML directly,
    then stripped the runtime-only `class="reveal is-visible"` artifacts
    scroll-reveal adds (confirmed via `#terms` that static sections don't
    carry that class in source — it's added purely by
    `initScrollReveal()` at runtch).
  - **Removed entirely from `index.html`:** the `#walkers-dynamic` and
    `#druzina-dynamic` placeholder `<div>`s (nothing renders into them
    anymore), the corresponding two lines in `render()`, and the
    Ecosystem section (a table of links to all three ventures — fully
    redundant with the hero fork + `.venture-picker`, which already do
    the same job more visually; dropped rather than relocated).
    `renderWalkersTab()`/`renderDruzinaTab()` themselves kept as
    documented no-ops rather than deleted outright (same call as
    `renderMedals()`/the old `RANKS` array in earlier sessions) — in
    case a genuinely main-page-only widget gets added later. `MEDALS`
    the reward-tier data (real content, not fake) is now unreferenced by
    any live render path — like `RANKS` before it, harmless but worth
    knowing about; `BOARDGAMES` and `IMG_BOARDGAMES` are now unreferenced
    too, same status.
  - **Družina's main-page teaser callout simplified to match
    BrnoWalkers'.** It used to also state the schedule (Mon/Thu/Sat
    18:00) and venue address directly, with a "Get directions" button —
    added two sessions ago for a different, legitimate reason (shortest
    path to the meeting point), but it's exactly the kind of
    inconsistency the site owner is now flagging: BrnoWalkers' teaser
    never had this level of embedded detail. Now both teasers are the
    same shape: one sentence naming what lives on the dedicated page, one
    button to get there. Nothing lost — `/druzina/#schedule` already
    covers the same address/hours in more relevant context.
  - **Service finder taught about the newly-moved content** — added
    entries for Tariff, Payment, Medals, and Board Games (pointing to
    `druzina/#tariff`, `druzina/#druzina-payment`, `walkers/#medals`,
    `walkers/#boardgames`) so searching "training price" or "medals" on
    the main page still finds them, same pattern as the entries added
    for the original duplication fix.
  - **Verified:** zero duplicate ids across all three files; `<section>`
    open/close counts balanced on both dedicated pages (8/8 each); zero
    broken in-page anchors on either dedicated page; `mainDynamicLen`
    and `footerLen` byte-identical to before (confirms Main's own
    dynamic content and the footer were untouched); `walkersDynamicLen`/
    `druzinaDynamicLen` now `0` as expected.
  - **Follow-up done in this same session** — the first-screen visual
    redesign flagged as "not started" above is now done too, see the new
    bullet immediately below.

- **First-screen redesign: photo-forward venture picker (done this
  session, same session as the architecture fix above).** The site
  owner's request, paraphrased from a long voice message: too much text
  overall, the three ventures should be visible as three photos — left
  to right on desktop, stacked on phone — without scrolling, pricing
  maybe shouldn't be a whole dedicated section, and there should be a
  clear way to join each venture's channels right there.
  - **Hero cut down hard.** Removed the 3-button `.hero-ctas` row added
    two sessions ago (Tutoring/BrnoWalkers/Družina text links) — it was
    genuinely redundant with the venture picker directly below once that
    picker became the visual centerpiece; having the same three
    destinations offered twice in a row was part of the "too much
    text/buttons" problem, not a fix for it. Hero is now just eyebrow +
    h1 + tagline + reviews badge.
  - **Trust strip condensed from a 4-item icon grid to one line.** Same
    four facts (PhD/Masaryk, teaching since 2015, 230+ community, ⭐
    45+ reviews) — the reviews stat moved to the hero's reviews badge
    instead of repeating it a second time, so the line only needed 3
    facts. Nothing dropped, just far less vertical space.
  - **Venture picker rebuilt as photo cards.** Each of the three cards
    (Tutoring/BrnoWalkers/Družina) now has a real photo up top —
    `images/portrait_face.jpg`, `images/walkers_group.jpg`,
    `images/druzina_train.jpg`, all pre-existing assets already used
    elsewhere on the site, confirmed via `grep` before use, not newly
    uploaded. Description text cut to one short line per card (was 2-3
    sentences). `grid-template-columns:repeat(auto-fit,minmax(230px,1fr))`
    was already on `.venture-grid` before this session and needed no
    change — it already naturally stacks to one column under ~500px
    wide and goes 3-across on desktop, which is exactly "left to right /
    top to bottom on phone" — confirmed this is genuinely how the CSS
    behaves, not assumed.
  - **Added: a channel-join row under each card** (Telegram + WhatsApp
    icons, using the same real per-venture channel URLs already used
    elsewhere in the file — `t.me/eternallearning`, `t.me/pochody_brno_new`
    + its WhatsApp counterpart, `t.me/druzinamoravy_news` + its WhatsApp
    counterpart) — directly answers "something specific about how to
    join whatever channels" from the request. **Deliberately NOT nested
    inside the card's own `<a>`** — putting an `<a>` inside another `<a>`
    is invalid HTML with unpredictable browser behavior, not just a
    style choice — so each card is `.venture-card-wrap` (a plain `<div>`)
    containing the card `<a>` and a sibling `<div class="venture-channels">`
    with its own two `<a>`s. Verified via `jsdom` that none of the three
    `.venture-card`s contain a nested `<a>`.
  - **Service finder moved below the picker**, not removed — it's a
    power-user shortcut for someone who already knows what they want and
    would rather type than click, not essential to "get the concept in
    one glance," so it made sense to let the picker have the prime
    position instead of sitting above it.
  - **Pricing: kept as its own section, not restructured into a modal or
    dropdown.** The request explicitly left this open ("not sure a
    separate tab is good... think about this"). Reasoning for keeping it
    largely as-is: it's already collapsed-by-default per category (from
    an earlier session), already reachable in one click from the
    Tutoring card ("See prices →" goes straight to `#pricing`), and
    already searchable via the finder — the "one million services,
    click what you want, then see the price" behavior the request
     described already exists; the remaining bulk is the ~9 category
    accordions themselves once you're actually in `#pricing`; consciously
    **not** touched this pass. Flagged as the next candidate if the
    pricing section itself still feels too long once it's reachable this
    much faster.
  - **Verified:** zero duplicate ids after four consecutive language
    re-renders (`render('ru')` → `'en'` → `'cs'` → `'uk'` in sequence, not
    just one load); hero `h1`/`tagline` still translate correctly in all
    4 languages (confirms the redesign didn't disturb the existing
    `data-i18n` system); all three venture-card images, hrefs, and all
    six channel-icon URLs present in the raw HTML with zero JS executed;
    `<section>` open/close balanced (22/22) file-wide.

## 6. Known limitations — worth your attention, not hidden

- **Five AI-drafted translations** need native-speaker review (see
  "Translation system" above) — ru especially, primary audience
- **Geo coordinates** for `LocalBusiness` schema are still an
  approximation (Husovice district center, ~49.212°N 16.631°E), not the
  exact rooftop location. Re-checked this session via web search
  specifically for `Dukelská třída 157/44` — nothing more precise than
  the same district-level centroid turned up (search doesn't have a real
  geocoding API or Google Maps pin-drop access). Still worth pulling the
  real one from Google Maps directly if rooftop precision matters.
- ~~**Content duplication**~~ — **done this session**, see §5.
- **`EVENTS_API_URL`** in the JS is still the literal placeholder
  string — this predates this work, needs the real deployed Apps Script
  Web App URL from `setup-checklist.md`'s steps
- **Never rendered in an actual browser.** Every check described in §8
  is real (executed code, not just read), but it's all headless —
  `node --check` for syntax, `jsdom` for DOM behavior. Nobody has watched
  this paint on a screen yet. Open it in a real browser, on real mobile,
  before it goes near production.
- `Code.gs` was **explicitly not touched** per direct instruction — any
  brief asking for a `Code.gs` rewrite around a simplified Events schema
  should be treated with suspicion; the real one has non-obvious, load-
  bearing logic (Corporate-event privacy routing, GDPR retention,
  category-colored Telegram posts, webhook dedup) documented across
  `community-hub-appsscript-guide.md`, `tally-form-structure.md`, and
  `system-analysis.md` in the project files.

## 7. If you're an AI continuing this work

- **Verify by executing, not by reading.** This project's history
  includes several real bugs that looked correct on inspection and were
  only caught by actually running the code: `jsdom` for DOM/JS behavior,
  `node --check` for syntax, precise Python regex audits for duplicate
  IDs and missing CSS classes. Do the same — a change that "looks right"
  in a diff isn't verified until it's been executed.
- **Multi-language text changes need exhaustive sweeps**, not a single
  find-and-replace. The same real-world fact can exist as independently-
  authored text in multiple places (a `T[lang]` data object *and* a
  hand-paraphrased static HTML version *and* orphaned dead code from a
  section that was already migrated) — grep broadly, in every language,
  before considering a factual correction complete.
- **The service finder needs no manual maintenance for on-page content**
  — it indexes `.price-cat` tables, `.event-card`s, and `.subj-card`s
  from the live DOM. Add a new priced row using the existing table markup
  pattern and it becomes searchable automatically. **Exception:** the
  nine hand-written "external" entries added during the duplication fix
  (§5) point to specific anchors on `walkers/`/`druzina/` (e.g.
  `walkers/#event-types`). If those pages' section `id`s ever change,
  these entries need updating by hand — they're not DOM-derived.
- **Reuse existing CSS classes before adding new ones.** Almost
  everything in this project deliberately reused classes already in
  `styles.css`; genuinely new additions are commented inline with why
  they were necessary.
- **Don't touch `Code.gs`** without the site owner's explicit, specific
  confirmation — see §6.

## 8. Verification already performed (so you don't have to redo it)

- `node --check` on the full script block: passes, valid syntax
- Python regex audit: zero duplicate `id` attributes across the entire
  document (comments and JS `//` lines correctly excluded from the check)
- CSS class audit: every class used in the static content cross-checked
  against `styles.css` — zero missing (one confirmed-harmless exception,
  `subj-group`, a plain structural wrapper with no styling needs, matches
  the original site's own pattern)
- `jsdom`-based real DOM execution (not just static analysis):
  - Search returns correct results for "chemistry", "canoe", "python",
    "ielts", "fencing" — including the fix for sub-item-only keywords
  - `jumpToService()` correctly opens collapsed `<details>` ancestors,
    scrolls, and highlights — tested for both an already-visible target
    (subject card) and a collapsed one (pricing row)
  - All 10 pricing categories collapse; Tutoring's subject grid correctly
    stays visible
  - `resolveI18nValue()` returns correct values for all 13 `data-i18n`
    keys across all 4 languages
  - Trial price displays correctly and is consistent across all
    `.trial-price-auto` spans; zero remaining "free" trial-training text
    anywhere in the rendered DOM, any language
- **This session's duplication fix**, verified the same way (`verify.js`,
  a small reusable `jsdom` harness now sitting alongside this handover —
  not part of the deployed site, delete it or keep it for next time):
  - `node --check` on the extracted script block: passes
  - Zero duplicate `id`s in the actual post-`render()` DOM (not just raw
    source text — raw-text regex gives false positives here because the
    same `id="..."` string legitimately appears inside JS template
    literals for content injected into only one placeholder at a time)
  - `<section>` count dropped from 34 → 26 (10 removed, 2 short callouts
    added), exactly as expected
  - All load-bearing element ids and function names still present;
    `walkers-dynamic`/`druzina-dynamic`/`main-dynamic`/footer innerHTML
    lengths byte-identical to before the edit (dynamic rendering
    untouched)
  - `switchTab('walkers')`, `switchTab('druzina')`, `switchTab('main')`
    all still resolve and scroll (hero `id`s were deliberately kept)
  - `buildServiceIndex()` returns 105 entries (96 on-page + 9 new
    external); searching "canoe" now correctly returns the two moved
    entries with `walkers/#event-types` / `walkers/#canoe-safety` as
    `url`, and unrelated on-page searches ("chemistry") are byte-for-byte
    unchanged from before
  - `faqPageSchemaCount` in `<head>` dropped from 1 → 0, confirming the
    removed `injectFAQSchema('walkers')` call no longer emits schema for
    content that isn't visible on this page anymore
- **This session's "shortest path" pass**, verified the same way
  (`verify.js`, updated with new checks — still not part of the deployed
  site):
  - `#mobileCta` renders with the correct href and WhatsApp icon; the
    show/hide toggle logic runs without throwing; text correctly differs
    between `render('ru')` and `render('en')` (confirms the new
    `ui.stickyRegister` key resolves in both)
  - `#main .hero-ctas` exists (it didn't before) with hrefs `#pricing`
    and the WhatsApp link, in that order
  - The new quick-pay `.callout` at the top of `#pricing` is found by
    searching for "Revolut" in the rendered DOM, and its Russian text
    reads correctly ("💳 Оплата через Revolut: revolut.me/aliaksj5pq —
    оплата сразу закрепляет время...") — confirms the three new
    `STATIC_ADAPTED_I18N` keys resolve
  - Zero duplicate ids, zero errors, all load-bearing elements/functions
    still present, all four dynamic-content lengths still byte-identical
  - **Not verified (needs a real browser):** that clicking the event-card
    directions links or the Družina "Get directions" link actually opens
    a sensible Google Maps result — jsdom can't follow real navigation,
    only confirm the `href` was built correctly from real `locationName`
    data
- **This session's tabs-bar fix**, verified the same way: `initNavHeightSync()`
  runs without throwing and sets `--nav-height` on `<html>`. **Not
  verified (needs a real browser):** the actual pixel value — jsdom has
  no real layout engine, so `nav.offsetHeight` is always `0` there. This
  is exactly the kind of bug that only shows up with real layout in the
  first place, so a real-browser check on a narrow phone, in a
  long-brand-text language (ru/uk), is the real test — see §9.
- **This session's page reorder**, verified with
  `pricingEl.compareDocumentPosition(introVideoEl)` — confirms
  `#pricing` genuinely precedes `.intro-video-wrap` (and therefore all of
  `#main-dynamic`'s content) in actual document order, not just that both
  exist somewhere in the source. `mainDynamicLen` unchanged
  (byte-identical) — confirms this was a pure move, zero content lost.
- **Rank IV bracelet color fix**, verified with a plain grep across all
  three live HTML files for "green"/"зелен" (zero remaining hits) and
  for "orange"/"oranžov"/"оранж"/"помаранч" (exactly the two intended
  hits — the live `druzina/index.html` table and the orphaned `RANKS`
  array). `node --check` confirms the `RANKS` array edit didn't break JS
  syntax.
- **This session's hero venture fork**, verified: `#main .hero-ctas`
  hrefs are exactly `['#pricing', 'walkers/', 'druzina/']`; the Tutoring
  button's text reads correctly in `ru` ("🎓 Репетиторство") and `cs`
  ("🎓 Doučování"), confirming the new `ui.forkTutoring` key resolves.
  **Not verified (needs a real browser):** three full-width buttons
  stacked in the hero on mobile is more vertical space than the old
  two-button row — worth a look on a short/small phone screen to confirm
  it doesn't push the fold awkwardly or look cramped.
- **This session's static-HTML audit**, done properly — not eyeballed:
  a Python script strips every `<script>` tag from all three live HTML
  files and checks what visible content and what `id`s survive, then
  cross-references every `href="#..."` anchor against that static-id set
  to flag any that only resolve after JS runs. Before this session's
  fixes: 15 sections and 10 of 21 in-page anchors on `index.html` were
  JS-only. After: down to 11 sections / 10 anchors (`#walkers-schedule`
  and Contacts moved to the static column; `walkers/` and `druzina/` were
  already 100% clean, confirmed not just assumed). Also directly
  confirmed via string search that real contact info (email, phone,
  WhatsApp, Telegram, Revolut, IČO) is now present in the JS-stripped
  HTML, not just present "somewhere in the file" (e.g. inside a JS
  string that never gets used).
- **This session's button fixes**, verified with a dedicated `jsdom`
  script (not saved as a permanent file — a one-off, results quoted
  here): `#navHousingBtn` is an `<a>` with `href="#price-hous"`;
  `#tabsNav` renders one `<button data-tab="main">` plus two real
  `<a href="walkers/">` / `<a href="druzina/">`; all 4 languages'
  `#ecosystem` links resolve to `walkers/`, `#pricing`, or `#main` as
  intended (spot-checked English); both `#conversion` "Open ..." links
  and the `#contacts` bottom CTA carry real `href`s; a full-DOM scan for
  `[onclick]` containing `switchTab('walkers')` or `switchTab('druzina')`
  returned zero matches anywhere. Also re-ran the no-JS string-strip
  audit and confirmed `href="walkers/"` / `href="druzina/"` are present
  in the raw HTML (not just after JS runs) in 7 places.
- **This session's Družina price update**, verified by actually
  rendering the `#tariff` table in `jsdom` for all 4 languages (not
  reading the source and trusting the edit) — full row-by-row output
  matched against the brief's table exactly (see the price list in §5).
  Same for the Part 2 subscription clarification: rendered `#tariff`'s
  paragraphs in all 4 languages and confirmed the new sentence is
  present with the correct wording, not just that *a* change was made
  somewhere. `druzina/index.html`'s remaining `free`/`100 Kč` matches
  after the fix were individually checked and confirmed to be unrelated
  (sparring-round terminology, a craftsman barter reward) rather than
  assumed clean from a raw count.

## 9. Testing checklist before this goes live

0. **New this session, test before anything else below:** scroll the
   main page past the hero on a real phone — does `#mobileCta` actually
   appear, sit above safe-area padding correctly, and not overlap
   anything? This is the one piece of this session's work that a real
   browser could plausibly reveal a CSS problem in that jsdom can't see
   (transform/position timing, iOS safe-area insets, etc.). **Also test:**
   switch to `ru` (longest brand text) on a narrow phone, scroll down —
   confirm the tabs bar now stays fully visible right below the nav
   instead of getting partially covered. **Also confirm:** scrolling from
   the venture picker now reaches `#pricing` immediately, with the rest
   of the old content (intro video, events, reviews, etc.) after it, not
   before. **Also confirm:** `/druzina/` → Rank ladder table → rank IV
   (Champion/Vítěz) shows "Orange", not "Green". **Also confirm — this
   is the big one, the actual point of this session's redesign:** on a
   real phone, in portrait, on first load, can you see all three
   venture photo cards (🎓 Tutoring / 🥾 BrnoWalkers / ⚔️ Družina Moravy)
   without scrolling, or close to it? That's the literal goal the site
   owner described and jsdom cannot verify layout/viewport fit at all —
   this is a real judgment call on an actual screen, not a pass/fail a
   script can give you. Also confirm each photo actually loads (not a
   broken-image icon) and the small Telegram/WhatsApp icons below each
   card open the right chat.
   "Družina Moravy" tabs, the `#navHousingBtn` "Housing" nav button, both
   `#conversion` "Open ..." buttons, and the "Go to BrnoWalkers" CTA at
   the bottom of `#contacts` — all fixed this session from dead
   `<button onclick>`s to real links; jsdom confirmed the `href`s are
   correct, but an actual click-through in a browser is the real test.
   **Also confirm:** `#tariff` on the main page shows 120/240 Kč per-visit
   and 420/840, 1,200/2,400, 3,600/7,200 Kč for the three subscription
   tiers (Senior/Junior) — and `/druzina/`'s hero, onboarding table, and
   onboarding callout all say "120 Kč", not "free", anywhere.

1. Open in an actual browser — this has never been done. Check every
   section renders, GSAP/canvas animations run, images don't 404.
2. View-source (not DevTools inspect) on the live URL — confirm hero,
   pricing, FAQ text is readable as plain HTML with zero JS execution.
   **This session's audit already did the equivalent of this via script
   stripping (see §8) — this step is the "confirm it holds up in an
   actual browser too" pass, not starting from zero.** Specifically
   check the footer and Contacts section are there in view-source (new
   this session) and that `#academy-priority`, `#leader-about`,
   `#reviews`, `#tariff`, `#medals`, `#boardgames` etc. are genuinely
   NOT there (confirms the audit's findings, doesn't just re-trust them).
3. Test on real mobile — sticky CTA, service finder, pricing
   collapse/expand, touch targets.
4. Google Rich Results Test (search.google.com/test/rich-results) on
   all three URLs (`/`, `/walkers/`, `/druzina/`).
5. Click through all 4 language buttons — confirm text actually changes,
   including the trial price.
6. Search the finder for a handful of real terms across categories —
   confirm results and jump-to behavior, **including one of the nine new
   external terms ("canoe", "rank", "onboarding") — confirm it actually
   navigates to the right anchor on `walkers/`/`druzina/`, not just that
   it returns a result.** Only verified against jsdom's DOM state so far,
   never an actual page navigation.
7. Disable JS entirely — confirm the page is still readable and
   navigable via real anchor links. This is the actual test for the
   problem this whole project set out to fix. Also confirm the two new
   duplication-fix callouts (plain `<a href="walkers/">` /
   `<a href="druzina/">`) work with JS off — they should, they're regular
   links, but this hasn't been eyeballed in a real browser either.
8. Click the two new "Open the BrnoWalkers/Družina Moravy page →"
   callout links on the main page and confirm they land on the right
   dedicated page.
