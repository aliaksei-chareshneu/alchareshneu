# IMPERION DEV — Android and cloud operation

**Status (13 Nov 2026, Europe/Prague):** the GitHub Actions + CPU Qwen coding pipeline is **verified active** without `zmrzlina`; the GitHub Copilot Coding Agent entitlement is **NOT YET VERIFIED**. These are different systems. Public issue commands are visible to everyone; never post passwords, private customer files, bank information, schoolchildren's data or secrets.

## Confirmed owner-only cloud route (no paid model API)

From Android, use the existing signed-in GitHub app **or** a mobile browser to open:
https://github.com/aliaksei-chareshneu/alchareshneu/issues/245

Add **one new comment** in this exact form; replace the example filenames with actual, already tracked non-sensitive files:

```text
/imperion-dev cloud
file: scripts/imperion-public-example.cjs
test: tests/imperion-public-example.test.cjs
goal: Correct total() to multiply each item price by its quantity
```

For an approved two-file change add `file2:` between `file:` and `test:`:

```text
/imperion-dev cloud
file: ops/imperion-dev-cloud-fixture/multi-price.cjs
file2: ops/imperion-dev-cloud-fixture/multi-shipping.cjs
test: tests/imperion-dev-cloud-multi-fixture.test.cjs
goal: Clarify both synthetic helper comments while keeping behaviour and exports unchanged
```

The source files must already exist under `scripts/`, `docs/`, or `ops/` and pass the allowlist. The trusted independent test must already exist under `tests/`, ending in `.test.cjs`. Sensitive names, workflow/deploy files, test modification, test authoring and changes to `main` are blocked. The model cannot choose extra files. The second example is a **synthetic acceptance example**, not business price logic.

After posting, check **Actions** for `IMPERION DEV cloud issue coding (review only)`. An accepted run must show `task-preflight`, `cloud-qwen-coding` and `draft-review-pr` as **SUCCESS**. Then open the automatically generated **Draft PR**. Inspect changed files, code, trusted tests, CI, credentials and the description. **Do not merge** until independently reviewed and authorized. A branch, green sandbox test or PR alone does not prove production deployment.

The Android GitHub UI layout and exact tap labels can change. This route uses a standard issue comment, so the mobile browser is a fallback if the app does not show commenting or Actions. **Android-origin issuance specifically was NOT YET VERIFIED independently**; GitHub-side end-to-end issue→Draft PR works regardless of local Windows. Never claim a native Android test occurred if all evidence came from another device.

**Provider evidence:** [owner issue comment](https://github.com/aliaksei-chareshneu/alchareshneu/issues/245#issuecomment-6806169605) → [GitHub-hosted Actions #43094143252](https://github.com/aliaksei-chareshneu/alchareshneu/actions/runs/43094143252) (3/3 PASS) → [bot-created Draft PR #279](https://github.com/aliaksei-chareshneu/alchareshneu/pull/279) (exactly two public files, subsequently closed unmerged). The model is Qwen3:4b-instruct in a temporary GitHub runner, **not** a separate paid inference provider. GitHub runner/cache usage has quotas and may be billed if someone later changes account settings; do not enable overages.

## Optional Copilot Coding Agent — account dependent

If GitHub's native **Copilot** coding agent is already included and available for this repo, an owner can open an issue and use its **Assignees** control (mobile browser if necessary), assign Copilot, and verify a real cloud session, changed code, newly written tests, CI and review PR. GitHub's official instructions:
https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/kick-off-a-task

The existing `.github/agents/imperion-dev.agent.md` is a custom agent profile, **not** proof of eligibility, deployment or autonomous sessions. An earlier authorized attempt returned HTTP 403 and Copilot was absent from the assignable actors. Until a fresh provider readback succeeds, treat this as `BLOCKED: COPILOT_ENTITLEMENT_OR_POLICY`. Do not subscribe, buy tokens, upgrade or change permissions on speculation.

## Existing Windows fallback (not cloud)

The existing PC-bound issue [#195](https://github.com/aliaksei-chareshneu/alchareshneu/issues/195) has owner commands `/imperion-dev ping`, `/imperion-dev smoke`, `/imperion-dev build roi-brand`, `/imperion-dev build cloud-profile` (the allowlist may change; inspect actual poller before reuse). The scheduled Windows job requires `zmrzlina` online and local Ollama. Do not mistake a Windows-local run for an independent cloud service.

## Safety, cost and readback

Only owner-issued, public, narrowly scoped commands. No customer data, credentials, NGO/OSVČ mixing, source publication, automated acceptance or merge. New independent tests and unrestricted project programming are **BLOCKED** in the current CPU Qwen route. Cost: 0 Kč additional external model API subscriptions were enabled in the confirmed tests; GitHub Actions runtime quota is finite, not an unlimited guarantee.

**Proof statuses:** REQUESTED != ACCEPTED != TEST_PASS != PR_CREATED != CI_SUCCESS != MERGED != LIVE. Keep the case in the existing Issue #245 and do not duplicate the development agent or CRM.
