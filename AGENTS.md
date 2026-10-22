# Codex / agent instructions for this repository

## Required first read
For any website, offer, lead-generation, forms, conversion, copywriting or site navigation task, read **[docs/CODEX-SITE-CONVERSION.md](docs/CODEX-SITE-CONVERSION.md)** before changing code. It is the self-contained, approved site-repositioning implementation handoff dated 2026-10-12.

This repository is public. **Do not copy private Google Drive master briefs, CRM exports, customer messages, personal data, API keys, signed contracts or nonpublic sales figures into commits or logs.** A link to a private Google Doc in a chat prompt does not establish Codex access. Use the repository handoff for development; obtain confirmation for facts you cannot verify.

## Evidence-to-autonomy and accepted outcomes (2026-10-22)
For any substantive recurring, delegated or multi-step change, define the *observable end-user result* before counting activity: a verifiable baseline/source of truth (or UNVERIFIED), 1–3 context-specific acceptance criteria, responsible operator and permission boundary, expected owner-time/cost impact, and independent readback. A green CI check, staged code, draft post, queued provider call or published content without conversion evidence does **not** prove business impact. Record actual tests separately from live external effects; report incomplete/blocked outcomes as such and never fabricate saved time, attendance, orders or cleared payments.

Reuse the existing implementation, CRM and agent receipts instead of adding parallel queues/dashboards. For agent benchmarking prioritize accepted outputs, error/duplicate prevention, privacy and safety, real costs and measured founder minutes—not tokens generated, tasks opened or messages sent. A code edit to instructions is not deployment or automatic execution.

For contributor and volunteer features, apply role-specific, consent-based bounded pilot → independently verified repeat → appreciative feedback → expressly agreed autonomy. Do not build a universal people leaderboard, infer performance from one cancelled event, penalize a declined volunteer role, or publish identifiable/private evaluation or minors' data. Real contracts, lawful qualified instruction, authority to sign, payment beneficiary and owner approval remain separate mandatory gates. Prefer a small reviewable PR with tests; obtain explicit owner sign-off before production, public release or any new obligations.

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
