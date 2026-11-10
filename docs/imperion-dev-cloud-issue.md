# IMPERION DEV Agent — cloud issue coding (Stage 7, review-only)

**Entity:** personal OSVČ. **Repository:** aliaksei-chareshneu/alchareshneu.
**Owner GO (9 Nov 2026):** isolated development on GitHub branches and zmrzlina; **not** merging, deploying, changing permissions, purchases or publishing.
**Cost model:** GitHub-hosted CPU with local Ollama qwen3:4b-instruct, no paid inference API or account secrets. GitHub runner quotas and electricity have nonzero resource cost; never enable billed overage.
**Case:** IMP-DEV-CLOUD-ISSUE-20261109.

## Reuse rather than duplicate

- This is an extension of existing IMPERION DEV work, not a separate public app, CRM, database, queue, or paid provider.
- [Owner command channel #195](https://github.com/aliaksei-chareshneu/alchareshneu/issues/195) remains the **on-PC fallback**, polled by Windows Task Scheduler using local Qwen3.5 4B, only while zmrzlina is on.
- [Cloud acceptance #245](https://github.com/aliaksei-chareshneu/alchareshneu/issues/245) is a **public owner-only issue** to request bounded coding from Android or desktop.
- Existing [Draft PR #231](https://github.com/aliaksei-chareshneu/alchareshneu/pull/231) and [Draft PR #247](https://github.com/aliaksei-chareshneu/alchareshneu/pull/247) remain separate; do not merge old site versions or silently restore superseded tariffs.

## How to submit (AFTER owner-approved activation in main)

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

**Known external blockers:** GitHub only triggers issue-comment workflows that exist in default branch. GitHub can also forbid PR creation from GitHub Actions by repository policy (403). Neither default-branch activation nor permission changes are authorized by the current GO. The preview PR can test the model and isolation; it cannot prove fully unattended Android-origin issue → PR until those separate gates are approved and independently tested.

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
