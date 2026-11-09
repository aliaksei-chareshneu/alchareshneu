"""Use existing Git user credential to create/verifiably dedupe DRAFT PRs.

No token output or disk storage. Only this repository, fixed audited branch and
public-only paths. This is invoked after source/test gates, never by the model.
"""
import json, os, re, subprocess, sys, urllib.request, urllib.error
ROOT="aliaksei-chareshneu/alchareshneu"
URL="https://api.github.com/repos/"+ROOT
USER="aliaksei-chareshneu"
ALLOWED={
 "agent/imperion-dev-roi-brand-20261109": {"shop/ai-workflow-roi/index.html",
  "shop/csv-rescue/index.html","shop/guides/automation-payback/index.html",
  "shop/guides/csv-data-quality/index.html","shop/index.html",
  "shop/legal/index.html","shop/shop.css","shop/thanks/index.html",
  "tests/client-start.spec.cjs","tests/druzina-november-contrast.spec.cjs",
  "tests/site-design.spec.cjs","druzina/index.html"},
 "agent/imperion-dev-cloud-profile-20261109": {
    ".github/agents/imperion-dev.agent.md",
    "tests/imperion-dev-cloud-profile.spec.cjs",
    "docs/imperion-dev-android.md"},
}
def credential():
    p=subprocess.run(["git","credential","fill"],input="protocol=https\nhost=github.com\n\n",
        text=True,capture_output=True,timeout=18,env={**os.environ,"GIT_TERMINAL_PROMPT":"0","GCM_INTERACTIVE":"Never"})
    if p.returncode:
        raise RuntimeError("USER_CREDENTIAL_MISSING")
    values={}
    for line in p.stdout.splitlines():
        key,sep,value=line.partition("=")
        if sep and key in ("username","password"):values[key]=value
    if not values.get("password"):raise RuntimeError("USER_CREDENTIAL_EMPTY")
    return values["password"]
def req(path, token, method="GET", payload=None):
    if not path.startswith("/"):raise RuntimeError("GITHUB_API_PATH_REQUIRED")
    query_ok=(path.startswith("/pulls?state=open&head=") or
              (path.startswith("/pulls/") and path.endswith("/files?per_page=100")))
    if path.startswith("//") or ".." in path or ("?" in path and not query_ok):
        raise RuntimeError("PATH_REJECTED")
    url=URL+path
    body=json.dumps(payload).encode("utf8") if payload is not None else None
    headers={"User-Agent":"IMPERION-DEV-PR-Review-Only/1",
             "Accept":"application/vnd.github+json","Authorization":"Bearer "+token,
             "X-GitHub-Api-Version":"2022-11-28"}
    if body is not None:headers["Content-Type"]="application/json"
    try:
        with urllib.request.urlopen(urllib.request.Request(url,data=body,headers=headers,method=method),timeout=18) as res:
            return res.status,json.loads(res.read(90000))
    except urllib.error.HTTPError as error:
        raise RuntimeError("GITHUB_PR_API_"+str(error.code)) from None
def check_pr(pr,branch,head):
    if (pr.get("state")!="open" or pr.get("draft") is not True or
        pr.get("merged_at") is not None or
        (pr.get("head") or {}).get("ref")!=branch or
        (pr.get("head") or {}).get("sha")!=head or
        ((pr.get("head") or {}).get("repo") or {}).get("full_name")!=ROOT or
        (pr.get("base") or {}).get("ref")!="main"):
        raise RuntimeError("DRAFT_PR_INVARIANT_FAILED")
    return pr["number"]
def verify_files(number,branch,token):
    _,files=req("/pulls/"+str(number)+"/files?per_page=100",token)
    got={f.get("filename") for f in files}
    allow=ALLOWED[branch]
    if not got or not got.issubset(allow):
        raise RuntimeError("PR_FILES_OUTSIDE_ALLOWLIST")
    return sorted(got)
def open_or_verify(branch,sha,title,body,do_create=False):
    if branch not in ALLOWED or not re.fullmatch(r"[a-f0-9]{40}",str(sha)):
        raise RuntimeError("BRANCH_OR_SHA_REJECTED")
    token=credential()
    _,ref=req("/git/ref/heads/"+branch,token)
    if (ref.get("object") or {}).get("sha")!=sha:
        raise RuntimeError("GITHUB_REMOTE_SHA_MISMATCH")
    _,prs=req("/pulls?state=open&head="+USER+":"+branch+"&per_page=10",token)
    if len(prs)>1:raise RuntimeError("DUPLICATE_OPEN_PR_REVIEW")
    created=False
    if not prs:
        if not do_create:
            return {"status":"READY_REVIEW_BRANCH_NO_PR", "branch":branch,"source_commit":sha}
        _,pr=req("/pulls",token,method="POST",payload={
            "head":branch,"base":"main","draft":True,"title":title,"body":body})
        created=True
    else:pr=prs[0]
    number=check_pr(pr,branch,sha)
    # Independent second GET from provider, never assume a successful POST means delivery.
    _,pr2=req("/pulls/"+str(number),token)
    check_pr(pr2,branch,sha)
    files=verify_files(number,branch,token)
    return {"status":"DRAFT_PR_CREATED_VERIFIED" if created else "DRAFT_PR_EXISTING_VERIFIED",
            "pr_url":pr2.get("html_url"),"pr_number":number,
            "branch":branch,"source_commit":sha,"files":files,
            "main_unchanged":True,"owner_review_required":True}
def main():
    if len(sys.argv)!=4 or sys.argv[1] not in ("--check-roi","--create-cloud-profile"):
        raise RuntimeError("UNSUPPORTED_INVOCATION")
    mode=sys.argv[1]
    if mode=="--check-roi":
        branch="agent/imperion-dev-roi-brand-20261109";allowed_sha=sys.argv[2]
        if sys.argv[3]!="--read-only":raise RuntimeError("READ_ONLY_FLAG_REQUIRED")
        result=open_or_verify(branch,allowed_sha,"","",False)
    else:
        if sys.argv[3]!="--create-draft":raise RuntimeError("EXPLICIT_DRAFT_ONLY")
        result=open_or_verify("agent/imperion-dev-cloud-profile-20261109",sys.argv[2],
           "DRAFT: safe GitHub cloud/Android IMPERION DEV agent profile and acceptance tests",
           "Public repo only. Reuses existing IMPERION DEV Agent, no new paid model/service. Prepared from owner issue #245. Changes only agent profile, mobile guide and offline tests. No production modification, no merge, no secrets. Human approval required. Cloud Copilot execution NOT PROVEN; existing user account did not offer Copilot as eligible assignee at probe time.",True)
    print(json.dumps(result))
    return 0
if __name__=="__main__":
    try:sys.exit(main())
    except Exception as e:
        print(json.dumps({"status":"BLOCKED","reason":str(e)[:140]}));sys.exit(2)
