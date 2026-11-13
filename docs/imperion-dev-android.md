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


## Stage 11 — autonomous bounded coding from a goal (review-gated)

Once the reviewed Stage 11 workflow is activated on `main`, the owner can start a complete cloud coding attempt **without naming individual source files**. Use one new comment on an **open PUBLIC issue created by that same owner**:

```text
/imperion-dev autonomous
scope: ops/imperion-dev-cloud-fixture
test: tests/imperion-dev-cloud-multi-fixture.test.cjs
goal: Clarify the public pricing helper comment while preserving existing outputs.
```

The four-line command must be literal with exactly these labels and their own lines; replace `scope`, `test` and `goal` with an approved real public task. Do not repeatedly send the synthetic QA command above after acceptance. It consumes finite GitHub runner minutes, not a guaranteed free unlimited API.

Qwen3:4b-instruct reads a **single specified public directory**, and from 1–8 already-tracked related JS/CJS candidates **explicitly referenced by the specified existing independent `.test.cjs`** selects up to two source files. It proposes their bounded anchored modifications, plus **model-suggested JSON-only test cases**. A trusted controller builds one new `tests/generated/imperion-dev-auto-ISSUE-COMMENT.test.cjs` advisory test, with no model-supplied executable test code. The pre-existing independent test and advisory test must both pass, in isolated no-network non-root read-only Docker, before a bot-created **Draft PR** can appear. You must review the PR before any merge. The new test is *not* independent evidence: its expected outputs came from the same model.

**Fail-closed rules:** no trusted test, private or sensitive path, source not explicitly referenced by that test, >2 selected sources, Python/source language mixing, malformed JSON, model guessing wrong expected values, changed SHA, test failure, lost GitHub permission or duplicate review branch → BLOCKED, no merge or deploy. Stage 9 explicit-file command continues to support its existing bounded single-file Python route; Stage 11 self-selection is JS/CJS only.

**Evidence boundary:** code and tests in a PR are not proof of LIVE. The feature becomes verified only after a real owner-authored Issue comment triggers GitHub Actions and GitHub confirms its own Draft PR with the expected changes and test logs. No automatic merges, deployments, paid APIs, secrets or changes to customer/NGO data. Native Android app-origin issuance and paid Copilot availability remain independently UNVERIFIED.

## Stage 12 review — model selection and behavior-test safeguards (NOT LIVE until merged)

The existing cloud execution model is **qwen3:4b-instruct** on ephemeral GitHub Actions CPU/Ollama. The Windows poller is separate (local `imperion-qwen35:4b`); do not copy any ChatGPT/Codex/Copilot authentication into GitHub Actions.

On review and with separately authorized repository settings, `IMPERION_DEV_MODEL` may select exactly `qwen3:4b-instruct` (default) or `qwen3.5:4b` (alternative). The latter's Ollama tag exists, but passing this branch's offline allowlist tests is **not** a hosted Qwen3.5 inference acceptance. A real hosted preview and quota check is mandatory before claiming it usable. Unknown values fail before model download, and there is no fallback to paid inference or additional credentials.

For functional changes in Stage 11, the new fixed-template advisory test must fail against ORIGINAL public source before it may count as behavior evidence. If it passes on original, a controller permits at most **one bounded re-draft** of JSON-only advisory cases; another green original test blocks the PR. The independent pre-existing test must still pass in a no-network, non-root, read-only Docker container. Advisory test data from the same model is **never independent proof**. Comment-only changes may keep unchanged original behavior and are not required to fail baseline.

Current restrictions persist: no unattended arbitrary repo changes, private tasks, unknown providers, unapproved account settings, production merges, deploys, permission escalation, recurring costs or customer messages. A task passing the issue workflow is not automatically `pull_request`-head CI green; bot PR workflows can show `action_required` and require separate GitHub review.

Stage 12 acceptance is limited to a Draft PR with real GitHub Actions readback. The owner must approve any future merge separately.
