# IMPERION Developer #1 — Stage 19 multi-stage control (review-only)

Status: **STAGE 19–22 DRAFT STACK, NOT LIVE ON main**. Stage 22 wires the stage runner to existing Actions, but this code is not active until independently reviewed and merged with explicit owner GO. GitHub Issues, Actions, existing GPT-OSS 120B/Groq Free execution, independent Docker tests and Draft PR publisher remain the only execution infrastructure. No new agent, paid service, database, permission, cron or deployment is introduced here.

## Problem and boundary

The existing `/imperion-dev department` command completes **one bounded change** per verified owner Issue comment. The action cannot yet autonomously create a stack of dependent PRs from a large specification or independently invent a fully trusted new test for an untested feature.

`scripts/imperion-dev-project-control.cjs` adds a fail-closed **project-level coordinator**, not a replacement worker:
- Owner-only `/imperion-dev project` command parser reusing existing restricted source/test path rules.
- GPT-OSS project architect returning 2–4 ordered, SHA-sealed milestones (no model execution during PR preview or unit tests).
- Each milestone declares up to three **existing public test-referenced source files**, a goal and acceptance note. Read-only independent test remains the minimum verification contract. Generated advisory vectors are **not** independent.
- Deterministic stage branches: `agent/imperion-dev-project-<issue>-<comment>-s1`, `-s2`, ... .
- Stage 1 targets `main`; stage 2 targets the first Draft PR branch; later stages target their immediate predecessor. **These are stacked review branches, not production deployments.**
- Project state is recovered from GitHub Pull Requests + exact-head GitHub Actions runs. No competing state store is introduced; incomplete or contradictory evidence blocks advancement.
- Only open bot-authored Draft PRs with expected branch/base, project marker, non-merged state and successful matching SHA CI can unlock the next stage.
- Pending CI pauses, failing CI blocks, duplicate/out-of-order records block, quota exhaustion pauses without paid fallback. All stages complete means `DRAFT_STACK_READY_FOR_OWNER_REVIEW`, **not DONE/merged**.

## Owner command shape (reserved; **not active** until the full runner wiring is reviewed and merged)

```text
/imperion-dev project
scope: ops/imperion-dev-cloud-fixture
test: tests/imperion-dev-cloud-three-fixture.test.cjs
goal: Complete a bounded three-stage public synthetic arithmetic improvement with independent human review.
```

**Do not post this command expecting a live project run while Stage 22 is a Draft.** Draft PR #346 now contains workflow wiring: original owner-command GET proof, staged department execution, protected project Draft PR publisher, a four-hour GitHub-native resume watcher and shared Groq Free quota gate. Only the existing GitHub Actions infrastructure is used. None of this is active in `main` until owner-authorized merge.

Stage 22's watcher may dispatch one project retry every four hours; it never guarantees the next PR will be created. Before any inference on a resume it checks the original owner, immutable plan, prior Draft PR metadata and exact-head CI success. Pending or failed CI blocks before the model. GitHub's default GITHUB_TOKEN can suppress ordinary PR-triggered checks for bot-created Draft PRs; if this occurs, automation deliberately waits rather than treating missing checks as passed. No extra repository permissions have been granted to bypass the restriction.

## Acceptance and hard limits

1. Existing `/imperion-dev department` behavior and protections are unchanged.
2. Test with `node --test tests/imperion-dev-project-control.test.cjs`, then existing combined DEV preflight and Site quality checks.
3. Three-stage test covers next-stage computation, stacked branch dependency, pause/retry/duplicate protection, exact-head GitHub CI and fail-closed readback.
4. Full **live** acceptance still requires three distinct cloud task results, real GitHub Actions and verified Draft PR stack after explicit owner-authorized review/merge of the dependent PR stack (#343→#344→#345→#346). Unit tests and Draft PR preview checks alone never prove live autonomy.
5. Never autonomously merge PRs, deploy, change repo permissions/secrets, infer Groq billing from token counting, or expose private code.

Case: IMP-DEV-PROJECT-STAGE19-20261115; owner OSVČ; new external cost authorized: 0 Kč.
## Hard BLOCKED until owner review

- PR #343: sealed plan and exact-SHA GH readback.
- PR #344: owner/CI project stage authorization.
- PR #345: recovered original owner Issue and plan.
- PR #346: existing workflow integration, repository_dispatch quota, Draft publisher, scheduled watch.
- **No auto merge**. Reviewer must explicitly approve/merge dependencies in order, then allow a bounded live owner Issue test. 
- **New functional requirements without pre-existing trusted tests remain restricted**. Generated advisory witnesses are not an independent test oracle; a new independent specification-driven QA generator and complex application coverage need separate audited work.
- Current free Groq model account controls remain authoritative; counters cannot certify billing or exact provider quota.
