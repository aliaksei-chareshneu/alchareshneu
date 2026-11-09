# IMPERION DEV Agent — local Windows CPU fallback

**Owner:** Aliaksei. **Entity:** personal OSVČ; not Družina Moravy z.s. or a grant.  
**Case:** IMP-DEV-ZMRZLINA-20261108. **Status 8 Nov 2026:** limited local coder **verified**; unrestricted / always-on automation **not verified**.  
**Budget:** no paid model API, card, subscription or new CRM. Local CPU/electricity and operator time still have costs.

This is a *bounded executable component of the existing IMPERION DEV Agent*, not a second agent, CRM, cloud deployment, listener or service. It can be invoked from an authorized ChatGPT/Desktop Commander session on the already connected Windows device; Android-origin dispatch has **not** been independently end-to-end tested.

## Verified readbacks on zmrzlina

- Remote device online, existing Git/Node/Python/Ollama/Codex CLI detected. The existing website Git clone was clean.
- Local `imperion-qwen35:4b` Ollama `127.0.0.1:11434/api/generate` returned `DONE=True`, `LOCAL_OK` without a paid external API.
- First public synthetic Python task: baseline **1 failing test**; model generated code with 297 prompt / 35 completion tokens (17.825s model duration), validator applied one-function patch, **3/3** unittest PASS; independent readback **3/3** PASS. Proof on device: `%TEMP%\imperion-dev-agent-acceptance-20261108\local-coder-proof.json`.
- Second public synthetic Python task using **this reusable worker**: baseline 1 failing test (26 vs 69), model generated a loop-based solution using 262 prompt / 42 completion tokens (23.519s model duration); **3/3** PASS, independent readback **3/3** PASS. On device: `%TEMP%\imperion-dev-agent-qa-2-20261108\imperion-dev-proof.json`; status `LOCAL_MODEL_CODE_TEST_PASS`.
- The local safety suite has **5/5** PASS, including rejection of `public_only=false`, file path traversal, imports, attribute access, arbitrary Python calls, multiple functions, baseline-already-passing no-op, and mock-only successful edits.
- Codex CLI `--oss --local-provider ollama` was tried but **did not complete accepted coding**, with missing model metadata and effective read-only sandbox. Do not claim Codex CLI integration is READY or bypass its security controls.

## Trusted run (not persistent / no unattended monitor)

Run the script from this PR in a repository clone or use the already verified local copy at:

`C:\Users\chere\ChatGPT-Workspace\80-Digital-Platform-Automation\local-tools\dev-agent\safe_local_python_worker.py`

Prepare a new **public/synthetic only** scratch directory whose basename begins `imperion-dev-agent-` under Windows `%TEMP%`. Add source and trusted `unittest` test files. A manifest in that directory must contain exactly these fields:

```json
{
  "job_id": "IMP-DEV-EXAMPLE-20261108",
  "workspace": "C:\\Users\\<local-user>\\AppData\\Local\\Temp\\imperion-dev-agent-example",
  "source_file": "sample.py",
  "test_file": "test_sample.py",
  "function": "price_total",
  "requirement": "Compute total of unit_price multiplied by quantity for all rows.",
  "public_only": true
}
```

PowerShell (for a correctly prepared and authorized manifest):

```powershell
python scripts/imperion-local-python-worker.py --task "C:\Users\chere\AppData\Local\Temp\imperion-dev-agent-example\task.json"
python tests/imperion-local-python-worker.test.py scripts/imperion-local-python-worker.py
```

Expected independent proof: `<workspace>\imperion-dev-proof.json` plus a separate trusted unittest run. Codes: `LOCAL_MODEL_CODE_TEST_PASS`, `BASELINE_ALREADY_PASS_NO_EDIT`, or `BLOCKED` / `BLOCKED_MODEL_OR_TEST_FAILED_RESTORED`. Failure restores original source; proof must never be interpreted as GitHub PR, merge, publication, invoice or payment.

## Explicit technical boundary

