# GitHub Copilot instructions — IMPERION public repository

Read [AGENTS.md](../AGENTS.md) first. For website, booking, prices, lead generation, CRM or calls-to-action, also read [docs/CODEX-SITE-CONVERSION.md](../docs/CODEX-SITE-CONVERSION.md). This file complements, not replaces, the existing owner instructions.

## Definition of done
- State the observable customer/user result and acceptance test before changing files. Report what is actually verified and what is not.
- Reuse existing code, tests, GitHub issues, canonical forms/CRM and approval workflow. Do not create another lead database, queue, social scheduler, metric counter or site.
- Work on a small feature branch, make a reviewable PR, run applicable existing GitHub Actions tests, and record test evidence. A green CI check does **not** mean GitHub Pages published anything.
- The default branch is `main`, but production Pages previously used `growth-experience`; verify current Pages settings before releasing. Do not force-merge diverged branches.
- Never commit, print or transmit private Drive brief text, emails, addresses, personal records, bank data, secrets, signed contracts or nonpublic revenue to this public repository. Use only synthetic test data.

## Domain-specific gates
- Academy/revenue: [issue #13](https://github.com/aliaksei-chareshneu/alchareshneu/issues/13) was closed on 2026-10-17 after synthetic Form→Leads/Telegram and same-`Submission_ID` replay verification. Preserve that fix; investigate a *newly evidenced regression* rather than reopening or reimplementing the closed incident. A form confirmation alone still does not prove CRM ingestion. Require exactly one row per `Submission_ID`, safe failure handling and no actual customer data in tests.
- Družina: observe the current legal/safety gate; do not restore withdrawn HEMA paid booking prices or checkout flows from historical copies. Keep OSVČ services, z.s. services, money and representation separate.
- Media: original/licensed assets only, with rights and consent. Queue is not publication; require public provider permalink before claiming LIVE.
- Commercial emails, posted content, payments, contracts, subscriptions, legal filings, changes to DNS/MX and public deployment require the correct approval and source verification.

## Available local model and vendor distinction

For a synthetic PUBLIC translation QA task, the existing Ollama adapter is pinned to `127.0.0.1:11434` with a two-model local allowlist (`qwen3:4b` preferred, `qwen3:0.6b` fallback), explicit CPU-only `num_gpu=0` and strict factual/script QA. Small 0.6B returned actual inference but did not translate Slavic text adequately, so do not confuse technical success with acceptable language output. `node ops/ai-local-smoke.cjs --ollama` never posts or contacts a paid service. This is independent from GitHub Copilot entitlement and Google Antigravity eligibility; see `docs/AI-CONTENT-PIPELINE.md` before using any model output.

## Execution order
1. Verify actual repo state, relevant issue and active branch; review existing PRs to avoid duplicate/conflicting work.
2. Prepare a minimal change; show required sources, risks and tests.
3. Run existing `Operations tests` and `Site quality` (or relevant module tests) on the target branch. Do not invent commands unsupported by that branch.
4. Obtain approval before merge/release. Verify actual production website or provider receipt after authorized release.
5. Update the existing canonical operational receipt; never equate PR, test, staging or draft with cash, delivery or user impact.

Tooling availability is conditional: GitHub Copilot or Antigravity being mentioned here does not prove a paid plan, login, installed binary or unattended execution. The safe onboarding checklist lives at [docs/AI-TOOLCHAIN.md](../docs/AI-TOOLCHAIN.md).
