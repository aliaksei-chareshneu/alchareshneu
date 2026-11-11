# IMPERION DEV Agent — cloud issue coding (Stage 7, review-only)

**Entity:** personal OSVČ. **Repository:** aliaksei-chareshneu/alchareshneu.
**ACTIVE in main:** PR #250 and #258 were merged on 10 Nov 2026 with owner GO. On 11 Nov, cloud Actions run #42965529871 independently created owner-review Draft PR #268. This review branch extends intake to other owner-created public issues; **no new merge, deploy, payment or permission change** is authorized by this branch.
**Cost model:** GitHub-hosted CPU with local Ollama qwen3:4b-instruct, no paid inference API or account secrets. GitHub runner quotas and electricity have nonzero resource cost; never enable billed overage.
**Case:** IMP-DEV-CLOUD-ISSUE-20261109.

## Reuse rather than duplicate

- This is an extension of existing IMPERION DEV work, not a separate public app, CRM, database, queue, or paid provider.
- [Owner command channel #195](https://github.com/aliaksei-chareshneu/alchareshneu/issues/195) remains the **on-PC fallback**, polled by Windows Task Scheduler using local Qwen3.5 4B, only while zmrzlina is on.
- [Cloud acceptance #245](https://github.com/aliaksei-chareshneu/alchareshneu/issues/245) is the original, proven example. After this review branch is separately approved and merged, **any open public issue created by the repository owner** can receive the same exact owner-authored command from Android or desktop. PR discussions and issues created by other accounts are rejected.
- Existing [Draft PR #231](https://github.com/aliaksei-chareshneu/alchareshneu/pull/231) and [Draft PR #247](https://github.com/aliaksei-chareshneu/alchareshneu/pull/247) remain separate; do not merge old site versions or silently restore superseded tariffs.

## How to submit (ACTIVE in main for issue #245; other owner issues require this PR to be merged)

On GitHub Mobile or a signed-in Android browser, open an owner-created public issue in this repository. Use an existing tracked public file and its existing trusted test. The command format is:

    /imperion-dev cloud
    file: docs/imperion-dev-cloud-issue.md
    test: tests/imperion-dev-cloud-issue.test.cjs
    goal: Correct one clearly identified outdated status sentence without changing safety requirements

Historical synthetic acceptance (already performed; **do not repost as a duplicate task**):

    /imperion-dev cloud
    file: ops/imperion-dev-cloud-fixture/normalize.cjs
    test: ops/imperion-dev-cloud-fixture/check.cjs
    goal: Correct total(items): each price must be multiplied by quantity, using an empty-array-safe sum.

The complete fixture file/test pair is an explicitly validated exception to normal path restrictions. The owner comment #6787842684 on issue #245 subsequently proved GitHub issue → cloud Qwen → independent test → **GitHub Actions-authored Draft PR #268** on run #42965529871. This was not independently shown to originate on Android, so do not claim Android-native acceptance.

For later non-synthetic work, replace the file and test with real **already tracked** public paths from this repo. A suitable trusted test must exist before submitting. Only one file is edited per command. Accepted source paths: non-sensitive .js, .cjs, .md under scripts/, docs/, ops/; pre-existing independent tests remain read-only under tests/; sensitive paths, .github, credentials, billing, auth, registration, deployment, personal data and private code are rejected. This is NOT yet a universal multi-file programmer.

GitHub issue comments are public. Never include account details, tokens, customer records, health data, legal matters, passwords or unpublished financial information. Only your GitHub account (repository owner), with correct GitHub author association, can trigger execution. No direct shell execution or model-selected paths.

## Execution and proof states

1. issue_comment event on **default branch main** → exact GitHub owner/issue/task checks and unit tests (task-preflight).
2. An ephemeral GitHub-hosted Ubuntu CPU runner starts isolated Ollama qwen3:4b-instruct using the existing public model cache. No zmrzlina and no paid model API.
3. The model proposes strict JSON old/new for one validated public path. It cannot execute shell, pick a new path, access GitHub credentials, or deploy anything.
4. The controller confirms exactly one old substring, an unchanged baseline source SHA and bounded patch size. A copy of the source is tested under Docker with no network, a read-only filesystem, no privileges, unprivileged UID, restricted memory and process count.
5. Passing proof is kept as a GitHub Actions artifact for 3 days. MODEL_PROPOSAL_ONLY is not ISOLATED_TRUSTED_TEST_PASS.
6. **Only after tests**, an independent workflow job with separate GitHub token permissions (subject to owner review) may push a unique review branch and attempt gh pr create --draft. Duplicate comment IDs never create duplicate PRs; a surviving branch without PR is reported BLOCKED.
7. Read back from GitHub to prove an open Draft PR. Nothing merges, deploys, publishes, changes prices, or sends customer messages.

**Current acceptance (11 Nov 2026):** the workflow is already on main and an Actions-authored Draft PR has been verified. Repository-wide PR permission was effective for run #42965529871; no new permissions are requested here. Global Site quality CI on the companion PR is not green due to RSVP source drift and an Academy contact-gate regression in unrelated existing code. Do not merge this change or claim full CI PASS without checking the latest run. Additional arbitrary multi-file work, self-authored trusted tests, private tasks and native Android provenance are **BLOCKED / NOT VERIFIED**.

**The code does not autonomously author separate test files.** It requires an existing trusted test for the requested public file and verifies its outcome. General unrestricted agent coding, multi-file edits and private tasks remain outside this scoped stage.

## Preview acceptance for this review branch before any merge

An isolated Draft PR against the latest main triggers pull_request preview only for the dedicated review branch. It must show:
- Unit tests for scripts/imperion-dev-cloud-issue.cjs pass locally and in GitHub.
- The public fixture ops/imperion-dev-cloud-fixture/normalize.cjs fails its trusted test before patch.
- A real Qwen inference on **GitHub Actions** creates a bounded code replacement.
- Re-running the trusted test in a no-network Docker container on the staged patch passes.
- The source branch, artifact, workflow/job conclusion and exact commit SHA are verified. When one job fails, preserve the exact failure and distinguish inherited CI failures.
- PR remains Draft; main and production do not change. Generalization to other owner-created issues is not LIVE until a separately authorized merge.

## Fail-closed conditions

Invalid actor, wrong issue number, closed issue, wrong command format, missing test, sensitive path, model output not JSON, unsafe replacement, non-unique old text, mismatched SHA, syntax error, test failure, timeouts, GitHub token policy block, duplicate branch without Draft PR: status BLOCKED, no merge or deployment. No automatic retry/spam.

GitHub official references:
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#issue_comment
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository
