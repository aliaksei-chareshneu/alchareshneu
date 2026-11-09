"""Offline tests of reviewer-owned auto-Draft-PR mechanism; NO credentials or network."""
from pathlib import Path
import sys
import unittest
from unittest import mock

local=Path(__file__).resolve().parent
if not (local/"github_draft_pr_gate.py").is_file():
    local=Path(__file__).resolve().parents[1]/"scripts"
sys.path.insert(0,str(local))
import github_draft_pr_gate as gate
import safe_cloud_profile_job as worker

BRANCH="agent/imperion-dev-cloud-profile-20261109"
SHA="a"*40
NUM=888
URL="https://github.com/aliaksei-chareshneu/alchareshneu/pull/888"
FILES=sorted(gate.ALLOWED[BRANCH])

def fake_pr(sha=SHA,draft=True):
    return {"number":NUM,"state":"open","draft":draft,"merged_at":None,
            "html_url":URL,
            "head":{"ref":BRANCH,"sha":sha,
                    "repo":{"full_name":gate.ROOT}},
            "base":{"ref":"main"}}

class PRGateTests(unittest.TestCase):
    def run_gate(self,prior=None,remote_files=FILES):
        calls=[]
        def req(path,token,method="GET",payload=None):
            calls.append((method,path,payload))
            self.assertEqual(token,"FAKE_NONSECRET_TEST_TOKEN")
            if path.startswith("/git/ref/"):
                return 200,{"object":{"sha":SHA}}
            if path.startswith("/pulls?"):
                return 200, [] if prior is None else [prior]
            if path=="/pulls" and method=="POST":
                self.assertTrue(payload["draft"])
                self.assertEqual(payload["base"],"main")
                self.assertEqual(payload["head"],BRANCH)
                return 201,fake_pr()
            if path=="/pulls/888":
                return 200,fake_pr()
            if path=="/pulls/888/files?per_page=100":
                return 200,[{"filename":x,"status":"added"} for x in remote_files]
            raise AssertionError("UNEXPECTED_GITHUB_API_ROUTE "+path)
        with mock.patch.object(gate,"credential",return_value="FAKE_NONSECRET_TEST_TOKEN"),mock.patch.object(gate,"req",side_effect=req):
            result=gate.open_or_verify(BRANCH,SHA,"Draft safe review","Public issue task",True)
        return result,calls

    def test_autonomously_creates_draft_and_independent_readback(self):
        result,calls=self.run_gate()
        self.assertEqual(result["status"],"DRAFT_PR_CREATED_VERIFIED")
        self.assertEqual(result["pr_url"],URL)
        self.assertTrue(result["owner_review_required"])
        self.assertEqual(result["files"],FILES)
        self.assertEqual(len([x for x in calls if x[0]=="POST"]),1)

    def test_existing_draft_pr_never_duplicated(self):
        result,calls=self.run_gate(fake_pr())
        self.assertEqual(result["status"],"DRAFT_PR_EXISTING_VERIFIED")
        self.assertEqual(len([x for x in calls if x[0]=="POST"]),0)

    def test_outside_repo_file_fails_closed(self):
        with self.assertRaisesRegex(RuntimeError,"PR_FILES_OUTSIDE_ALLOWLIST"):
            self.run_gate(None,remote_files=[".github/workflows/pages-production.yml"])

    def test_invalid_branch_or_hash_never_requests_credentials(self):
        with mock.patch.object(gate,"credential",side_effect=AssertionError("NO_SECRETS_READ")):
            with self.assertRaisesRegex(RuntimeError,"BRANCH_OR_SHA_REJECTED"):
                gate.open_or_verify("main",SHA,"","",True)
            with self.assertRaisesRegex(RuntimeError,"BRANCH_OR_SHA_REJECTED"):
                gate.open_or_verify(BRANCH,"bad","",True)

    def test_nondraft_review_pr_rejected(self):
        with self.assertRaisesRegex(RuntimeError,"DRAFT_PR_INVARIANT_FAILED"):
            gate.check_pr(fake_pr(draft=False),BRANCH,SHA)
        with self.assertRaisesRegex(RuntimeError,"DRAFT_PR_INVARIANT_FAILED"):
            gate.check_pr(fake_pr(sha="b"*40),BRANCH,SHA)

    def test_local_model_only_prose_and_cloud_entitlement_is_not_claimed(self):
        p=worker.profile({
            "summary":"GitHub code review and tests are required for every public code change.",
            "verification":"All changes must stay in a Draft PR until the owner verifies tests."
        })
        self.assertIn("NEVER auto-merge",p)
        self.assertIn("BLOCKED",p)
        self.assertIn("Draft",p)
        guide=worker.guide()
        self.assertIn("NOT YET VERIFIED",guide)
        self.assertIn("403",guide)
        self.assertIn("zmrzlina",guide)

if __name__=="__main__":
    unittest.main(verbosity=2)
