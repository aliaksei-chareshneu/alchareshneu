# AI Toolchain — practical onboarding and execution gates (2026-10-22)

This public page is intentionally free of private Google Drive, CRM, membership, payment, or Microsoft tenant details. Source-of-truth operational statuses and account/subscription records stay in the existing private execution/benefits briefs.

## What already exists
- `AGENTS.md` contains Codex/agent rules; `.github/copilot-instructions.md` adds GitHub Copilot repository-specific instructions (effective for clients/branches that load this file).
- GitHub Actions `Operations tests` and `Site quality` already exist. Reuse those instead of creating an extra CI runner.
- Website repo default branch is `main`; publishing branch may differ. Always verify GitHub Pages configuration before merging a public update.
- Existing PRs and issues are authoritative for current defects. Do not duplicate an open fix.

## Workstation preflight (Windows)
On an authorised workstation, run `powershell -NoProfile -File .\ops\ai-toolchain-preflight.ps1` from repository root. This only checks available binaries and VS Code extension IDs; it does not sign into accounts, transmit credentials, install anything or prove subscription entitlements.

VS Code 1.116+ bundles GitHub Copilot Chat by default; no separate Copilot/Copilot Chat extension install is required. On the verified Windows workstation, VS Code 1.136.1 reports built-in Copilot Chat 0.64.1; a legacy standalone extension attempted to downgrade this built-in dependency and was correctly rejected. Do NOT force a downgrade or treat an empty `code --list-extensions` as proof Copilot is absent. In VS Code select **Use AI Features**, sign in to the correct GitHub account, verify current plan/remaining quota in Copilot status; authentication and entitlement require an owner-authorized interactive session.

Google Antigravity CLI `agy` official Windows installation details: https://antigravity.google/docs/cli/install/ . Download and review the vendor PowerShell installation script before running it on an authorized workstation. The verified installer uses a vendor manifest and SHA-512 verification. On 2026-10-22 a Windows attempt was BLOCKED by a manifest endpoint timeout: `agy.exe` was NOT installed/verified. Retry only once connectivity to the vendor release endpoint is available; then check `agy --version`, authenticate, verify selectable models/quota and repo trust. Never pipe a new installer blindly to an elevated shell. Use a disposable/synthetic change before unattended write commands.

Microsoft 365 Copilot and GitHub Copilot are distinct products. Microsoft nonprofit approval, mailbox account identity and free/discounted plan eligibility are **not proof of a provisioned seat**. The organisation's tenant admin must verify actual product and assigned licences, then check Graph read/write permissions and budget/terms before attempting Outlook, OneDrive, Teams or Power Automate integration. Do not accept an annual payment commitment or change domain DNS/MX just to run a pilot.

## Engineering pipeline (review-first)
Existing issue -> current repo/branch read -> minimal code change with whichever permitted IDE agent is actually available -> local/repo tests -> reviewable PR -> CI readback -> owner authorisation for merge -> inspect the real GitHub Pages publishing branch -> production URL readback -> record only accepted end-user result.

Resolved regression reference: [form ingestion issue #13](https://github.com/aliaksei-chareshneu/alchareshneu/issues/13) was closed 2026-10-17 after owner-authenticated synthetic Form→Leads/Telegram and same-ID replay checks. Use `.github/prompts/revenue-form-audit.prompt.md` **only to triage newly evidenced regressions**, not as an open implementation order. Select current work from existing open issues and the private canonical execution queue, verify its legal/approval gates, and prefer real missed revenue or obligations over synthetic activity. A browser thank-you page alone never proves a new CRM lead, and private CRM/customer data never belong in GitHub.

## Approved channel pipeline
Source material created by us or licensed -> written rights/consent check -> original short/copy -> owner preview -> **existing** publisher queue -> verified provider post ID and public permalink -> optional opted-in enquiries in **existing** CRM -> agreed order -> invoicing -> cleared payment. Do not reuse copyrighted third-party trending clips as source files and do not mark queued/error posts as LIVE.

## Acceptance / blocking
At every handoff, distinguish VERIFIED, DRAFT/PR, BLOCKED, and NOT VERIFIED. AI assistants do not bypass legal-entity separation, contracts, privacy, access approvals or spend authorisation. A script/configuration checked into GitHub does not install an IDE, provision Microsoft, create a schedule, connect a mailbox or deploy production.
