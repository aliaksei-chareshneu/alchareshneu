"""Existing IMPERION Agent #4: one fail-closed public/private model decision.

GROQ's historically verified GPT-OSS 120B route is GITHUB PUBLIC ONLY.
Never send private Telegram chats, CRM, or passwords to this provider.
This module chooses a route; it performs NO external inference/actions.
"""
from collections.abc import Mapping

STRONG_PUBLIC = "openai/gpt-oss-120b"
STRONG_PROVIDER = "groq"
PUBLIC_WORKFLOW = ("https://github.com/aliaksei-chareshneu/alchareshneu/"
                   "actions/workflows/imperion-groq-free-draft-smoke.yml")
LOCAL_ALLOWED = frozenset(("imperion-qwen35:4b", "qwen3:4b"))
PRIVATE_CLASSES = frozenset(("PRIVATE_CUSTOMER", "PRIVATE_MEMBER", "PRIVATE_EMAIL",
                             "PRIVATE_TELEGRAM"))
RESTRICTED_CLASSES = frozenset(("PRIVATE_BANK", "HEALTH", "CHILD_DATA",
                                "LEGAL_SECRET", "RESEARCH_UNAPPROVED"))
PUBLIC_PURPOSES = frozenset(("PUBLIC_COPY_DRAFT", "PUBLIC_TRANSLATION_DRAFT",
                             "PUBLIC_FACT_REVIEW"))
PUBLIC_SOURCES = frozenset((
    "https://aliaksei-chareshneu.github.io/alchareshneu/autopilot/feed.json",
    "https://aliaksei-chareshneu.github.io/alchareshneu/autopilot/rss.xml",
    "https://aliaksei-chareshneu.github.io/alchareshneu/druzina/",
    "https://aliaksei-chareshneu.github.io/alchareshneu/corporate/",
))
FORBIDDEN_FIELDS = frozenset(("message", "private_text", "chat_history", "phone", "email",
                              "telegram_chat_id", "recipient", "token", "api_key",
                              "password", "private_context"))

def deny(code):
    return {"status": "BLOCKED", "reason": code, "api_calls": 0, "external_actions": 0,
            "private_data_exported": False, "messages_sent": 0, "posts_published": 0}

def choose_model(request, runtime):
    """No side effects. Evidence flags only trusted from authenticated adapters."""
    if not isinstance(request, Mapping) or not isinstance(runtime, Mapping):
        return deny("INVALID_SCOPE")
    if (request.get("action") != "DRAFT" or
            any(request.get(k) is True for k in ("send", "publish", "charge"))):
        return deny("MODEL_CANNOT_EXECUTE_ACTIONS")
    klass = request.get("classification")
    if not isinstance(klass, str):
        return deny("INVALID_CLASSIFICATION")
    if klass in RESTRICTED_CLASSES:
        return deny("RESTRICTED_CONTENT_NO_MODEL_AUTOMATION")
    if klass in PRIVATE_CLASSES:
        if (request.get("model") == STRONG_PUBLIC or
                request.get("provider") not in (None, "ollama_local") or
                runtime.get("private_cloud_enabled") is True):
            return deny("PRIVATE_CLOUD_NOT_AUTHORIZED")
        if (runtime.get("local_backend") != "OLLAMA_CPU_ONLY" or
                runtime.get("host") != "http://127.0.0.1:11434"):
            return deny("LOCAL_PRIVATE_BACKEND_UNVERIFIED")
        model = request["model"] if "model" in request else runtime.get("selected_private_model")
        installed = runtime.get("installed_local_models", ())
        if (not isinstance(model, str) or
                not isinstance(installed, (list, tuple, set, frozenset)) or
                model not in LOCAL_ALLOWED or model not in installed):
            return deny("LOCAL_PRIVATE_MODEL_UNAVAILABLE")
        return {**deny(""), "status": "LOCAL_PRIVATE_DRAFT_ONLY",
                "provider": "ollama_local", "model": model,
                "owner_review_required": True}
    if klass != "PUBLIC_APPROVED":
        return deny("UNCLASSIFIED_CLOUD_CONTENT_BLOCKED")
    if (not isinstance(request.get("source_url"), str) or
            request.get("source_url") not in PUBLIC_SOURCES or
            request.get("public_source_verified") is not True or
            request.get("external_ai_approved") is not True):
        return deny("PUBLIC_SOURCE_OR_EXTERNAL_AI_APPROVAL_MISSING")
    if not isinstance(request.get("purpose"), str) or request.get("purpose") not in PUBLIC_PURPOSES:
        return deny("PUBLIC_PURPOSE_NOT_APPROVED")
    if any(k in request for k in FORBIDDEN_FIELDS):
        return deny("PRIVATE_FIELD_IN_PUBLIC_REQUEST")
    if request.get("model") is not None and request.get("model") != STRONG_PUBLIC:
        return deny("UNVERIFIED_CLOUD_MODEL")
    if (runtime.get("trusted_github_owner") is not True or
            runtime.get("free_quota_verified") is not True or
            runtime.get("provider_key_in_github_only") is not True):
        return deny("GITHUB_FREE_ACCESS_NOT_VERIFIED")
    return {**deny(""), "status": "DELEGATE_EXISTING_PUBLIC_ROUTER",
            "provider": STRONG_PROVIDER, "model": STRONG_PUBLIC,
            "existing_router": "ops/imperion-free-model-router.cjs",
            "workflow": PUBLIC_WORKFLOW, "owner_review_required": True,
            "data_scope": "PUBLIC_APPROVED_ONLY",
            "provider_call_verified": False}

def panel_catalog(private_model):
    return {
        "private": {"model": private_model, "provider": "ollama_local",
                    "status": "LOCAL_CPU_DRAFT_ONLY", "cloud_allowed": False},
        "strongest_public": {"model": STRONG_PUBLIC, "provider": STRONG_PROVIDER,
                             "status": "PUBLIC_ONLY_FREE_QUOTA_READBACK_REQUIRED",
                             "workflow": PUBLIC_WORKFLOW,
                             "private_chat_allowed": False},
        "personal_telegram_cloud": "BLOCKED_NO_PRIVATE_CLOUD_AUTHORIZATION",
        "auto_send": False, "model_choice_is_not_sender_permission": True
    }
