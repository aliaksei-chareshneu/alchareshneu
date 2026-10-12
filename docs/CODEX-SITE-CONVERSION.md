# CODEX SITE CONVERSION — approved implementation handoff
Status: **approved product direction, NOT a blanket authorization to deploy**.
Date: 2026-10-12. Target: this existing public GitHub Pages repository (`main` and actual published branch must be verified).

## Objective
Reposition the public site to SELL A SOLUTION TO A PARTICULAR CUSTOMER PROBLEM rather than a long inventory of teaching topics and hobbies. Immediate and credible emotional rewards (confidence, relief, belonging, memorable team experience) strengthen, but never replace, tangible customer outcomes and accurate evidence.

Two complementary commercial engines:
- **A / B2B:** corporate AI and data workflows, practical expert training, scientific/technical assistance, and team experiences. Buyer values saved staff time, fewer errors, clearer workflows, capable teams and memorable events.
- **B / individual and community:** Academy language/science coaching (confidence, exams and visible milestones), Družina first fencing experience and skill progression/belonging, BrnoWalkers and city guiding (discovery, social integration and shared experiences).
Business and nonprofit sales/payment/consent paths **must not be merged** just because brands appear on one site.

## Live routes and current baseline
- Root: `/` (public base path `/alchareshneu/`)
- Corporate: `/corporate/`
- Academy: `/academy/`
- Družina: `/druzina/`
- Walkers: `/walkers/`
- GitHub Pages URL: https://aliaksei-chareshneu.github.io/alchareshneu/
- The root already has a corporate navigation/hero CTA and the Academy booking destination had recently been changed (12 Oct). **Inspect current DOM and live destination instead of duplicating these patches.** Verify especially whether the Academy CTA leads to a relevant lesson intake rather than a corporate-only questionnaire.

## Customer-facing information architecture
1. **Root landing:** two unmistakable choices in the first phone viewport: **For companies** and **For individuals/community**. Keep existing brand identity where useful, but give each audience a clear next step. Minimize crowded cross-links and nine competing offers above the fold.
2. **Corporate:** organize around 2–3 customer pains:
   - Repetitive documentation/data work consumes team time -> bounded AI/data diagnostic and paid scoped process pilot.
   - Staff learn tools but cannot apply them -> practical Python/AI course with a real work example and handover.
   - Team needs a shared experience -> optional historical fencing/HEMA team challenge subject to safety and organizer availability.
   One principal CTA (request a scoped proposal/pilot); a direct email/contact fallback; transparent price only when verified against current authorized tariff. No invented percentage cost-saving claims or guaranteed ROI.
3. **Academy:** lead with "Speak with confidence / pass your next milestone / understand your subject", not twelve unrelated disciplines. Primary tracks: Czech for foreign residents, chemistry+biology admission support, technical/academic English. Give a diagnostic starting point, proposed 4–10 session progress plan, checkpoint and relevant first-lesson booking. Subject breadth and full terms remain accessible deeper on page.
4. **Družina:** welcoming first session, safe beginner progression, community/ranks and real session logistics first; weapon inventory and long documentation later. Distinguish rank from statutory association membership, fees, insurance and commercial training. Never imply that injury/liability cover exists without current documentary proof. Show date-effective tariffs correctly. Historical forms linking to September or unrelated canoeing safety text are a **P0 stop-ship** issue for contact sessions.
5. **BrnoWalkers/guiding:** show emotional benefit "Find people and discover Brno" plus specific experience/route, physical difficulty, date, price and booking. Differentiate grant-funded/free community walks from separately sold commercial group or expat onboarding city tours.

## Copy framework (CZ/EN/RU/UK)
Audience -> immediate friction/pain -> specific rational AND emotional result -> credible evidence -> narrow actual offer/conditions -> **one** primary CTA.

