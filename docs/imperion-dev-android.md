# IMPERION DEV - Android and cloud access

**Status on 9 November 2026:** GitHub Copilot cloud agent could not be
assigned from the connected GitHub App (403) and an authenticated GraphQL
suggestedActors probe did not offer Copilot for this account/repository.
Consequently a **fully cloud-independent task run is NOT YET VERIFIED**.
The owner should not pay, change plans, or add token scopes merely to use this.

## GitHub cloud route (only when existing account entitlement allows it)
1. From GitHub Mobile or an authenticated mobile browser, open a public,
   correctly scoped repository issue, such as
   https://github.com/aliaksei-chareshneu/alchareshneu/issues/245 .
2. Use the issue's *Assignees* control to assign **Copilot** if available.
   GitHub documents this supported action at
   https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/kick-off-a-task
3. Copilot Coding Agent runs in GitHub-hosted infrastructure independent of
   the Windows PC and opens a PR for review, subject to account quotas.
   Verify actual task/session, branch, commit, CI, Draft PR and changed files.
4. The owner reviews. **Never merge, deploy or modify permissions automatically.**

If Copilot is not an available assignee, report **BLOCKED: ACCOUNT_ENTITLEMENT_OR_POLICY**.
Do not claim that a public GitHub issue or an unassigned @copilot mention is execution.

## Existing local fallback (NOT cloud / limited)
At https://github.com/aliaksei-chareshneu/alchareshneu/issues/195
the signed-in owner can comment exactly:
- `/imperion-dev ping` - checks the local Ollama model
- `/imperion-dev smoke` - synthetic Python patch plus tests
- `/imperion-dev build roi-brand` - deduplicated public ROI review PR
- `/imperion-dev build cloud-profile` - approved public agent-profile job

The user-level Windows scheduled job `IMPERION-DevAgent-OwnerCommands` polls
every 10 minutes when `zmrzlina` is awake, signed in and online.
It uses local Ollama Qwen3.5 4B and makes no paid model requests.
Only issue comments from the authenticated owner matching these exact commands
are accepted. Do not put secrets, customer records or private work in public issues.

## Readback gates
REQUESTED != ACCEPTED != TEST_PASS != PR_CREATED != CI_SUCCESS != MERGED != LIVE.
Inspect PR status, branch, current SHA, CI status and changed files from GitHub.
Github Pages / production changes require separate owner GO.
