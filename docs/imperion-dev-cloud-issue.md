# IMPERION DEV Agent — verified Stage 9 cloud issue coding (review-only)

**Entity:** personal OSVČ. **Repository:** aliaksei-chareshneu/alchareshneu.
**Owner authorization history:** On 9 Nov 2026, GO covered isolated development only. On 10 Nov 2026, the owner separately authorized and completed merges of reviewed PRs #250 and #258; on 11 Nov the owner confirmed enabling GitHub Actions to create pull requests. Agent-generated changes remain review-only: no automatic merging, deployment, purchases or paid inference API.
**Cost model:** GitHub-hosted CPU with local Ollama qwen3:4b-instruct, no paid inference API or account secrets. GitHub runner quotas and electricity have nonzero resource cost; never enable billed overage.
**Case:** IMP-DEV-CLOUD-ISSUE-20261109.

## Reuse rather than duplicate

- This is an extension of existing IMPERION DEV work, not a separate public app, CRM, database, queue, or paid provider.
- [Owner command channel #195](https://github.com/aliaksei-chareshneu/alchareshneu/issues/195) remains the **on-PC fallback**, polled by Windows Task Scheduler using local Qwen3.5 4B, only while zmrzlina is on.
- [Cloud acceptance #245](https://github.com/aliaksei-chareshneu/alchareshneu/issues/245) is the original permanent owner-only audit. **Stage 9 LIVE in main** since reviewed PR #272 (merged commit `7832005393d72b43308932acc1140fc8ab937346`): exact commands by the repository owner on **any open public issue also created by that owner** use the same workflow. Other issue creators or commenters are rejected. Distinct issue #293 passed complete real Python acceptance.
- Existing [Draft PR #231](https://github.com/aliaksei-chareshneu/alchareshneu/pull/231) is unrelated older work; do not merge old site versions or restore superseded tariffs. [PR #247](https://github.com/aliaksei-chareshneu/alchareshneu/pull/247) is already MERGED and provides the GitHub agent profile, Android guide and offline acceptance tests.

## How to submit (active in main, Stage 9)

From the signed-in repository owner account in GitHub Mobile or a browser, add the exact command to original Issue #245 **or any open public Issue created by the same owner**. Issue #293 was the independent proof. Never put private tasks, credentials, customer data or guardian information in public issues. Android-device-origin input specifically remains unverified; the ordinary GitHub issue comment route works independently of the Windows PC.

    /imperion-dev cloud
    file: scripts/imperion-public-example.cjs
    test: tests/imperion-public-example.test.cjs
    goal: Correct total() to multiply each item price by its quantity

For the first owner-authorized end-to-end cloud acceptance, use this exact public, deliberately broken fixture; the patch is proposed for a Draft PR only:

    /imperion-dev cloud
    file: ops/imperion-dev-cloud-fixture/normalize.cjs
    test: ops/imperion-dev-cloud-fixture/check.cjs
    goal: Correct total(items): each price must be multiplied by quantity, using an empty-array-safe sum.

The complete fixture file/test pair is an explicitly validated exception to normal path restrictions. This confirms real GitHub issue → cloud Qwen → independent test → Draft PR without modifying application code or prices. It does not establish native Android app provenance until a command is submitted from that device and observed.

For later non-synthetic work, replace the file and test with real **already tracked** public paths from this repo. A suitable trusted test must exist before submitting. One or two pre-existing source files can be edited per command. For a coordinated two-file change, insert an optional `file2: ops/approved-public-module.cjs` line **immediately after** the `file:` line, before `test:`. The model proposes a separate anchored replacement for each file, both original SHA-256 digests are validated before either edit is staged, and the exact two-file diff is verified before the bot can create a Draft PR. The same independently maintained pre-existing test must pass after **both** edits. This is bounded multi-file coding, not a general-purpose multi-repo agent or independently generated new tests. Accepted source paths: non-sensitive .js, .cjs, .md under scripts/, docs/, ops/ (one or two files), or **one** approved .py file under scripts/ or ops/ paired with an already-tracked tests/test_*.py unittest; Python file2/mixed-language tasks are blocked. Independent tests stay read-only under tests/; sensitive paths, .github, credentials, billing, auth, registration, deployment, personal data and private code are rejected. This is NOT yet a universal multi-file programmer.

GitHub issue comments are public. Never include account details, tokens, customer records, health data, legal matters, passwords or unpublished financial information. Only your GitHub account (repository owner), with correct GitHub author association, can trigger execution. No direct shell execution or model-selected paths.

## Execution and proof states

1. issue_comment event on **default branch main** → exact GitHub owner/issue/task checks and unit tests (task-preflight).
2. An ephemeral GitHub-hosted Ubuntu CPU runner starts isolated Ollama qwen3:4b-instruct using the existing public model cache. No zmrzlina and no paid model API.
3. The model proposes strict JSON old/new for one or two validated public JS/docs paths, or one validated Python path. It cannot execute shell, pick a new path, access GitHub credentials, or deploy anything.
4. The controller confirms exactly one old substring, an unchanged baseline source SHA and bounded patch size. A copy of the source is tested under Docker with no network, a read-only filesystem, no privileges, unprivileged UID, restricted memory and process count.
5. Passing proof is kept as a GitHub Actions artifact for 3 days. MODEL_PROPOSAL_ONLY is not ISOLATED_TRUSTED_TEST_PASS.
6. **Only after tests**, an independent workflow job with separate GitHub token permissions (subject to owner review) may push a unique review branch and attempt gh pr create --draft. Duplicate comment IDs never create duplicate PRs; a surviving branch without PR is reported BLOCKED.
7. Read back from GitHub to prove an open Draft PR. Nothing merges, deploys, publishes, changes prices, or sends customer messages.

**Verified activation:** The `AFTER owner-approved activation` precondition was fulfilled by owner-authorized PRs #250 and #258 on 10 Nov 2026. GitHub Actions' repository permission to create Draft pull requests was confirmed by its actual use on 11 Nov 2026: [issue comment #6787842684](https://github.com/aliaksei-chareshneu/alchareshneu/issues/245#issuecomment-6787842684) → [cloud workflow #42965529871](https://github.com/aliaksei-chareshneu/alchareshneu/actions/runs/42965529871) (3/3 jobs SUCCESS) → bot-created [Draft PR #268](https://github.com/aliaksei-chareshneu/alchareshneu/pull/268). This proves owner issue submission, Qwen inference, independent sandbox tests, and automated review PR creation.

**Still NOT verified / BLOCKED for broader scope:** An issue comment *specifically originating from Android* has not been independently tested; unrestricted multi-file coding, automatically writing independent new tests, reading private repositories, changes to access controls, and deployment are not part of this stage. The developer must review all model-generated changes, pass relevant CI and specifically approve each merge. A GitHub Pages publication and successful PR checks are distinct from a Draft PR.

**CI baseline warning (11 Nov 2026):** The unrelated site-wide browser regression suite fails on `main` as well, including older registration-catalog and home-page tests; do not silently waive the failures or mark this entire repository green. The DEV-specific cloud preflight and sandbox Qwen checks are independently passing.

**Owner command link and audit:** https://github.com/aliaksei-chareshneu/alchareshneu/issues/245 . Commands are accepted in this Issue **and in any open public issue created by the same repository owner**, provided the comment also originates from the authenticated owner. Each (issue number, comment ID) gets a unique review branch. The four-line syntax is used for one source, five lines for two JS/docs sources. Do not re-send accepted comments. GitHub runner minutes and cache quota are finite; no unlimited or billing-free guarantee.

**The code does not autonomously author separate test files.** It requires an already tracked trusted test, either tests/*.test.cjs for JS/docs or tests/test_*.py for one Python source, and independently verifies it. Up to two JS/docs files can be edited, but unrestricted multi-file engineering and private tasks remain out of scope.

## Preview acceptance before any main merge

An isolated Draft PR against the latest main triggers pull_request preview only for the dedicated review branch. It must show:
- Unit tests for scripts/imperion-dev-cloud-issue.cjs pass locally and in GitHub.
- The public fixture ops/imperion-dev-cloud-fixture/normalize.cjs fails its trusted test before patch.
- A real Qwen inference on **GitHub Actions** creates a bounded code replacement.
- Re-running the trusted test in a no-network Docker container on the staged patch passes.
- The source branch, artifact, workflow/job conclusion and the exact commit SHA are verified.
- PR remains Draft; main and production do not change.

## Fail-closed conditions

Invalid actor or non-owner-created Issue, closed Issue, malformed command, missing trusted test, sensitive path, unsafe output, non-unique anchor, mismatched SHA, syntax error, test failure, timeout, GitHub permission block or duplicate branch without Draft PR: status BLOCKED, no merge or deployment. Up to one safe model-output-format retry per source is allowed; no repeated public comments or publication.

GitHub official references:
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#issue_comment
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository

## Stage 8 — bounded two-file acceptance (review-only)

This second fixture uses two separate **public, synthetic** arithmetic helpers with an independently maintained, already passing trusted test. It does not change any production price or event record. After the Stage 8 reviewed code has been merged into main, the signed-in repository owner can submit one unique comment to existing Issue #245:

    /imperion-dev cloud
    file: ops/imperion-dev-cloud-fixture/multi-price.cjs
    file2: ops/imperion-dev-cloud-fixture/multi-shipping.cjs
    test: tests/imperion-dev-cloud-multi-fixture.test.cjs
    goal: Add a concise explanatory comment to each helper function without changing outputs or exports.

Acceptance is complete only when a new GitHub Actions issue_comment workflow independently verifies **two model proposals**, tests both changes in a no-network container, the publisher commits exactly those two source files, and GitHub reports a bot-created OPEN/DRAFT review PR. A model proposal or a green baseline alone is insufficient. Reject duplicate comments and do not merge these purely synthetic patches into the main branch.

## Stage 9 — owner-created issues and bounded Python unittest support (review only)

**LIVE — verified on 13 Nov 2026.** Reviewed PR #272 merged at `7832005393d72b43308932acc1140fc8ab937346`. Reuses exactly the same GitHub Actions workflow and CPU Qwen model, preserving the two-file JS mode and retries. No new agent, queue, CRM, paid API, secrets or repository permissions.

- Source authentication checks repository, issuer, issue creator, author association, issue number/state and immutable comment ID; only the exact `/imperion-dev cloud` command is accepted. Every task uses a branch unique to `(issue_number, comment_id)` and produces only an OPEN Draft PR.
- A single non-sensitive tracked `scripts/*.py` or `ops/*.py` file may be paired with a pre-existing tracked `tests/test_*.py`. Python + `file2` and mixed JS/Python tests are rejected. The selected Python unittest is run in Python 3.12 inside the no-network, read-only, non-root Docker sandbox; **zero discovered tests are BLOCKED**, not PASS. The original public source and its SHA are validated before any edit; Python output is syntax-checked before acceptance. No new packages or test-authoring capability is provided.
- Existing one/two-file JS tasks, trusted tests, source SHA gates, short retries, exact diff and review-only publisher remain. **Live Python from an owner-created Issue is VERIFIED** by independent Issue #293 → GitHub Action #43422929579 (3/3 SUCCESS) → bot-created Draft PR #294 (one Python file), closed unmerged after readback. Actual Android-device origin, unrestricted engineering and autonomous new-test writing are **NOT VERIFIED**.

### Stage 9 real cloud Python preview (review-only)

PR #272 contains a synthetic, deliberately broken public Python arithmetic helper plus three independent unittest assertions. In its pull-request review job, the same hosted Qwen CPU model first proves the legacy JS fixture, then produces a separate Python patch. A trusted verifier must observe the Python baseline **FAIL**, check the model proof and source SHA, apply the patch only in a temporary copy, validate Python syntax, then obtain **3/3 PASS** from a no-network read-only unprivileged Python container. This preview does not write a Python PR or deploy. **Proof confirmed:** the revised PR #272 exact-head Qwen run #43421624030 passed; subsequently the signed-in owner posted a Python command in independent Issue #293 (comment #6852467457), GitHub Actions #43422929579 independently reported task-preflight, cloud-qwen-coding and draft-review-pr all SUCCESS, with Python baseline FAIL and isolated trusted 3/3 PASS. GitHub-actions[bot] opened Draft PR #294 with only ops/imperion-dev-cloud-fixture/normalize_py.py. Both PR #294 and Issue #293 were closed after evidence, **without merging** the synthetic fix. This proves live Stage 9, not unrestricted coding or mobile device provenance.
