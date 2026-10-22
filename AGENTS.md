# Codex / agent instructions for this repository

## Execution protocol — Codex engineering agent (2026-10-14)
**Mission:** Complete an authorized coding task to a verifiable, useful end-state with minimal owner attention. Codex is an engineering agent, not a standing sales/email agent. Be proportional to task size and risk; do not turn a one-line fix into a platform rewrite or a long status report.

**Priority:** Law, safety, security, privacy, existing obligations, hard deadlines and preventing loss first. Then select the smallest high-leverage change likely to deliver the intended user outcome. Favor fixing a real broken flow over cosmetic churn. Business heuristics never override the user’s actual coding request or repository constraints.

**End-state first:** Before broad research, identify the precise acceptance condition: which behavior, command, build artifact, API result, test, page or deployed URL must work, and who is authorized to approve it. For forms/payment/registrations, success means verified end-to-end behavior under legitimate test conditions, not a styled mock-up. A green test, a merged commit and a public deployment are three distinct states.

**Loop — INSPECT → SELECT → EDIT → TEST → REVIEW → NEXT:**
1. Inspect repository instructions, target files, current branch, dirty/uncommitted changes, available checks and current deployed baseline as needed. Do not overwrite unrelated changes.
2. Choose one smallest safe, reversible, testable step. Prefer reusing existing components, routes, scripts, registration backend and CRM integration over new parallel systems.
3. Implement a focused patch on a reviewable feature branch. Preserve project conventions; avoid new dependencies or scaffolding without a demonstrable need.
4. Run relevant tests, linters/builds, diff/format checks and, when appropriate, a local/manual user-path smoke test. State precisely what ran and what could not be tested.
5. Inspect diff, changed-file scope, privacy impact and regression risk. Create a reviewable PR; continue useful authorized corrections until acceptance criteria are met or a genuine gate is reached.
6. Stop when done, no worthwhile safe step remains, or new authorization/external input is required. Never claim an asynchronous agent will keep working unless a real scheduled job or trigger exists.

**Integrity and write gates:** DRAFT ≠ READY ≠ TESTED ≠ MERGED ≠ DEPLOYED ≠ LIVE VERIFIED. Re-read actual GitHub refs, CI and production URLs before reporting them. Do not self-approve/auto-merge, release, publish, alter effective prices, payment routing, consent/HEMA safety text, regulated claims, user identity, live registration data or production settings without appropriate owner approval. No force-push, destructive cleanup or rebase across diverged published branches without explicit review. Plan rollback before risky changes.

**Data and source hygiene:** This is a PUBLIC repository. Never add nonpublic briefs, raw CRM/Calendar/Gmail content, identifiable client/health data, authentication tokens, credentials or private analytics; use synthetic fixtures and redacted examples. Current signed/legal source and verified live system outrank old documentation; when private source cannot be accessed, label the fact unverified and stage only safe changes. Do not duplicate existing master documents, databases, payment flows or trackers.

**Code-facing business context (only where relevant):** Corporate/OSVČ AI/data services and Academy/Družina/BrnoWalkers experiences have different sellers, payment and consent rules. A site offer should convey audience → problem → truthful outcome → evidence → verified terms → one primary CTA. Do not infer that a form click is a qualified lead, a quote is a contract or a test payment is received cash. No invented prices, testimonials, insurance, guarantees or conversion numbers.

**Completion note (brief):** DONE (files + commit/PR) / TESTED (commands and results) / NOT VERIFIED or BLOCKED (specific reason) / NEXT (one actionable gate). No “deployed” without Pages build AND live readback; no long chronology for trivial changes.

## Required first read
For any website, offer, lead-generation, forms, conversion, copywriting or site navigation task, read **[docs/CODEX-SITE-CONVERSION.md](docs/CODEX-SITE-CONVERSION.md)** before changing code. It is the self-contained, approved site-repositioning implementation handoff dated 2026-10-12.

This repository is public. **Do not copy private Google Drive master briefs, CRM exports, customer messages, personal data, API keys, signed contracts or nonpublic sales figures into commits or logs.** A link to a private Google Doc in a chat prompt does not establish Codex access. Use the repository handoff for development; obtain confirmation for facts you cannot verify.

## Verified production publication (2026-10-13)
- **GitHub Pages publishes from `growth-experience` at `/` using a legacy branch build, NOT the default `main` branch.** This was confirmed through the authenticated GitHub Pages API on 2026-10-13. Recheck Settings → Pages before modifying deployment configuration; the source may change later.
- A green **Site quality** GitHub Actions check proves source checks only; it does **not** deploy Pages.
- Work in reviewable feature branches. For a public website change, land the approved patch on the *actual Pages source branch* (`growth-experience` as verified above); merging only into `main` will not update the public site.
- `main` and `growth-experience` have diverged. Do not replace the Pages branch with `main` or force-merge whole histories without auditing their unique changes. Prefer minimal targeted patches and PRs.
- Verify production after Pages reports `built`: compare the live page to the publishing branch at https://aliaksei-chareshneu.github.io/alchareshneu/ and test the affected CTA/content. Remote machine `zmrzlina` also has an hourly read-only Pages SHA-256 drift check in `state/pages_drift_check.ps1` (outside this repository).
- Issue #10 / PR #11 record the diagnosed branch mismatch, correction, and verified public rollout.

## Source and change controls
- Existing site and its architecture are the implementation target. Do not create a new site or parallel CRM.
- Start with a separate branch; prefer focused diffs and a reviewable PR. Do not force-push or change payment/registration production backends without review.
- Verify affected copy and navigation on mobile and in Czech, English, Russian and Ukrainian.
- Honor approved effective-date prices, consent/safety, accessible booking and distinct legal entities. Never invent insurance, customer testimonials, earnings or measured outcomes.
- Make a meaningful test plan, run available checks, describe what was actually tested, and require owner approval for safety, legal, fees, or production rollout.
- Historical README/START-HERE instructions may predate the current production architecture; check live sources and this handoff before deploying.
