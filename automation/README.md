# IMPERION · Free Agent Pilot (28 October 2026)

**Status: SOURCE COMMITTED / NOT DEPLOYED / NOT AUTHENTICATED.**
This folder is a small, safe starter component, not a complete autonomous agent.
Production website is unchanged. Everything is isolated on a feature branch.

## Architecture, without new subscriptions

    Existing Oracle VM: n8n (KEEP) -> free-tier model API -> verified draft
                                           |
    Additional orchestration (later): Hermes Agent or OpenClaw (pick ONE)
                                           |
             PC: open-computer-use + Playwright MCP
             Android: scrcpy + adb-mcp
             Social: official APIs / existing Metricool
             Personal Facebook: prepared draft + human publication

Run the Python worker on demand; it needs no Python packages and no idle daemon.
The Oracle VM does not run the 120B model: the remote free-tier inference provider does.
Do NOT build a permanent LLM server on the 1 GB Oracle VM.

### Quick local test

    python3 -m unittest discover -s automation -p "test_*.py" -v

### First live generation (after account setup)

1. Verify the chosen Groq organization is on its **Free** plan (not Developer).
2. Create a Groq API key at https://console.groq.com/keys.
3. Store the key privately in your shell / secret manager (NEVER in GitHub text files).
4. Run:

    GROQ_API_KEY=... python3 automation/free_inference.py --prompt "Prepare a Czech-language draft of a one-paragraph invitation to a training."

The result has "status": "DRAFT_ONLY". This is intentional.
If your provider key is for a paid organization, the script CANNOT verify or
prevent costs, so do not use that key under a hard-zero-budget policy.

To enable optional OpenRouter fallback, set OPENROUTER_API_KEY and
OPENROUTER_FREE_MODEL to a model ID ending with ":free".
Do not rely on backup being available: provider quotas are finite.

### n8n integration, retaining the existing instance

Preferred low-memory integration is an **HTTP Request** node in the existing n8n
directly to Groq (https://api.groq.com/openai/v1/chat/completions), using a
credential stored in n8n. Request body needs "model":
"openai/gpt-oss-120b" and a messages array. Stop on HTTP 429; do not
fall through to a paid service. The script is a standalone CLI alternative,
especially useful for developer tests; do not create a second n8n instance.

Set a clear input classification gate: no private mail, WhatsApp chats,
documents, student data, passwords or personal health data may be sent to a
free external LLM without separately verified purpose, permissions, privacy
terms, and the user's explicit choice.

### Source-first findings

| Area | Preferred practical component | Caveat |
|---|---|---|
| Free coding agent | Google Antigravity CLI: https://antigravity.google | Free weekly quotas; direct scripting/CI, **not** a backend for third-party consumer agents |
| Alternative coding agent | OpenCode: https://opencode.ai | FOSS client; limited free models or external API |
| Lightweight model | Groq gpt-oss-120b: https://console.groq.com/docs/rate-limits | Free tier capped 1,000 requests and 200k tokens/day as of 2026-10-28 |
| Free 24/7 compute | Oracle Ampere A1: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm | 2 OCPU + 12 GB equivalent, home region, capacity not guaranteed |
| Always-on scheduler | Existing self-hosted n8n: https://docs.n8n.io/hosting/ | Keep current setup; check available RAM |
| Persistent gateway | Hermes: https://github.com/NousResearch/hermes-agent | Optional later, avoid installing alongside OpenClaw |
| Alternative gateway | OpenClaw: https://github.com/openclaw/openclaw | Optional later, choose ONE, not both |
| Browser automation | Microsoft Playwright MCP: https://github.com/microsoft/playwright-mcp | Node/browser installed on local PC |
| Desktop automation | open-computer-use: https://github.com/opensymph/open-computer-use | Runs on Windows/macOS/Linux; installation on zmrzlina not verified |
| Android | scrcpy: https://github.com/Genymobile/scrcpy | No root; debugging must be authorized, keep ADB local |
| Android MCP | adb-mcp: https://github.com/iksnerd/adb-mcp | ADB device must be paired |
| Telegram control | Telegram Bot API: https://core.telegram.org/bots/api | Bot control; bot cannot initiate conversations |
| WhatsApp personal | whatsapp-mcp: https://github.com/lharries/whatsapp-mcp | **Unofficial** linked-device bridge; risk to account and private data |
| Instagram posting | Meta Instagram API | Professional Creator/Business only |
| TikTok posting | Official TikTok Content Posting API | Audited app needed for unrestricted public posting |
| YouTube uploads | YouTube Data API | OAuth/quotas, 100 upload API calls/day baseline |
| Facebook personal | NO official autonomous publishing API | Use prepared native Share flow + owner confirmation |
| Existing social scheduler | Existing Metricool | Free plan 1 brand, 20 published posts/calendar month |
| Self-host social scheduler | Postiz | Requires RAM, platform app approvals; does not bypass Meta/TikTok policy |

## Safety and acceptance criteria

- External messages: prepare first, check conversation history and opt-outs; never send without the specific authorized workflow and evidence.
- Pages: return the real permalink after publication; "scheduled" != "published".
- Computer: use authenticated outbound tunnel / private network, keep ADB off public Internet.
- Payments/contracts: no autonomous purchases, account changes or signatures.
- Database/website: changes go to an isolated branch and Pull Request first; tests and owner acceptance before production deployment.
- Rate limits: fail closed on exhaustion, no hidden paid API fallback, no account farming.
- Privacy: do not expose API keys, session cookies, WhatsApp logs, or private project data to public GitHub Actions logs.

## What remains to get VERIFIED LIVE

- Authenticate to Oracle Cloud (account access not present in this environment), inspect existing n8n config and free A1 capacity.
- Create or connect at least one free model API key (none has been provided to this pilot).
- Restore local PC execution: Desktop Commander paired device is online, but the service reported monthly usage exhausted on 2026-10-28. No installation has occurred on the PC.
- Pair Android once with the local PC via ADB; install local ADB-MCP / browser tools.
- Configure each network separately. The already-connected Metricool brand currently shows FB Page, Instagram, YouTube, GBP; personal FB publishing cannot be delegated via its API.
- Complete a real non-public end-to-end run and inspect the output before any public actions.
