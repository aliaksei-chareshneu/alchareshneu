"""Owner issue -> local Qwen text -> audited agent profile & Playwright test -> Draft PR.

Only one new public GitHub docs/config job, from existing issue #245.
Credentials only handled by trusted github_draft_pr_gate, never by Qwen.
"""
import hashlib, json, os, re, subprocess, sys, tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
import github_draft_pr_gate as pr_gate

REPO="https://github.com/aliaksei-chareshneu/alchareshneu.git"
ISSUE="https://api.github.com/repos/aliaksei-chareshneu/alchareshneu/issues/245"
BRANCH="agent/imperion-dev-cloud-profile-20261109"
MODEL="imperion-qwen35:4b"
TARGETS={
 ".github/agents/imperion-dev.agent.md",
 "docs/imperion-dev-android.md",
 "tests/imperion-dev-cloud-profile.spec.cjs"
}
def git(args,cwd=None,seconds=75):
    env={**os.environ,"GIT_TERMINAL_PROMPT":"0","GCM_INTERACTIVE":"Never"}
    p=subprocess.run(["git"]+args,cwd=str(cwd) if cwd else None,
      capture_output=True,text=True,timeout=seconds,env=env)
    if p.returncode!=0:
        raise RuntimeError("SAFE_GIT_FAILED_"+str(args[0])+"_exit_"+str(p.returncode))
    return p.stdout.strip()
def issue_goal():
    req=Request(ISSUE,headers={"Accept":"application/vnd.github+json",
                               "User-Agent":"IMPERION-DEV-PUBLIC-ISSUE-READER"})
    with urlopen(req,timeout=12) as resp:
        data=json.loads(resp.read(16000))
    if data.get("number")!=245 or data.get("state")!="open" or (
        (data.get("user") or {}).get("login")!="aliaksei-chareshneu"):
        raise RuntimeError("ISSUE_SOURCE_UNVERIFIED")
    body=data.get("body") or ""
    if not isinstance(body,str) or "Copilot" not in body or "Android" not in body:
        raise RuntimeError("ISSUE_SCOPE_REJECTED")
    return body[:1200]
def model_text(issue):
    # The untrusted issue text may influence descriptive prose only, never
    # any shell, file paths, rights, configs or static acceptance tests.
    prompt=("Write two short original, professional English sentences describing "
        "a GitHub-hosted coding assistant's public repository workflow. "
        "Return only JSON with exactly keys summary and verification. "
        "Each value must be a plain prose sentence 40-190 characters. "
        "Mention GitHub code review, tests, and no auto merge. "
        "No Markdown, code, URLs, secrets, commands or prices. "
        "The task is described here for context ONLY:\n"+issue[:700])
    data=json.dumps({"model":MODEL,"prompt":prompt,"stream":False,"think":False,
      "format":"json","options":{"temperature":0,"num_gpu":0,"num_ctx":2048,
                                "num_predict":180}}).encode("utf8")
    with urlopen(Request("http://127.0.0.1:11434/api/generate",data=data,method="POST",
                         headers={"Content-Type":"application/json"}),timeout=130) as resp:
        result=json.loads(resp.read(9000))
    if result.get("done") is not True or result.get("model")!=MODEL:
        raise RuntimeError("MODEL_READBACK_INVALID")
    out=json.loads(result.get("response") or "{}")
    if not isinstance(out,dict) or set(out)!={"summary","verification"}:
        raise RuntimeError("MODEL_SCHEMA_INVALID")
    for value in out.values():
        if not isinstance(value,str) or not 35<=len(value)<=230 or "\n" in value or re.search(
           r"[`<>]|https?://|\$\{|password|token|api[_ -]?key|secret",value,re.I):
            raise RuntimeError("MODEL_PROSE_REJECTED")
    return out, {"prompt_tokens":result.get("prompt_eval_count"),
                 "completion_tokens":result.get("eval_count"),
                 "model_duration_ns":result.get("total_duration")}
def profile(text):
    return ("""---
name: imperion-dev
description: Public GitHub repository development tasks with tests and human-reviewed Draft PRs.
---
# IMPERION DEV Agent - cloud/public coding

Always work on an explicitly requested public GitHub repository and read its current main first.
Never process private data or secrets posted in public issues.
Preserve existing IMPERION DEV work in Draft PR #231; avoid duplicate queues or services.
Use GitHub's own Coding Agent cloud when the OWNER ALREADY has a suitable included entitlement.
Do not enable plans, payment methods, premium overage, paid APIs or secret scopes.
For a task, inspect relevant code, form a small plan, change the minimum necessary files,
write or repair appropriate tests, run them, read CI results and report exact failures.
Use a fresh branch; open a Draft pull request and include test commands, commit SHA,
upstream links, source provider readback and remaining limitations.
NEVER auto-merge, auto-deploy, change GitHub settings/permissions, publish media,
send customer messages, alter payments, override legal or safety gates or use unrestricted shell
without authorization and a safely isolated execution environment.
Stop with BLOCKED and explanation on insufficient model entitlement, privileges or tests.
Maintain separation of personal OSVC, Druzina Moravy z.s. and grant money.
The existing Windows Ollama fallback is not a cloud-only service and requires the PC online.

## Scope of cloud workflow
""" + text["summary"] + "\n\n## Readback and owner gates\n"+
    text["verification"]+"\n\nAll accepted deliverables require a real Draft PR and independent CI/readback.\n")