Example copy concepts, for review (NOT final factual guarantees):
- Root CZ: "Vyřešte konkrétní problém. Získejte dovednost. Zažijte něco výjimečného."
- B2B CZ: "Méně rutiny. Spolehlivější práce s daty. Praktické AI pro váš tým."
- Academy CZ: "Mluvte sebejistě. Zvládněte zkoušku. Uvidíte vlastní pokrok."
- Community CZ: "Zažijte něco nového. Poznejte své lidi v Brně."

Write idiomatic versions in Czech, English, Russian and Ukrainian, not word-for-word placeholders. Do not make unproven exam, safety, financial or therapeutic promises. Emotional framing must never obscure essential price/safety/refund terms.

## Intake, conversion and privacy
- Replace irrelevant multipage all-service mega-form detours with the shortest **appropriate** service-specific intake. Target: name, reply method, service; optional company/group/date/budget; appropriate privacy/consent text. Test no forced Google sign-in if not essential and legally acceptable. Never bypass required consent/waivers.
- Continue to use the **existing** registration and revenue CRM/backend. No second data store or public export of internal Sheets. Each legitimate inquiry needs source/campaign, unique submission ID, owner, status, next action and follow-up deadline.
- Instrument only privacy-compliant funnel stages: offer viewed -> CTA clicked -> inquiry started -> inquiry submitted -> qualified -> quote -> paid order -> real cleared cash -> repeat booking. Last stages must come from trusted internal evidence, NOT browser click events.
- Add no payment claims without corresponding receipts. "0 recorded as paid" in a spreadsheet is not a verified bank balance.

## Implementation order and acceptance tests
**P0 inspection:** identify actual GitHub Pages publishing branch, runtime dependencies, current URLs, existing user-facing form and HEMA rules. Verify legal name, prices/effective dates and real signup behavior before revising marketing. Document current screenshots/broken paths.

**P0 user journey:** implement root two-path routing, segment-specific heroes, clear and relevant CTA, consistent breadcrumb and footer, mobile responsive typography and hero media/video scaling, keyboard/focus/accessibility. Preserve existing event/app integration.

**P0 safety & booking:** validate HEMA-specific safety/waiver and current event date, Academy-specific booking and corporate qualified lead form on phone and incognito in 4 languages; avoid false promise of insurance or membership benefits. If a form/consent backend cannot be edited, flag as blocker; **do not silently claim fixed**.

**P1 proof:** real approved reviews/case studies only with consent, or explicitly labelled hypothetical demonstration. Avoid fabricated numbers or photos misrepresenting real events.

**P1 measurement:** lightweight source attribution with consent controls where applicable; test nonidentifying sample lead end to end with existing CRM; distinguish test from real inquiries. Baseline before A/B testing, do not declare winners from 1–2 clicks.

**Review gates:** stage in branch/PR, run tests (including existing integration tests), manual 375px-ish mobile checks and 4-language link checks; provide accessible screenshots, list all modified files and changes, verify unique CTAs; require owner approval for public rollout, pricing, legal, physical safety and payment changes. After approval, verify live GitHub Pages and record rollback commit.

## Definition of done
- A new visitor can choose a relevant audience and understand outcome in a phone viewport.
- Every primary CTA leads to the RIGHT service and a working, accessible inquiry path (not just a pretty landing).
- HEMA registration/safety/declaration paths are correct and not deceptive; where blocked, clearly marked NOT READY.
- No cross-entity payment/membership confusion, no fabricated testimonials, no invented earnings.
- Real evidence captured for test inquiry and CRM handoff; production not claimed until verified.
- No new site, CRM, competing control document or broken original event functionality.

## Ownership and source authority
The owner's fuller canonical website facts and current tariffs live in **private Google Drive**; Codex may not have access by merely receiving a URL. Treat this file as a self-contained engineering brief. When there is a conflict or inaccessible facts, make the safe noncommercial UI change only and flag the fact/contract/consent gate for owner verification. Do not copy private Drive content into this public repository. Check actual product terms in the relevant current site/live system before release.