- The model sees only two user-approved public/synthetic files in a Windows temp workspace. It can propose exactly one pure Python function; its AST is allowlisted and arbitrary calls/imports/attribute access are rejected.
- The trusted controller may edit only the task source in that temp workspace and execute a fixed `python -m unittest discover` command on trusted test code. It has **no GitHub write credentials**, customer database permissions, outbound integrations, production deploy, card, or paid API calls.
- This is **not** an operating-system sandbox. The tester is trusted and Windows has no enforced no-network jail here; never pass untrusted tests, third-party code, customer secrets or private work.
- General frontend/backend/Python coding, remote GitHub PR creation on Windows, scheduled local monitoring and a fully autonomous phone-triggered task loop are **not proven**. The separate issue-195 cloud workflow has documented real public-code generated commit and the draft child [PR #235](https://github.com/aliaksei-chareshneu/alchareshneu/pull/235), but Actions PR creation was denied by repository settings. Do not enable that permission or merge/deploy without a separate GO.

Primary tracking remains existing [issue #195](https://github.com/aliaksei-chareshneu/alchareshneu/issues/195) and [draft PR #231](https://github.com/aliaksei-chareshneu/alchareshneu/pull/231), plus IMPERION Project80 / 03 EXECUTION / append-only CHANGELOG.


## STAGE 5: Verified GitHub issue-comment -> Windows scheduled task (8 Nov 2026, Europe/Prague)

The existing [issue #195](https://github.com/aliaksei-chareshneu/alchareshneu/issues/195) now doubles as a **public, owner-only command surface for two harmless diagnostics**, without introducing a new CRM/queue/provider. This is an additive on-demand component of the EXISTING IMPERION DEV Agent, not a general-purpose GitHub Copilot implementation. No real source PR is created from this command channel.

On GitHub (desktop browser or authenticated mobile client), submit **exactly one** of these as a new issue comment:

- `/imperion-dev ping` — local Ollama model presence check; no inference; writes a verified job result.
- `/imperion-dev smoke` — constructs a fresh **synthetic** broken one-function Python fixture in Windows `%TEMP%`, invokes the existing restricted Qwen worker through loopback Ollama, runs trusted unittest and independent hash/test readback. No private data, no GitHub writes, no deployment.

**Security and throughput:** GitHub REST public issue comments, unauthenticated HTTPS read only; only `user.login=aliaksei-chareshneu`, `user.type=User`, `author_association=OWNER`, and an exact allowlisted command may trigger actions. The poller does not process free-form issue text, scripts or attached content. It bootstraps from the latest historical comment ID (no replay), persists the cursor before running, executes at most two commands per tick, logs immutable local JSONL events, and never auto-retries failed inference. The no-overlap lock fails closed until reviewed. No GitHub token, third-party notification, paid API, CRM or model-initiated source deployment. GitHub issue comments are PUBLIC; never put customer details or passwords there.

**Real end-to-end acceptance:**

- Owner-authenticated command [#6727984202](https://github.com/aliaksei-chareshneu/alchareshneu/issues/195#issuecomment-6727984202) reached the computer but was **BLOCKED** after two Qwen candidate safety rejections (no unsafe change; failure logged). This validated the fail-closed path.
- The repaired prompt and byte-accurate Windows SHA-256 readback succeeded with [#6728039527](https://github.com/aliaksei-chareshneu/alchareshneu/issues/195#issuecomment-6728039527): `smoke_verified=true`, `model_test_status=LOCAL_MODEL_CODE_TEST_PASS`, **3/3 independent unittest PASS**, first Qwen candidate accepted, source digest `ad3380b0f506cb49a8b464b15227bd3ee03b8ed41b96791d820637bf6d486f3b`, no external paid API.
- A REAL Windows Task Scheduler installation `IMPERION-DevAgent-OwnerCommands` was created with a 10-minute repetition, **Limited** runlevel, user interactive logon (no password/elevation), maximum 6-minute process runtime and no overlapping instances. Manually started schedule result 0. **Automatic unattended 23:34:03 local run** independently processed owner [`/imperion-dev ping` #6728069497](https://github.com/aliaksei-chareshneu/alchareshneu/issues/195#issuecomment-6728069497) and independently returned `PASS`, `loopback_model_available=true`; Windows Task Scheduler `LastTaskResult=0`, next run 23:44:03 local.

**Persistent on-device evidence** (NOT pushed to GitHub): local `ChatGPT-Workspace\\80-Digital-Platform-Automation\\local-tools\\dev-agent\\state\\last_job.json` contains latest owner-triggered job; `status.json` is latest poll heartbeat; `events.jsonl` is append-only technical event log; `cursor.json` deduplicates GitHub comments. A user on Android can issue an exact command using the same authenticated GitHub account and later ask ChatGPT to inspect these files via the existing authorized remote device. **An actual Android app-origin event has not been independently verified**; the validated control path is GitHub-authenticated owner comment -> GitHub REST -> Windows Task Scheduler -> Ollama -> test/readback.

**Source and installation:**
`scripts/imperion-owner-comment-poller.py`,
`tests/imperion-owner-comment-poller.test.py`,
`ops/install-imperion-dev-owner-commands.ps1`.
The installer has preview mode by default and supports `-Apply` for a new task; existing matching tasks are retained without duplication, and name collisions with different actions fail closed. Local source names differ from GitHub checked-in filename but the scripts resolve both verified paths. To stop: disable or unregister this *single named Windows scheduled task* after owner GO. The process requires Windows user login, an awake PC and internet; PC being offline suspends the local trigger. No GitHub merge or production deployment happened.

**Current honest scope:** this is a VERIFIED owner-command diagnostic/synthetic coding loop with recurring on-device polling. It is NOT general unrestricted AI programming, unrestricted system operation, autonomous GitHub PR creation or fully cloud-hosted 24/7 operation. Existing cloud Qwen workflow and child draft PR #235 remain separate; browser regression of unrelated site changes is still an independent CI blocker.


## STAGE 6: REAL PUBLIC SOURCE -> REVIEW PR (9 Nov 2026)

The first real-source job has now been **executed**, not merely proposed. The authorized Windows `zmrzlina` device used locally installed Ollama `imperion-qwen35:4b` to propose a bounded change to the published public-source HTML file `shop/ai-workflow-roi/index.html`. Trusted `scripts/imperion-public-repo-worker.py` (on PC `local-tools/dev-agent/safe_public_repo_worker.py`) independently cloned the current public `main`, verified source SHA and a unique allowed HTML anchor, rejected executable code/external calls, checked the one-file diff and local correctness, then committed and pushed exactly one new Git review branch. The model has no GitHub credentials or merge rights; trusted local Git uses the owner's existing authenticated Git installation.

Evidence: first model attempt accepted (252 prompt tokens, 88 completion tokens, Ollama model duration 14.2246355s). Review-only commit [e9021ef](https://github.com/aliaksei-chareshneu/alchareshneu/commit/e9021ef8d68021dfb00f31048daf266d7d9b3b80), branch `agent/imperion-dev-roi-brand-20261109`; remote SHA read back. GitHub connector created and independently verified [OPEN DRAFT PR #243](https://github.com/aliaksei-chareshneu/alchareshneu/pull/243), initially **one** HTML file changed; no merge or deployment.

**After initial CI:** old main-line Site quality browser suite had 26 failing cases, including other unthemed public shop pages and stale card/CTA assertions. A distinct trusted deterministic (NOT Qwen-authored) CI reconciliation process on `zmrzlina` updated six additional shop pages, dark storefront CSS and three existing browser tests, preserving terms/prices and Družina source. Independent static audit across all 55 public HTML files, `node --check` for changed JS tests and `git diff --check` passed; new review-branch commit [5a2f193](https://github.com/aliaksei-chareshneu/alchareshneu/commit/5a2f193496106f09955bffbcbf579358de9c6214) was pushed and read back. **Full CI on this head must be checked; do not claim pass before provider conclusion.** PR #243 is still draft/unmerged.

**Actual owner issue-comment -> Windows task readback:** [GitHub issue #195 owner comment #6736831282](https://github.com/aliaksei-chareshneu/alchareshneu/issues/195#issuecomment-6736831282), exact command `/imperion-dev build roi-brand`, was handled by existing scheduled Windows poller. It did not duplicate the already created branch or PR; a trusted public GitHub REST readback verified PR #243 OPEN+DRAFT, base `main`, correct head branch/SHA and exactly the expected public ROI HTML file in the originally accepted one-file stage. Local `state/last_job.json` returned `PASS`, `EXISTING_DRAFT_PR_VERIFIED`, comment ID and review PR URL; Windows scheduler LastTaskResult=0. This is an owner-visible proof of routing, not evidence of a new code edit by that second request.

Supported exact public owner commands on GitHub issue #195: `/imperion-dev ping`, `/imperion-dev smoke`, `/imperion-dev build roi-brand`. The third is a *preapproved narrow job*, not arbitrary issue text execution. Expanding to more source files or task types requires additional validated job allowlisting/QA. No production merge, account permission widening, paid model/API subscription, buyer data or customer messages. The Github connector created the draft PR in this ChatGPT execution; unattended PR creation by the PC from GitHub Actions alone is still blocked by repository Actions restrictions.

**Tests:** on-device owner-command safety suite **11/11 PASS**, local Python code worker safety **6/6 PASS**, public repo worker offline safety **6/6 PASS**. Existing [PR #231](https://github.com/aliaksei-chareshneu/alchareshneu/pull/231) includes reproducible Python source/tests and its Site quality static and B2B-focused QA succeeded on head `acbf16a2657ef109d3c093d398ac19ba2a7e2b10`; pre-existing full-site browser failures handled in separate review PR #243. Keep the two distinct proof scopes separate: synthetic Python general-function helper vs narrowly approved real HTML edit. An actual originating Android app UI interaction has still not been independently demonstrated.


[STAGE7-REAL-AUTOPR-20261109]
9 Nov 2026 (Europe/Prague), OWNER Aliaksei, ENTITY personal OSVC, external paid API 0 Kc. Existing zmrzlina scheduled GitHub issue #195 comment 6738822126 /imperion-dev build cloud-profile triggered real local Qwen3.5 4b job, trusted static agent-profile and Playwright test generation on public main, Git branch push and trusted user-credential GitHub REST CREATE Draft PR with no new token/file stored. PR #247 https://github.com/aliaksei-chareshneu/alchareshneu/pull/247 created by agent, independently GET readback OPEN DRAFT UNMERGED base main, head commit 2cbbf5644787439e000df26a2d2a90d7700dedd9, 3 files exactly (.github/agents/imperion-dev.agent.md, docs/imperion-dev-android.md, tests/imperion-dev-cloud-profile.spec.cjs). Windows Task Scheduler last result 0, last_job.json PASS with owner comment id and PR URL. This proves complete OWNER COMMENT -> PC -> LOCAL MODEL -> BRANCH -> AUTOMATIC DRAFT PR -> READBACK, and does NOT prove Copilot cloud. User GitHub Copilot cloud assignment via connected GitHub App returned HTTP 403; independent existing user credential GraphQL suggestedActors did NOT list copilot-swe-agent; Github issue #245 created but Copilot NOT ASSIGNED, no cloud session/PR from Copilot. Official docs https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/kick-off-a-task . Do not buy plan/add tokens or mislabel local work as cloud. PR #243 all 349/349 Playwright passed + static SUCCESS on run https://github.com/aliaksei-chareshneu/alchareshneu/actions/runs/42607285497, digital-store smoke PASS; PR243 OPEN DRAFT UNMERGED, main unaffected. Existing PR231 holds these reproducible source/test components; local owner command 12/12, PR gate 6/6, local Python 6/6 and public HTML worker 6/6 PASS. Remote settings, code/script main, prices, data, merge, release unchanged. The Android-origin UI event was not itself observed; GitHub public issue comments from an authenticated browser work as cross-device entrypoint. Cloud-independent general freeform agent remains BLOCKED by cloud account entitlement/permission and unmerged default-branch workflow gates; restricted allowlisted tasks only at this stage.
[END STAGE7-REAL-AUTOPR-20261109]