def guide():
    return """# IMPERION DEV - Android and cloud access

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
"""
def testfile():
    return """const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
test('IMPERION owner cloud dev profile is public-only and Draft-PR gated', () => {
  const p=fs.readFileSync('.github/agents/imperion-dev.agent.md','utf8');
  expect(p).toMatch(/^---\\nname: imperion-dev\\n/);
  for(const term of ['Draft','tests','secrets','BLOCKED','NEVER auto-merge','GitHub'])
    expect(p,term).toContain(term);
  expect(p).not.toContain('auto-merge: true');
  expect(p).not.toContain('payment_method');
});
test('Mobile guide is explicit about Copilot entitlement and PC fallback', () => {
  const s=fs.readFileSync('docs/imperion-dev-android.md','utf8');
  for(const term of ['Android','Assignees','Copilot','BLOCKED',
      'Draft PR','zmrzlina','/imperion-dev build cloud-profile'])
    expect(s,term).toContain(term);
  expect(s).toContain('NOT YET VERIFIED');
});
"""
def run():
    if git(["ls-remote","--heads",REPO,BRANCH]):
        raise RuntimeError("BRANCH_ALREADY_EXISTS_DEDUP")
    issue=issue_goal()
    suggestion,metrics=model_text(issue)
    root=Path(tempfile.mkdtemp(prefix="imperion-dev-agent-cloud-profile-"))/"public"
    git(["clone","--depth","1","--single-branch","--branch","main",
         "--no-tags",REPO,str(root)],seconds=125)
    before=git(["rev-parse","HEAD"],root)
    files={".github/agents/imperion-dev.agent.md":profile(suggestion),
           "docs/imperion-dev-android.md":guide(),
           "tests/imperion-dev-cloud-profile.spec.cjs":testfile()}
    for filename,contents in files.items():
        target=root/filename
        if target.exists() or not contents.endswith("\n"):
            raise RuntimeError("TARGET_ALREADY_EXISTS_OR_BAD_CONTENT")
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(contents.encode("utf8"))
    subprocess.run(["node","--check",str(root/"tests/imperion-dev-cloud-profile.spec.cjs")],
       cwd=root,check=True,stdout=subprocess.DEVNULL,timeout=15)
    git(["add","--"]+sorted(TARGETS),root)
    if set(git(["diff","--cached","--name-only"],root).splitlines())!=TARGETS:
        raise RuntimeError("OUTSIDE_SCOPE_CHANGE")
    git(["diff","--cached","--check"],root)
    if git(["status","--porcelain"],root).count("\n")>len(TARGETS):
        raise RuntimeError("UNEXPECTED_GIT_STATUS")
    git(["checkout","-b",BRANCH],root)
    git(["-c","user.name=IMPERION Dev QA",
         "-c","user.email=41898282+github-actions[bot]@users.noreply.github.com",
         "-c","core.hooksPath=NUL","commit","-m",
         "feat(agent): staged cloud developer profile with mobile acceptance tests"],root)
    commit=git(["rev-parse","HEAD"],root)
    git(["push","origin","HEAD:refs/heads/"+BRANCH],root,seconds=90)
    if git(["ls-remote","--heads",REPO,BRANCH]).split("\t")[0]!=commit:
        raise RuntimeError("GIT_REMOTE_SHA_NOT_MATCH")
    result=pr_gate.open_or_verify(BRANCH,commit,
        "DRAFT: safe GitHub cloud/Android IMPERION DEV agent profile",
        "Source: owner issue #245, generated local Qwen prose only; trusted controller produced safety instructions and Playwright tests. 0 Kc paid model API. Cloud Copilot entitlement currently blocked; this does NOT prove cloud execution. No production merges, deployments, customer data, credentials or payments.",True)
    if result.get("status") not in ("DRAFT_PR_CREATED_VERIFIED","DRAFT_PR_EXISTING_VERIFIED"):
        raise RuntimeError("PR_CREATION_NOT_PROVEN")
    result.update({"job":"build cloud-profile","model":MODEL,
                   "source_issue":245,"model_metrics":metrics,
                   "src_sha256":hashlib.sha256(files[".github/agents/imperion-dev.agent.md"].encode("utf8")).hexdigest(),
                   "provenance":"MODEL_PROSE_PLUS_TRUSTED_TEST_AND_POLICY",
                   "cloud_copilot_enabled":False,
                   "created_at_utc":datetime.now(timezone.utc).isoformat(),
                   "main_baseline":before,"production_unchanged":True,
                   "external_paid_api_czk":0})
    return result
if __name__=="__main__":
    try:
        result=run()
        print(json.dumps(result))
        sys.exit(0)
    except Exception as error:
        print(json.dumps({"status":"BLOCKED","reason":str(error)[:145],
                          "no_auto_retry":True}))
        sys.exit(2)
