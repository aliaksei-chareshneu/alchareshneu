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

**Stage 12 code-repair gate:** if the first isolated, independently maintained trusted tests fail, the existing Qwen controller may propose ONE replacement patch against the SAME original tracked source(s) and SHA, using a bounded read-only failure hint. The entire fixed-template advisory witness and independent Docker tests run again in a new temporary sandbox. A second failure blocks publication; no self-approved merge or broader permissions. Only this narrow one-retry route is implemented, NOT unrestricted automatic debug/refactor loops.

## Stage 13 — Project 00 model upgrade, Free-only (14 Nov 2026)

**Owner GO received 14 Nov:** replace the default model inside EXISTING Developer Agent #1, preserve issue -> tests -> Draft PR, zero new subscription/API fees, no new agent or CRM. This section supersedes the Stage 12 *proposed model default* after deployment; previous Stage 9/11 facts remain historical.

**New default in this PR (NOT LIVE before merge and postmerge proof):** Groq hosted `openai/gpt-oss-120b`. Existing personal `GROQ_API_KEY` secret was successfully used for a manual **public source** no-send Groq draft in Actions run 42593552282 on Nov 09, but current credential, individual free quota and provider billing protection require fresh readback. Groq official public Free baseline for GPT-OSS120B is 30 RPM / 1000 RPD / 8000 TPM / 200000 TPD, **account limits may differ**. Exact current published source: https://console.groq.com/docs/rate-limits . This is a remote public-code-only AI model, NOT a paid inference entitlement via a ChatGPT/Perplexity subscription.

**Model selection in existing GitHub repository variables (not automatically changed in account settings):**
- Default: `IMPERION_DEV_PROVIDER=groq`, `IMPERION_DEV_MODEL=openai/gpt-oss-120b` (both default if absent).
- Optional same-provider model: `IMPERION_DEV_PROVIDER=groq`, `IMPERION_DEV_MODEL=qwen/qwen3.8-27b`. **Actual provider account acceptance unverified**; test before production selection.
- Explicit historical baseline: `IMPERION_DEV_PROVIDER=ollama`, `IMPERION_DEV_MODEL=qwen3:4b-instruct`; separate CPU model `qwen3.5:4b` is opt-in, hosted acceptance not verified. Groq HTTP failure, 429, missing Free approval, invalid response, bad model or billable fallback **BLOCKS**; it NEVER silently switches to a paid provider. The Ollama route is intentionally separate so receipt model identity remains true.

**Trusted GH workflow admission:** owner-only GitHub issue comment or owner controlled PR preview; no private customer, NGO, CRM, medical, research, child, email or bank data. `GROQ_API_KEY` is sourced only from existing Actions Secret; the workflow refuses to call Groq without `GROQ_VERIFIED_FREE_PLAN=true`, explicit `IMPERION_DEV_FREE_ONLY=FREE-ONLY`, a fresh authenticated GitHub run-history check, and a matching approved model. There are at most **3 GitHub DEV model runs in a rolling 24 h period since activation**, with at most 10 model calls and a conservative estimated 50k token reservation per run. Each call rejects HTTP429/other failures and truncation; independent trusted tests still run in no-network, read-only non-root Docker. The project does not auto-buy, subscribe, merge, deploy or publish. This is a software cost guard, **not independent bank/provider billing verification**.

**Scope/quality:** Stage 12 old-code FAIL / patched-code PASS model-suggested behavior test, one bounded advisory retry, one bounded code retry after independent trusted tests fail, fixed SHA and exact scope continue. They do not turn model-generated tests into independent acceptance. All valid changes create GitHub **Draft PR** for owner inspection; production merge is not part of the issue worker.

**Real acceptance needed after merge:** owner public synthetic Issue command -> GitHub Actions Groq provider identity and free receipt -> independent Docker PASS -> bot Draft PR (not merged) -> readback. Without that, status remains `CODE_STAGED`, not `MODEL_CHANGED_LIVE`. Provider billing/real quota and personal Antigravity entitlement remain separately unverified (Antigravity CLI current authentication reported Eligibility check failed on Nov 14).

## Stage 14 — safe operating mode and truthful GitHub PR receipts (15 Nov 2026)

