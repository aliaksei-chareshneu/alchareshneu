# IMPERION public job scout — free cloud pilot

**Status: owner GO 2026-11-17 to merge and enable daily PUBLIC discovery only; NOT an auto-application service.**
Owner: individual job applicant (not Družina Moravy z.s.). Reviewed 2026-11-17.
No new database, agent, account, external scheduler, subscription, model or API key. The schedule uses existing GitHub Actions.

## What already exists / why this adapter

- Existing GitHub Actions runtime in the public IMPERION repository.
- Existing private job-application history and canonical 03_JOBS_AND_CAREER_PIPELINE (must be deduplicated privately).
- Existing Supabase Browser Bridge is a browser/PC queue, **not** evidence of cloud application submissions.
- Existing CV and Gmail stay in authorized private systems; **never** upload them into this public repository, public Actions logs, caches, or artifacts.

This adapter checks one employer's **public** job index, reads at most four index pages and ten detail pages, honors robots.txt (fail closed), uses only GET, and emits only public vacancy metadata. It does not use Work, TinyFish, a paid LLM, browser login or a new CRM.

## Choice of implementation

**A — REUSE/ADAPT (owner approved):** standard GitHub Actions runner + existing Node.js dependencies, with a tiny official-source adapter. Public standard runners are free in public repos; account-specific storage/limits and GitHub terms still apply. Daily schedule at **07:17 UTC** (08:17 CET / 09:17 CEST, GitHub best-effort) on the default branch; a one-off push-to-main smoke verifies activation. No new external scheduler.

**B — ADAPT after private approval:** keep public discovery on Actions, but do private CV tailoring, history checks and official application submission through the *existing* authorized private Gmail/Browser Bridge/CRM paths, with site-specific permissions, anti-bot policy and explicit owner GO. A Windows-hosted Browser Bridge does not work with the PC off; an independent cloud browser for private submission is not verified. Do not migrate cookies, CV or secrets to public Actions.

**Not chosen:** TinyFish (negative wallet balance), paid auto-apply subscriptions, a new autonomous browser-agent platform, a second Supabase job CRM, or local Ollama as a cloud-off-PC solution.

## Acceptance and evidence

1. Synthetic Node tests PASS in an independent GitHub Actions job: allowlisted URLs, dedup, date extraction, robots rules, no POST, zero CV upload, no private data, no submission.
2. Public-source smoke returns PUBLIC_SOURCE_READBACK with counts of actual MUNI pages and up to ten public vacancy links in the Actions job summary, or PUBLIC_SOURCE_BLOCKED. For PR checks only, source smoke is continue-on-error and requires separate readback. For **scheduled** and **push-to-main** runs, a failed public source read makes the workflow FAIL.
3. The output status is always PUBLIC_DISCOVERY_ONLY. It does not prove HPP, insurance, fit, salary, newness versus Gmail/03, or a submitted application.
4. Before real applications: verify official source and terms; privately compare against Inbox/SENT and canonical 03; confirm skills and CV; obtain exact owner GO; submit through the official form; verify a confirmation email or employer/portal receipt. Never infer success from a click or filled field.
5. Stop on CAPTCHA/2FA, disallowed robots or anti-bot controls; never bypass them.
6. The owner explicitly authorized **merge + daily public MUNI discovery only** on 2026-11-17. No approval for any private applicant-data handling, automatic application, email, portal login, paid service or extra source. Rollback: revert the merge/schedule commit or disable this GitHub Actions workflow. Never enable automatic real submissions without a new GO.

## Manual development commands (after code checkout)

    npm ci --ignore-scripts --no-audit --no-fund
    node --test tests/imperion-job-scout.test.cjs
    node ops/job-scout/muni-public.cjs --live --pages 1 --details 10 --out /tmp/imperion-public-job-scout.json

The --live flag is an explicit opt-in for a bounded, read-only source fetch. It does not submit a form. No CV is required or accepted.

## Official references

- MUNI public vacancies: https://www.muni.cz/o-univerzite/kariera-na-mu/vyberte-si-z-volnych-mist-na-muni
- GitHub Actions public runners: https://docs.github.com/en/actions/concepts/billing-and-usage
- GitHub manual workflows: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow

## Remaining blockers

- Real MUNI robots.txt and GitHub runner HTTP readback: **VERIFIED** by GitHub Actions run 44068457035 (prior run 44068158933: 10 links / 2 detail pages); future daily readback and new-vacancy coverage still require monitoring.
- Site terms for automated discovery and any applicant-form automation.
- Private, authenticated and secure CV/applicant data handling independent of public CI.
- Official receipt readback from each employer.
- The zero-new-cash target excludes owner/operator hours, which remain **NOT MEASURED**; never call this a zero-cost business process.
