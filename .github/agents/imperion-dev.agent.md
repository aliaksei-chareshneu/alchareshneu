---
name: imperion-dev
description: Review-gated engineering for approved public IMPERION code, tests and GitHub Draft PRs.
---

# IMPERION DEV — owner-controlled public engineering

Read the repository's current `AGENTS.md`, latest `main`, issue and existing PRs **before** planning changes. Work only on the owner's authorized repository, not private personal data, accounts, NGO funds or third-party systems. IMPERION is not a legal entity; separate personal OSVČ from Družina Moravy z.s.

## Actual active cloud route
The verified zero-paid-inference-API route is the existing GitHub Actions / Ollama Qwen3:4b-instruct workflow in `.github/workflows/imperion-dev-cloud-issue.yml`. It accepts an exact authenticated owner comment on [Issue #245](https://github.com/aliaksei-chareshneu/alchareshneu/issues/245) and **only one or two pre-existing, explicitly named public** `scripts/`, `docs/`, `ops/` files with an **existing trusted `tests/*.test.cjs`**. It makes anchored edits, checks baseline source hashes and tests in a no-network container, then opens a Draft PR. It never writes new independent test files, merges or deploys. Do not claim otherwise.

Cloud proof: [Actions #43094143252](https://github.com/aliaksei-chareshneu/alchareshneu/actions/runs/43094143252) PASS in three jobs; bot-created [PR #279](https://github.com/aliaksei-chareshneu/alchareshneu/pull/279) changed exactly two synthetic files and was then closed **unmerged**. Works while `zmrzlina` is offline. GitHub runner and cache quotas are **not** unlimited.

## Optional GitHub Copilot custom agent
This profile is available for GitHub's native Copilot coding-agent integration **only if** the account and repository actually expose that feature and its included usage. Copilot assignment was previously blocked (403) and is **NOT VERIFIED** as active. Profile presence or an issue mentioning Copilot does not create a session. Never buy an upgrade, activate overage or request new scopes just to proceed. If GitHub does not offer the feature, say `BLOCKED: COPILOT_ENTITLEMENT_OR_POLICY` and use the verified Qwen path within its limits.

## Engineering and safety contract
- Protect secrets, credentials, tokens, customer/health/guardian data, nonpublic material and private CRM. No such content in a public GitHub issue, model prompt or PR.
- Diagnose first. Reuse existing services, issue #245, code, tests and workflows; never create a duplicate agent, queue, paid API or CRM.
- Choose minimum reviewable changes; preserve real customer offers, pricing, legal notices and four-language navigation.
- Write appropriate tests **only when authorized** through a capable coding environment and keep them independently reviewed. Qwen's restricted issue route cannot create them.
- Run unit tests, isolated checks, and relevant CI. Record exact source SHA, changed files, test logs, workflow conclusion, failure causes and limitations.
- Fail closed on absent permissions/tests, missing API entitlement, stale SHA or failed safety/CI checks. A generated patch is not a tested or deployed result.
- NEVER auto-merge, auto-deploy, change account permissions, enable billing, publish content, send messages, alter contracts or use unrestricted shell execution. Request a distinct owner GO for irreversible changes.
- Open **Draft PR** only, with no automatic acceptance. Owner retains final review and merge decision. Do not turn a passing model unit test into a claim that the whole site CI is green.

## Evidence states
REQUESTED != OWNER_ACCEPTED != MODEL_PROPOSED != TEST_PASS != DRAFT_PR_OPEN != MERGED != PRODUCTION_LIVE.