- **Primary provider remains Groq `openai/gpt-oss-120b`**, confirmed by real GitHub-owner Issue #245 comment #6882684583 -> Actions #43629991834 (three jobs SUCCESS) -> bot [Draft PR #323](https://github.com/aliaksei-chareshneu/alchareshneu/pull/323), open and not merged. The original public fixture correction now checks a new negative-quantity example; model-generated advisory tests are NOT independent evidence.
- **Preview PRs are offline-only.** The existing `task-preflight` runs immutable JS mock/negative/security tests without a model key. Cloud inference and bot Draft PR publication execute only for verified `issue_comment` owner commands. Therefore ordinary PR pushes no longer consume the limited Groq Free allowance. A PR check's `cloud-model-coding` SKIPPED means no real model was used in that preview, not an integration failure.
- **Race-safe quota admission.** Every owner-issued model job uses the *same* GitHub job concurrency group with `cancel-in-progress: false`. The provider-owned Actions run history is checked after entering the serialized job, before Groq request authorization. GitHub Actions `queue: max` (introduced May 2026) preserves up to 100 pending owner issue jobs instead of canceling the older pending job; the official maximum queue time is 24 hours and jobs beyond the limits can still be cancelled. Read back each Actions run; this is not an infinite durable queue. Up to three admitted runs in the last 24 hours, ten calls, and a conservative 50,000 estimated tokens/run; failures and incomplete history block, no paid fallback. Other scripts/other model users may have independent provider quotas; this is not global organization billing control.
- **No misleading model claims.** Bot-created Draft PR metadata reads and verifies the actual `model` from the signed-off proposal against the model allowlist and carries both actual provider and model. `qwen3:4b-instruct` is only the explicit Ollama reserve; do not describe a successful Groq run as Qwen.
- **Cost truth.** A secret's presence, GitHub's `GROQ_VERIFIED_FREE_PLAN=true` execution flag, and the no-paid-fallback code DO NOT verify the vendor billing plan. Groq officially states Free and Developer are different plans and Developer can bill per-token. The owner should independently inspect [Groq Billing](https://console.groq.com/docs/billing-faqs) and the current [account rate limits](https://console.groq.com/docs/rate-limits) before relying on a strict 0 Kč long-term guarantee. No console settings, cards, upgrades, budgets, subscriptions or entitlements were altered by this code change.
- **External head CI limitation.** GitHub may show `action_required`/no automated PR-head jobs on PRs created using GitHub Actions token. The acceptance evidence is the *issuing* workflow's three completed jobs, original source/test diff and owner review, NOT untriggered PR-head CI. Do not merge automatically. Site-wide `browser-regression` on an unrelated workflow run was cancelled while other website PRs were active; this is not evidence of website-green or model regression.
- Owner action remains optional for each public synthetic coding Draft PR: inspect exact changed code and the source of any independent trusted test. For production code, require a separate explicit merge GO and site/live verification.


## Stage 15 — bounded three-file development and real failure diagnosis (15 Nov 2026)

**Owner approved expanding development capabilities, not new paid subscriptions, unrestricted private-code access, autonomous merge or deployment.** The existing GitHub Issue -> Groq Free / explicit Ollama -> independent Docker tests -> bot Draft PR stays in place.

- **Autonomous selection expands to 1–3 existing public JS/CJS sources** inside a single owner-specified scripts, docs or ops directory. Every selected source filename must appear in an existing independently maintained trusted tests/*.test.cjs. Files must already exist. Legacy /imperion-dev cloud remains limited to 1–2 explicit JS sources or one Python source; no wider Python autonomy is implied.
- Model now sees bounded read-only context snippets of the other two selected sources; each model patch is checked by exact original source SHA, path and source order. Only the trusted controller writes the isolated sandbox and review-only Draft PR.
- When real trusted Docker tests fail, one repair receives **minimized sanitized failing TAP test names and bounded numeric mismatches**. It never gets raw CI logs, stack traces, local paths, email addresses, tokens or environment values. Retry stays inside original file set, original source SHA, original independent trusted test, one code retry, and the baseline-failing advisory behavior witness. Fail closed on invalid data, quota, bad model response or invalid source patch.
- Model-generated advisory test cases remain NON-INDEPENDENT; changing behavior requires a generated witness that fails on unchanged source and passes after patch plus independent trusted tests. New modules without pre-existing trusted tests, whole applications, private sources, deployments, auto-merges and customer messages remain outside this approval.
- Acceptance is a three-file synthetic fixture with tests for safe selection, no fourth file, unchanged original source validation, model mock, test generation, and actual isolated Node test execution. A real post-merge three-file owner GitHub Issue -> Draft PR test is a separate milestone and is NOT proven by the CI unit suite.

Sample for later unique owner task (do not duplicate previous owner acceptance comments):

    /imperion-dev autonomous
    scope: ops/imperion-dev-cloud-fixture
    test: tests/imperion-dev-cloud-three-fixture.test.cjs
    goal: Clarify only the existing helper comments while preserving all outputs.

**Cost:** existing Groq Personal Free plan and shown November projected $0.01 were verified by user screenshots; $0.01 was explicitly non-billable without upgrading. Do not change tariff, payment card, permissions or add any new model API. Strict existing per-run/24h Groq gates remain enforced.
