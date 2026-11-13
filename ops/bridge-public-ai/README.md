IMPERION public-only AI route — existing BrowserBridge
Verified date 2026-11-10 Europe/Prague; legal subject OSVC, not Druzina Moravy z.s.

ROUTE
The existing private Supabase browser_jobs queue (action public_ai_draft, target agent zmrzlina)
-> existing BrowserBridge Edge service -> existing Windows Scheduled Task "Browser Bridge Agent"
-> Python public_ai_draft.dispatch -> trusted Node scripts/imperion-public-model-worker.cjs
-> existing model router -> allowlisted public source and loopback Ollama imperion-qwen35:4b
-> DRAFT_FOR_OWNER_REVIEW result in the existing browser_jobs.result field.

SECURITY
- No inbound ports, no external Ollama listener, no new CRM/agent/queue, no arbitrary shell or browser UI actions from this new action.
- Strict approved fields only: job_id, owner_entity=OSVC, source_url from the known three first-party public sources, purpose=PUBLIC_TRANSLATION_DRAFT, language=en/cs/ru/uk.
- No private mail, CRM content, children, bank data, grant submissions, contact lists, user prompts, sends, publications or payments.
- Approved flags are constructed inside the trusted worker rather than copied from a remote payload.
- Model output is unverified owner-review DRAFT, not LIVE or accepted public copy.
- On-device disk quota persisted under LocalAppData/IMPERION/public-ai-quota-v1; blocked/stale mutex fails closed. This is not a cross-provider/global quota.
- No Groq credentials or paid fallback are passed to the device worker.
- 60-second local model budget, 80-second worker budget, 90-second broker lease; errors block rather than sending/publishing.
- Existing unique browser_jobs.idempotency_key and max_attempts=1 control replays. BrowserBridge Edge route and SQL table remain private.

INSTALLATION / RECOVERY
- Source backup: ops/bridge-public-ai/public_ai_draft.py and test_public_ai_draft.py in the existing main site repo.
- Installed Python: User home/BrowserBridge/agent/public_ai_draft.py.
- Fixed addition at the START of the existing browser_agent.py execute(context,page,action,payload):
  if action == "public_ai_draft":
      from public_ai_draft import dispatch as public_review_only
      return page, await asyncio.to_thread(public_review_only, payload)
- Reviewed repo working copy: User home/ChatGPT-Workspace/80-Digital-Platform-Automation/local-tools/public-ai-runtime.
- Only use reviewed Git commits; never auto-fetch arbitrary code before processing queued jobs.
- Restart only the existing Browser Bridge Agent scheduled task after no in-flight jobs; verify exactly one browser_agent.py and live heartbeat in public.browser_agents.
- The agent listens automatically when the PC and network are online. It is not guaranteed cloud-hosted 24/7. No new scheduled task or periodic model generation has been added.

PROOF / READBACK
- Direct 2026-11-10 live first-party corporate HTML -> Qwen local output: DRAFT_FOR_OWNER_REVIEW, 541 chars, 49.23 seconds; 0 messages/posts/payments.
- Supabase job IMP-AI-QUEUE-20261110-001, id f796e47d-f06f-47a7-aceb-729376f4ff4f: queued -> claimed -> done; result DRAFT_FOR_OWNER_REVIEW, provider ollama_local, 610 chars, 0 messages/posts/payments, source_checked=true.
- Python unit tests: python -m unittest discover -s ops/bridge-public-ai -p test_public_ai_draft.py -v.
- Node unit tests: node --test tests/imperion-public-model-worker.test.cjs tests/imperion-free-local-quota.test.cjs.
- Prior Groq Free API smoke via GitHub Action and owner screenshot Free/$0 prove a separate cloud public-draft pilot only.
- Actual cloud Groq->local-PC automatic failover and universal shared quota are NOT PROVEN, do not claim general 24/7 autonomous AI sales, CRM sync, sending or publication.
