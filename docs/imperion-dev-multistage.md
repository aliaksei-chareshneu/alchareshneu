# IMPERION Developer #1 — Stage 19 multi-stage control (review-only)

Status: **DRAFT IMPLEMENTATION, NOT LIVE ON main**. GitHub Issues, Actions, existing GPT-OSS 120B/Groq Free execution, independent Docker tests and Draft PR publisher remain the only execution infrastructure. No new agent, paid service, database, permission, cron or deployment is introduced here.

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

**Do not post this command to a live Issue now expecting a project run.** This Draft only provides planner validation, integrity gates, deterministic stage mapping, GitHub readback and mocked recovery tests. To activate multi-run execution, the existing cloud workflow needs an independently reviewed integration for: original owner-command GET readback, secure stage execution using `department`, proof-carrying Draft PR publishing, scheduling/dispatch resume on Free quota reset and blocked-run receipts. Until then no project command is handled by the live workflow.

## Acceptance and hard limits

1. Existing `/imperion-dev department` behavior and protections are unchanged.
2. Test with `node --test tests/imperion-dev-project-control.test.cjs`, then existing combined DEV preflight and Site quality checks.
3. Three-stage test covers next-stage computation, stacked branch dependency, pause/retry/duplicate protection, exact-head GitHub CI and fail-closed readback.
4. Full **live** acceptance still requires three distinct cloud task results, real GitHub Actions and verified Draft PR stack after explicit review/merge of this code and future runner wiring. Unit tests alone never prove that acceptance.
5. Never autonomously merge PRs, deploy, change repo permissions/secrets, infer Groq billing from token counting, or expose private code.

Case: IMP-DEV-PROJECT-STAGE19-20261115; owner OSVČ; new external cost authorized: 0 Kč.