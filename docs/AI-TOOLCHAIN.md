# AI Toolchain — practical onboarding and execution gates (2026-10-22)

This public page is intentionally free of private Google Drive, CRM, membership, payment, or Microsoft tenant details. Source-of-truth operational statuses and account/subscription records stay in the existing private execution/benefits briefs.

## Start here: one-click operator launcher (23.10.2026)

Follow **[Russian quickstart](AI-QUICKSTART-RU.md)**. On a Windows machine with this repository and Node.js available, double-click `ops/IMPERION-AI.cmd`. It offers read-only **Status**, **Tests**, zero-network **Preview**, local-only synthetic **Ollama smoke**, **Open VS Code**, interactive **Codex read-only**, interactive **Antigravity plan+sandbox**, and CPU-only local chat. It creates no CRM, post, account, subscription, provider API key or background agent. In VS Code the equivalent manually launched commands are available under **Terminal → Run Task… → IMPERION AI** in `.vscode/tasks.json`. It intentionally does not auto-run anything on repository open.

The worktree must be updated to the merged main branch for this launcher to exist locally. GitHub updates cannot wake an offline Windows PC. Read actual auth, model quality and legal constraints below; even a 0.6B local reply is not permission to publish.

## What already exists
- `AGENTS.md` contains Codex/agent rules; `.github/copilot-instructions.md` adds GitHub Copilot repository-specific instructions (effective for clients/branches that load this file).
- GitHub Actions `Operations tests` and `Site quality` already exist. Reuse those instead of creating an extra CI runner.
- Website repo default branch is `main`; publishing branch may differ. Always verify GitHub Pages configuration before merging a public update.
- Existing PRs and issues are authoritative for current defects. Do not duplicate an open fix.

## Workstation preflight (Windows)
On an authorised workstation, run `powershell -NoProfile -File .\ops\ai-toolchain-preflight.ps1` from repository root. This only checks available binaries and VS Code extension IDs; it does not sign into accounts, transmit credentials, install anything or prove subscription entitlements.

VS Code 1.116+ bundles GitHub Copilot Chat by default; no separate Copilot/Copilot Chat extension install is required. On the verified Windows workstation, VS Code 1.136.1 reports built-in Copilot Chat 0.64.1; a legacy standalone extension attempted to downgrade this built-in dependency and was correctly rejected. Do NOT force a downgrade or treat an empty `code --list-extensions` as proof Copilot is absent. In VS Code select **Use AI Features**, sign in to the correct GitHub account, verify current plan/remaining quota in Copilot status; authentication and entitlement require an owner-authorized interactive session.

Google Antigravity CLI `agy` v1.4.5 was INSTALLED in Windows user scope on 2026-10-22 from the vendor manifest after SHA-512 binary verification. The initial PowerShell manifest request timed out, but the verified `curl` release retrieval succeeded. The binary and version were checked on the actual workstation and user PATH was set. `agy models` listed six names, but **real inference FAILED at Google's account eligibility check**; model usability, credits and personal sign-in remain BLOCKED, not a completed AI integration. Official vendor docs: https://antigravity.google/docs/cli/install/ . Do not bypass account verification, MFA or use unsafe unattended approval flags.

Microsoft 365 Copilot and GitHub Copilot are distinct products. Microsoft nonprofit approval, mailbox account identity and free/discounted plan eligibility are **not proof of a provisioned seat**. The organisation's tenant admin must verify actual product and assigned licences, then check Graph read/write permissions and budget/terms before attempting Outlook, OneDrive, Teams or Power Automate integration. Do not accept an annual payment commitment or change domain DNS/MX just to run a pilot.

## Local CPU model — use Qwen3 4B only after verification

On authorised Windows `zmrzlina`, Ollama `127.0.0.1:11434` runs on CPU after the default CUDA failure. The smaller `qwen3:0.6b` successfully responded but failed independent translation quality checks (left Russian/Ukrainian text untranslated despite preserving prices/URLs). The opt-in `ollama` backend now prefers approved local `qwen3:4b` when installed, with conservative Cyrillic/Czech-diacritic checks, manual review and zero paid calls. Run `node ops/ai-local-smoke.cjs --ollama` only with the synthetic fixture; do not infer model quality from passing fake-provider tests. Codex CLI was authenticated via ChatGPT but its attempted automated review had no verified agent output; Antigravity is still blocked at Google account eligibility, and Microsoft licensing is not proven.

## Engineering pipeline (review-first)
Existing issue -> current repo/branch read -> minimal code change with whichever permitted IDE agent is actually available -> local/repo tests -> reviewable PR -> CI readback -> owner authorisation for merge -> inspect the real GitHub Pages publishing branch -> production URL readback -> record only accepted end-user result.

Resolved regression reference: [form ingestion issue #13](https://github.com/aliaksei-chareshneu/alchareshneu/issues/13) was closed 2026-10-17 after owner-authenticated synthetic Form→Leads/Telegram and same-ID replay checks. Use `.github/prompts/revenue-form-audit.prompt.md` **only to triage newly evidenced regressions**, not as an open implementation order. Select current work from existing open issues and the private canonical execution queue, verify its legal/approval gates, and prefer real missed revenue or obligations over synthetic activity. A browser thank-you page alone never proves a new CRM lead, and private CRM/customer data never belong in GitHub.

## Approved channel pipeline
Source material created by us or licensed -> written rights/consent check -> original short/copy -> owner preview -> **existing** publisher queue -> verified provider post ID and public permalink -> optional opted-in enquiries in **existing** CRM -> agreed order -> invoicing -> cleared payment. Do not reuse copyrighted third-party trending clips as source files and do not mark queued/error posts as LIVE.

## Acceptance / blocking
At every handoff, distinguish VERIFIED, DRAFT/PR, BLOCKED, and NOT VERIFIED. AI assistants do not bypass legal-entity separation, contracts, privacy, access approvals or spend authorisation. A script/configuration checked into GitHub does not install an IDE, provision Microsoft, create a schedule, connect a mailbox or deploy production.
