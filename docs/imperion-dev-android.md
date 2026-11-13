# IMPERION DEV — Android and cloud operation

**Status (13 Nov 2026, Europe/Prague):** the GitHub Actions + CPU Qwen coding pipeline is **verified active** without `zmrzlina`; the GitHub Copilot Coding Agent entitlement is **NOT YET VERIFIED**. These are different systems. Public issue commands are visible to everyone; never post passwords, private customer files, bank information, schoolchildren's data or secrets.

## Confirmed owner-only cloud route (no paid model API)

From Android, use the existing signed-in GitHub app **or** a mobile browser to open original [Issue #245](https://github.com/aliaksei-chareshneu/alchareshneu/issues/245) **or any open public issue created by this same repository owner**. The command must also be posted by that signed-in owner. The second mode is now LIVE and was verified by independent Issue #293 → GitHub Actions #43422929579 → Draft PR #294 (closed unmerged).

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

The JS/Markdown source files must already exist under `scripts/`, `docs/`, or `ops/` and pass the allowlist. One or two such files can be requested with an already tracked, read-only `tests/*.test.cjs`. **Stage 9 Python mode is now LIVE:** one non-sensitive existing `.py` source under `scripts/` or `ops/` may be paired with an existing read-only `tests/test_*.py` unittest. A second Python file (`file2`), Python/JS mixed-source tasks, missing trusted tests, sensitive paths, workflow/deploy files, test modification, test authoring and changes to `main` are blocked. The model cannot choose extra files. The second example is a **synthetic acceptance example**, not business price logic.

For a bounded Python task, the following **four actual lines** are a tested synthetic example (indented here, not a new automation or a task to repeat):

    /imperion-dev cloud
    file: ops/imperion-dev-cloud-fixture/normalize_py.py
    test: tests/test_imperion_dev_cloud_python_fixture.py
    goal: Correct total(items) by multiplying each row price by its qty, preserving zero for empty lists and using no imports.

Do not re-send this historical QA task. Replace its paths with the actual approved source/test from the existing repository and verify the allowlist first. The model can use public trusted-test expectations but cannot edit or author independent tests.

After posting, check **Actions** for `IMPERION DEV cloud issue coding (review only)`. An accepted run must show `task-preflight`, `cloud-qwen-coding` and `draft-review-pr` as **SUCCESS**. Then open the automatically generated **Draft PR**. Inspect changed files, code, trusted tests, CI, credentials and the description. **Do not merge** until independently reviewed and authorized. A branch, green sandbox test or PR alone does not prove production deployment.

The Android GitHub UI layout and exact tap labels can change. This route uses a standard issue comment, so the mobile browser is a fallback if the app does not show commenting or Actions. **Android-origin issuance specifically was NOT YET VERIFIED independently**; GitHub-side end-to-end issue→Draft PR works regardless of local Windows. Never claim a native Android test occurred if all evidence came from another device.

**Provider evidence — JS:** [Issue #245 owner comment](https://github.com/aliaksei-chareshneu/alchareshneu/issues/245#issuecomment-6806169605) → [Actions #43094143252](https://github.com/aliaksei-chareshneu/alchareshneu/actions/runs/43094143252) (3/3 PASS) → bot-created Draft PR #279 (two files, closed unmerged). **Provider evidence — Python + arbitrary owner-created Issue:** [Issue #293 comment](https://github.com/aliaksei-chareshneu/alchareshneu/issues/293#issuecomment-6852467457) → [Actions #43422929579](https://github.com/aliaksei-chareshneu/alchareshneu/actions/runs/43422929579) (3/3 PASS; Python trusted baseline FAIL, isolated after-fix unittest 3/3 PASS) → [bot-created Draft PR #294](https://github.com/aliaksei-chareshneu/alchareshneu/pull/294) (one Python file, closed unmerged). The model is Qwen3:4b-instruct on a temporary GitHub runner, **not** a paid inference API. GitHub runner/cache usage has quotas and can incur charges if account controls change; never enable overages.

## Optional Copilot Coding Agent — account dependent

If GitHub's native **Copilot** coding agent is already included and available for this repo, an owner can open an issue and use its **Assignees** control (mobile browser if necessary), assign Copilot, and verify a real cloud session, changed code, newly written tests, CI and review PR. GitHub's official instructions:
https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/kick-off-a-task

The existing `.github/agents/imperion-dev.agent.md` is a custom agent profile, **not** proof of eligibility, deployment or autonomous sessions. An earlier authorized attempt returned HTTP 403 and Copilot was absent from the assignable actors. Until a fresh provider readback succeeds, treat this as `BLOCKED: COPILOT_ENTITLEMENT_OR_POLICY`. Do not subscribe, buy tokens, upgrade or change permissions on speculation.

## Existing Windows fallback (not cloud)

The existing PC-bound issue [#195](https://github.com/aliaksei-chareshneu/alchareshneu/issues/195) has owner commands `/imperion-dev ping`, `/imperion-dev smoke`, `/imperion-dev build roi-brand`, `/imperion-dev build cloud-profile` (the allowlist may change; inspect actual poller before reuse). The scheduled Windows job requires `zmrzlina` online and local Ollama. Do not mistake a Windows-local run for an independent cloud service.

## Safety, cost and readback

Only commands in open public Issues created by the owner and posted by that same owner are accepted. No customer data, credentials, NGO/OSVČ mixing, production publication, automatic acceptance or merge. The CPU Qwen route can edit at most two selected JS/Markdown sources or one selected Python source, with an **existing** trusted test; authoring NEW independent tests and unrestricted project programming remain **BLOCKED**. Cost: 0 Kč additional external model API subscriptions were enabled in the confirmed tests; GitHub Actions runtime quota is finite, not an unlimited guarantee.

**Proof statuses:** REQUESTED != ACCEPTED != TEST_PASS != PR_CREATED != CI_SUCCESS != MERGED != LIVE. Keep the case in the existing Issue #245 and do not duplicate the development agent or CRM.
