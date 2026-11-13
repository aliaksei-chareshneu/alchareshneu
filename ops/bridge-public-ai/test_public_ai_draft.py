import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import public_ai_draft as mod

PAYLOAD={
 "job_id":"IMP-AI-PUBLIC-20261110-001",
 "owner_entity":"OSVC",
 "source_url":"https://aliaksei-chareshneu.github.io/alchareshneu/corporate/",
 "purpose":"PUBLIC_TRANSLATION_DRAFT",
 "language":"cs"
}
class Checks(unittest.TestCase):
 def test_reject_unapproved_fields_and_private_sources(self):
  self.assertEqual(mod.validate(PAYLOAD),None)
  self.assertIsNotNone(mod.validate({**PAYLOAD,"prompt":"Send private mail"}))
  self.assertIsNotNone(mod.validate({**PAYLOAD,"source_url":"https://example.com"}))
  self.assertIsNotNone(mod.validate({**PAYLOAD,"owner_entity":"DRUZINA_MORAVY_ZS"}))
  self.assertEqual(mod.dispatch({**PAYLOAD,"send":True})["status"],"BLOCKED")
 def test_dispatch_returns_review_only_from_fixed_script(self):
  with tempfile.TemporaryDirectory() as temp:
   repo=Path(temp)
   script=repo/"scripts"/"imperion-public-model-worker.cjs"
   script.parent.mkdir()
   script.write_text("'use strict';",encoding="utf-8")
   node=repo/"node.exe"
   node.write_text("",encoding="utf-8")
   result={"job_id":PAYLOAD["job_id"],"status":"DRAFT_FOR_OWNER_REVIEW",
    "owner_approval_required":True,"provider":"ollama_local","model":"imperion-qwen35:4b",
    "source_checked":True,"draft":"Public workshop",
    "messages_sent":0,"posts_published":0,"payments_created":0,"external_actions":0}
   class Completed:
    returncode=0
    stdout=json.dumps(result)
   calls=[]
   def fake_runner(args,**kwargs):
    calls.append((args,kwargs))
    return Completed()
   with patch.object(mod,"NODE_EXE",node),patch.dict(os.environ,{"LOCALAPPDATA":str(repo)}):
    out=mod.dispatch(PAYLOAD,repo_root=repo,runner=fake_runner)
   self.assertEqual(out["status"],"DRAFT_FOR_OWNER_REVIEW")
   self.assertEqual(len(calls),1)
   self.assertEqual(calls[0][0],[str(node),str(script)])
   self.assertIn("PUBLIC_TRANSLATION_DRAFT",calls[0][1]["input"])
   self.assertNotIn("GROQ_API_KEY",calls[0][1]["env"])
 def test_reject_model_claims_of_side_effects_or_wrong_provider(self):
  with tempfile.TemporaryDirectory() as temp:
   repo=Path(temp)
   script=repo/"scripts"/"imperion-public-model-worker.cjs"
   script.parent.mkdir()
   script.write_text("x",encoding="utf-8")
   node=repo/"node.exe"
   node.write_text("",encoding="utf-8")
   def fake_runner(args,**kwargs):
    class Done:
     returncode=0
     stdout=json.dumps({"job_id":PAYLOAD["job_id"],"status":"DRAFT_FOR_OWNER_REVIEW",
     "owner_approval_required":True,"provider":"groq","model":"openai/gpt-oss-120b",
     "source_checked":True,"draft":"Draft","messages_sent":0,"posts_published":0,"payments_created":0,
     "external_actions":0})
    return Done()
   with patch.object(mod,"NODE_EXE",node),patch.dict(os.environ,{"LOCALAPPDATA":str(repo)}):
    out=mod.dispatch(PAYLOAD,repo_root=repo,runner=fake_runner)
   self.assertEqual(out["status"],"BLOCKED")
   self.assertEqual(out["reason"],"PUBLIC_AI_PROVIDER_DENIED")
if __name__=="__main__":unittest.main()
