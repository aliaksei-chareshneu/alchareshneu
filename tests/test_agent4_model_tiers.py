"""Trust-boundary tests: never forward personal Telegram messages to Groq."""
import importlib.util
from pathlib import Path
import unittest

PATH=Path(__file__).resolve().parents[1]/'ops'/'agent4_model_tiers.py'
s=importlib.util.spec_from_file_location('agent4_models',PATH)
mod=importlib.util.module_from_spec(s)
s.loader.exec_module(mod)
LOCAL={"host":"http://127.0.0.1:11434","local_backend":"OLLAMA_CPU_ONLY",
       "selected_private_model":"imperion-qwen35:4b",
       "installed_local_models":["imperion-qwen35:4b","qwen3:4b"]}
PRIVATE={"action":"DRAFT","classification":"PRIVATE_TELEGRAM"}
PUBLIC={"action":"DRAFT","classification":"PUBLIC_APPROVED",
        "source_url":"https://aliaksei-chareshneu.github.io/alchareshneu/druzina/",
        "public_source_verified":True,"external_ai_approved":True,
        "purpose":"PUBLIC_COPY_DRAFT"}
GROQ={"trusted_github_owner":True,"free_quota_verified":True,
      "provider_key_in_github_only":True}

class T(unittest.TestCase):
 def test_private_remains_local(self):
  o=mod.choose_model(PRIVATE,LOCAL)
  self.assertEqual(o["provider"],"ollama_local")
  self.assertEqual(o["status"],"LOCAL_PRIVATE_DRAFT_ONLY")
  self.assertFalse(o["private_data_exported"])
  self.assertEqual(o["messages_sent"],0)
 def test_all_private_classes_respect_privacy(self):
  for k in mod.PRIVATE_CLASSES:
   o=mod.choose_model({**PRIVATE,"classification":k},LOCAL)
   self.assertEqual(o["status"],"LOCAL_PRIVATE_DRAFT_ONLY")
 def test_strong_groq_private_request_denied(self):
  for model in ["openai/gpt-oss-120b","groq:openai/gpt-oss-120b"]:
   o=mod.choose_model({**PRIVATE,"model":model},LOCAL)
   self.assertEqual(o["status"],"BLOCKED")
   self.assertFalse(o["private_data_exported"])
 def test_cloud_provider_private_denied(self):
  for provider in ["groq","openrouter","anthropic","gemini"]:
   self.assertEqual(mod.choose_model({**PRIVATE,"provider":provider},LOCAL)["reason"],"PRIVATE_CLOUD_NOT_AUTHORIZED")
 def test_untrusted_private_cloud_flag_not_permission(self):
  o=mod.choose_model(PRIVATE,{**LOCAL,"private_cloud_enabled":True})
  self.assertEqual(o["reason"],"PRIVATE_CLOUD_NOT_AUTHORIZED")
 def test_private_only_localhost(self):
  for host in ["https://api.groq.com","http://0.0.0.0:11434","http://10.0.0.1:11434"]:
   self.assertEqual(mod.choose_model(PRIVATE,{**LOCAL,"host":host})["status"],"BLOCKED")
 def test_private_cpu_required(self):
  self.assertEqual(mod.choose_model(PRIVATE,{**LOCAL,"local_backend":"CUDA"})["status"],"BLOCKED")
 def test_no_weak_or_uninstalled_model(self):
  for model in ["imperion-qwen3-cpu:0.6b","qwen3:0.6b","qwen3:9b"]:
   self.assertEqual(mod.choose_model({**PRIVATE,"model":model},LOCAL)["status"],"BLOCKED")
 def test_private_qwen3_4b_is_legal_fallback(self):
  self.assertEqual(mod.choose_model({**PRIVATE,"model":"qwen3:4b"},LOCAL)["model"],"qwen3:4b")
 def test_restricted_pii_does_not_use_a_model(self):
  for k in mod.RESTRICTED_CLASSES:
   self.assertEqual(mod.choose_model({**PRIVATE,"classification":k},LOCAL)["reason"],
                    "RESTRICTED_CONTENT_NO_MODEL_AUTOMATION")
 def test_no_external_actions_even_for_public(self):
  for k in ["send","publish","charge"]:
   x=mod.choose_model({**PUBLIC,k:True},GROQ)
   self.assertEqual(x["status"],"BLOCKED")
 def test_public_verified_still_draft_only(self):
  x=mod.choose_model(PUBLIC,GROQ)
  self.assertEqual(x["model"],"openai/gpt-oss-120b")
  self.assertEqual(x["provider"],"groq")
  self.assertEqual(x["status"],"DELEGATE_EXISTING_PUBLIC_ROUTER")
  self.assertEqual(x["api_calls"],0)
  self.assertFalse(x["provider_call_verified"])
 def test_public_source_allowlist(self):
  for url in ["https://unknown.example","https://evil.example/redirect","https://api.groq.com"]:
   self.assertEqual(mod.choose_model({**PUBLIC,"source_url":url},GROQ)["status"],"BLOCKED")
 def test_cloud_approval_mandatory(self):
  for k in ["public_source_verified","external_ai_approved"]:
   self.assertEqual(mod.choose_model({**PUBLIC,k:False},GROQ)["status"],"BLOCKED")
 def test_owner_and_free_quota_mandatory(self):
  for k in GROQ:
   self.assertEqual(mod.choose_model(PUBLIC,{**GROQ,k:False})["status"],"BLOCKED")
 def test_untrusted_public_text_does_not_leave_local(self):
  for k in mod.FORBIDDEN_FIELDS:
   self.assertEqual(mod.choose_model({**PUBLIC,k:"sensitive"},GROQ)["status"],"BLOCKED",k)
 def test_misclassified_personal_telegram_never_public_because_no_url(self):
  x=mod.choose_model({"action":"DRAFT","classification":"PUBLIC_APPROVED",
     "purpose":"PUBLIC_COPY_DRAFT","external_ai_approved":True,
     "public_source_verified":True,"message":"personal chat text"},GROQ)
  self.assertEqual(x["status"],"BLOCKED")
 def test_unapproved_other_model_rejected(self):
  x=mod.choose_model({**PUBLIC,"model":"qwen/qwen3.8-27b"},GROQ)
  self.assertEqual(x["reason"],"UNVERIFIED_CLOUD_MODEL")
 def test_unknown_scope_fails_closed(self):
  for q in [None,"x",{},{"classification":"PUBLIC_APPROVED"}]:
   self.assertEqual(mod.choose_model(q,GROQ)["status"],"BLOCKED")
 def test_panel_catalog_is_transparent(self):
  x=mod.panel_catalog("imperion-qwen35:4b")
  self.assertFalse(x["strongest_public"]["private_chat_allowed"])
  self.assertEqual(x["personal_telegram_cloud"],"BLOCKED_NO_PRIVATE_CLOUD_AUTHORIZATION")
  self.assertFalse(x["auto_send"])
 def test_private_evidence_never_leaked_in_return_json(self):
  secret="a private message from my Telegram chat"
  x=mod.choose_model({**PRIVATE,"message":secret},LOCAL)
  self.assertNotIn(secret,str(x))
 def test_malformed_unhashable_model_metadata_fails_closed(self):
  for cls in [[], {}, 2]:
   self.assertEqual(mod.choose_model({**PRIVATE,"classification":cls},LOCAL)["status"],"BLOCKED")
  for model in [[], {}, 23]:
   self.assertEqual(mod.choose_model({**PRIVATE,"model":model},LOCAL)["status"],"BLOCKED")
  for url in [[], {}, 24]:
   self.assertEqual(mod.choose_model({**PUBLIC,"source_url":url},GROQ)["status"],"BLOCKED")
  for purpose in [[], {}]:
   self.assertEqual(mod.choose_model({**PUBLIC,"purpose":purpose},GROQ)["status"],"BLOCKED")


if __name__=="__main__":unittest.main()
