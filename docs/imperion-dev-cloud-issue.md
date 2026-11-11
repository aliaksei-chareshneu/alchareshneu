# IMPERION DEV Agent — cloud issue coding (Stage 7, review-only)

**Entity:** personal OSVČ. **Repository:** aliaksei-chareshneu/alchareshneu.
**Owner authorization history:** On 9 Nov 2026, GO covered isolated development only. On 10 Nov 2026, the owner separately authorized and completed merges of reviewed PRs #250 and #258; on 11 Nov the owner confirmed enabling GitHub Actions to create pull requests. Agent-generated changes remain review-only: no automatic merging, deployment, purchases or paid inference API.
**Cost model:** GitHub-hosted CPU with local Ollama qwen3:4b-instruct, no paid inference API or account secrets. GitHub runner quotas and electricity have nonzero resource cost; never enable billed overage.
**Case:** IMP-DEV-CLOUD-ISSUE-20261109.

## Reuse rather than duplicate

- This is an extension of existing IMPERION DEV work, not a separate public app, CRM, database, queue, or paid provider.
- [Owner command channel #195](https://github.com/aliaksei-chareshneu/alchareshneu/issues/195) remains the **on-PC fallback**, polled by Windows Task Scheduler using local Qwen3.5 4B, only while zmrzlina is on.
- [Cloud acceptance #245](https://github.com/aliaksei-chareshneu/alchareshneu/issues/245) is a **public owner-only issue** to request bounded coding from Android or desktop.
- Existing [Draft PR #231](https://github.com/aliaksei-chareshneu/alchareshneu/pull/231) and [Draft PR #247](https://github.com/aliaksei-chareshneu/alchareshneu/pull/247) remain separate; do not merge old site versions or silently restore superseded tariffs.

## How to submit (active on main after owner approval)

From the logged-in GitHub Mobile app or mobile browser, open the existing issue #245 and create a new public comment:

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

For later non-synthetic work, replace the file and test with real **already tracked** public paths from this repo. A suitable trusted test must exist before submitting. One or two pre-existing source files can be edited per command. For a coordinated two-file change, insert an optional `file2: ops/approved-public-module.cjs` line **immediately after** the `file:` line, before `test:`. The model proposes a separate anchored replacement for each file, both original SHA-256 digests are validated before either edit is staged, and the exact two-file diff is verified before the bot can create a Draft PR. The same independently maintained pre-existing test must pass after **both** edits. This is bounded multi-file coding, not a general-purpose multi-repo agent or independently generated new tests. Accepted source paths: non-sensitive .js, .cjs, .md under scripts/, docs/, ops/; pre-existing independent tests remain read-only under tests/; sensitive paths, .github, credentials, billing, auth, registration, deployment, personal data and private code are rejected. This is NOT yet a universal multi-file programmer.

GitHub issue comments are public. Never include account details, tokens, customer records, health data, legal matters, passwords or unpublished financial information. Only your GitHub account (repository owner), with correct GitHub author association, can trigger execution. No direct shell execution or model-selected paths.

## Execution and proof states

1. issue_comment event on **default branch main** → exact GitHub owner/issue/task checks and unit tests (task-preflight).
2. An ephemeral GitHub-hosted Ubuntu CPU runner starts isolated Ollama qwen3:4b-instruct using the existing public model cache. No zmrzlina and no paid model API.
3. The model proposes strict JSON old/new for one validated public path. It cannot execute shell, pick a new path, access GitHub credentials, or deploy anything.
4. The controller confirms exactly one old substring, an unchanged baseline source SHA and bounded patch size. A copy of the source is tested under Docker with no network, a read-only filesystem, no privileges, unprivileged UID, restricted memory and process count.
5. Passing proof is kept as a GitHub Actions artifact for 3 days. MODEL_PROPOSAL_ONLY is not ISOLATED_TRUSTED_TEST_PASS.
6. **Only after tests**, an independent workflow job with separate GitHub token permissions (subject to owner review) may push a unique review branch and attempt gh pr create --draft. Duplicate comment IDs never create duplicate PRs; a surviving branch without PR is reported BLOCKED.
7. Read back from GitHub to prove an open Draft PR. Nothing merges, deploys, publishes, changes prices, or sends customer messages.

**Verified activation:** The `AFTER owner-approved activation` precondition was fulfilled by owner-authorized PRs #250 and #258 on 10 Nov 2026. GitHub Actions' repository permission to create Draft pull requests was confirmed by its actual use on 11 Nov 2026: [issue comment #6787842684](https://github.com/aliaksei-chareshneu/alchareshneu/issues/245#issuecomment-6787842684) → [cloud workflow #42965529871](https://github.com/aliaksei-chareshneu/alchareshneu/actions/runs/42965529871) (3/3 jobs SUCCESS) → bot-created [Draft PR #268](https://github.com/aliaksei-chareshneu/alchareshneu/pull/268). This proves owner issue submission, Qwen inference, independent sandbox tests, and automated review PR creation.

**Still NOT verified / BLOCKED for broader scope:** An issue comment *specifically originating from Android* has not been independently tested; unrestricted multi-file coding, automatically writing independent new tests, reading private repositories, changes to access controls, and deployment are not part of this stage. The developer must review all model-generated changes, pass relevant CI and specifically approve each merge. A GitHub Pages publication and successful PR checks are distinct from a Draft PR.

**CI baseline warning (11 Nov 2026):** The unrelated site-wide browser regression suite fails on `main` as well, including older registration-catalog and home-page tests; do not silently waive the failures or mark this entire repository green. The DEV-specific cloud preflight and sandbox Qwen checks are independently passing.

**Actual owner command link:** https://github.com/aliaksei-chareshneu/alchareshneu/issues/245 . Only the signed-in repository owner's public comment with the exact four-line syntax is accepted. Each unique comment ID makes an independent review branch; do not re-send existing accepted comments. Usage consumes GitHub-hosted runner minutes and cache quota, which are not unlimited or a guaranteed free allowance.

**The code does not autonomously author separate test files.** It requires an existing trusted test for the requested public file and verifies its outcome. General unrestricted agent coding, multi-file edits and private tasks remain outside this scoped stage.

## Preview acceptance before any main merge

An isolated Draft PR against the latest main triggers pull_request preview only for the dedicated review branch. It must show:
- Unit tests for scripts/imperion-dev-cloud-issue.cjs pass locally and in GitHub.
- The public fixture ops/imperion-dev-cloud-fixture/normalize.cjs fails its trusted test before patch.
- A real Qwen inference on **GitHub Actions** creates a bounded code replacement.
- Re-running the trusted test in a no-network Docker container on the staged patch passes.
- The source branch, artifact, workflow/job conclusion and the exact commit SHA are verified.
- PR remains Draft; main and production do not change.

## Fail-closed conditions

Invalid actor, wrong issue number, closed issue, wrong command format, missing test, sensitive path, model output not JSON, unsafe replacement, non-unique old text, mismatched SHA, syntax error, test failure, timeouts, GitHub token policy block, duplicate branch without Draft PR: status BLOCKED, no merge or deployment. No automatic retry/spam.

GitHub official references:
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#issue_comment
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository
