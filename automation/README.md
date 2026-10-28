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


## Verified second-pass findings (2026-10-28)

Primary sources are linked below. This section documents RESEARCH, not a deployed or authorized integration.

1. **Context7**: Free plan = 1,000 API calls/month, then 20 bonus calls/day while over quota, for public libraries. It provides documentation only, not inference or desktop execution. Source: https://context7.com/plans
2. **Antigravity**: Direct CLI scripting/CI under free weekly limits is available. Official FAQ explicitly forbids wrapping consumer Antigravity login/CLI as the inference backend of OpenClaw, OpenCode or any third-party application. Source: https://www.antigravity.google/docs/faq ; https://antigravity.google/pricing
3. **Perplexity Pro**: Its web Research tier is NOT a free API entitlement; API Platform is separately billed and currently has no complimentary credits. Source: https://www.perplexity.ai/help-center/en/articles/11187416-which-perplexity-subscription-plan-is-right-for-you
4. **Free model API**: Groq gpt-oss-120b currently lists base limits 1k requests/day and 200k tokens/day, but account-specific limits take precedence. OpenRouter Free is limited to 50 requests/day, with model/provider variability. Workers AI has a free 10k-neuron/day allocation, but certain frontier models require paid billing. Sources: https://console.groq.com/docs/rate-limits ; https://openrouter.ai/pricing ; https://developers.cloudflare.com/workers-ai/platform/pricing/
5. **Oracle**: Always Free A1 is 1,500 OCPU-h and 9,000 GB-h per month (equivalent 2 OCPU/12GB continuously); subject to region stock. Existing VM capacity/organization authorization NOT CHECKED. Source: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
6. **Nonprofit-only cloud credits**: Microsoft Azure grant $2k/year eligible nonprofits, AWS Nonprofit Credit Program up to $5k. Eligibility, actual grant balance, conditions, taxes/fees and billing safeguards NOT CHECKED. MUST NOT transfer nonprofit cloud/credits to unrelated commercial OSVČ activities. Sources: https://learn.microsoft.com/en-us/industry/nonprofit/microsoft-for-nonprofits/nonprofit-offerings-products ; https://aws.amazon.com/government-education/nonprofits/nonprofit-credit-program/
7. **n8n**: Native instance-level MCP server is supported in self-hosted Community 2.18.3+. Keep existing instance and expose only explicitly selected workflows; additional n8n-mcp self-host server is optional, not mandatory. The n8n Sustainable Use License allows the organization to author its own workflows but does not allow hosting a competing automation SaaS for customer editing. Sources: https://n8n.io/mcp/ ; https://support.n8n.io/article/can-i-use-your-license-for-my-use-case
8. **PC**: local open-computer-use offers accessibility-based desktop MCP on Windows/macOS/Linux; Microsoft Playwright MCP covers browser UIs. Neither makes a remote computer accessible by itself. Sources: https://github.com/opensymph/open-computer-use ; https://github.com/microsoft/playwright-mcp
9. **Android**: scrcpy 4.x / adb-mcp official repo support device mirroring, tapping and UI inspection over locally authorized ADB. Pair devices first, never expose ADB TCP port to the public Internet. Sources: https://github.com/Genymobile/scrcpy ; https://github.com/iksnerd/adb-mcp
10. **Transport**: Cloudflare Tunnel is available on all plans, with Zero Trust Access behind authentication; configuring Zero Trust Free may require billing details even when no fee is charged. Tailscale Personal is free only for NON-COMMERCIAL use; it must not be presumed suitable for OSVČ operations. Sources: https://developers.cloudflare.com/tunnel/ ; https://developers.cloudflare.com/cloudflare-one/setup/ ; https://tailscale.com/pricing
11. **Social API**: Buffer Free = 3 channels, 10 queued posts/channel, 3,000 requests / 30 days, API and MCP. Its own support explicitly says **Facebook personal and Professional profiles cannot be connected**. Instagram Personal publishing is notification-only; Instagram Professional supports automatic publishing. TikTok official Direct Post requires scope authorization and developer app audit for public posts. Sources: https://buffer.com/pricing ; https://developers.buffer.com/guides/integrations/mcp ; https://support.buffer.com/articles/supported-channels-LM3P7Y4zsp ; https://developers.tiktok.com/docs/en/content-posting-api-get-started
12. **OpenClaw** is FOSS with a persistent Gateway, messaging channels and local browser nodes; however, its WhatsApp connection uses unofficial WhatsApp Web/Baileys and is NOT an official WhatsApp Business API integration. Account safety/terms risk should be approved before pairing a personal number. Sources: https://github.com/openclaw/openclaw ; https://docs.openclaw.ai/channels/whatsapp
13. **Telegram** Bot API and MTProto are officially free; MTProto user clients are monitored for abuse and may be banned. Do not send unsolicited messages or scrape private content for model training. Source: https://core.telegram.org/ ; https://core.telegram.org/api/obtaining_api_id
14. **YouTube** default API quota currently lists up to 100 video upload calls/day. Publication permissions, OAuth and channel-level success must be actually verified; a successful upload API call is not a public post. Source: https://developers.google.com/youtube/data/reference/rest/v3/videos/insert
15. **GitHub Actions** standard GitHub-hosted runner is free for public repos and suitable for small read-only offline CI. NEVER connect a self-hosted runner on a personal PC to a public GitHub repo. Sources: https://docs.github.com/en/billing/concepts/product-billing/github-actions ; https://docs.github.com/en/actions/reference/security/secure-use

### Deployment decision

- **Choose the existing n8n instance as the scheduler**; do not add OpenClaw/Hermes on the 1GB Oracle until RAM and backups are checked.
- **Connect an official Free-tier model API via secret manager**, hard stop on quota and zero-authorization for paid fallback.
- **Use developer tools Antigravity / OpenCode interactively**, not as an unauthorized inference subscription relay.
- **One desktop gateway per PC** with human-reviewed permission scopes; phones pair locally.
- **Do not auto-publish to Facebook personal profiles.** Draft and explicitly owner-confirm a native post.
- **Request only two screenshots when essential**: Oracle Compute VM shape/region/RAM (no IPs/keys) and Microsoft Nonprofit Hub Offers for grant eligibility.


## Telegram Secretary Mode pilot · 28 Oct 2026

Telegram policy source: automation/telegram_business_policy.js. It is a **pure policy module** to integrate with the already-existing IMPERION n8n intake/router or Apps Script. It DOES NOT create a new agent service, new CRM, queue, webhook, credential or Telegram bot, and cannot send messages on its own.

- Official Telegram Connected Business Bots: https://core.telegram.org/api/bots/connected-business-bots
- Official setup: https://core.telegram.org/bots/features#business-bots
- No Telegram Premium required to connect a Business bot. Only one may be connected to a user account at a time.
- The right can_reply applies to recent incoming private chats (last 24 hours); business_connection_id must match.
- **Do not change the existing channel bot @moravian_host_bot webhook.** It already publishes to authorized Telegram channels. Prefer a separate owner-created Secretary bot in BotFather, subject to owner approval.
- Exclude friends and sensitive chats; first test only individually allowlisted customers.
- Draft-only by default. scopeApprovedByOwner, matching businessConnectionId, exact allowed chat IDs, and autoReplyApproved are all checked before a payload can be prepared.
- This function only emits a proposed Telegram payload, never makes HTTP requests.
- The real integration (NOT yet implemented) must verify connection rights, sender, authorization, idempotency, expiry, per-chat policy and log only redacted proof to existing execution receipts, not message bodies.
- Unknown requests, prices, refunds, dates, safeguarding, health, minors or commitments require human review.
- No personal Telegram historical corpus ingestion and no private-chat data sent to free AI APIs in this pilot.
- Run synthetic tests with: node --test automation/test_telegram_business_policy.js
- Go-live acceptance requires owner-selected chats, exact owner-approved reply categories, owner-connected bot, fake safe inbound message, actual provider ACK, explicit enable and exit/rollback.

## Funding checked against actual incoming mail

- 11 Oct 2026: Microsoft confirmed Družina Moravy nonprofit eligibility. **Not** proof that the Azure $2,000 sponsorship is active.
- 22 Oct 2026: Goodstack confirmed nonprofit eligibility and earlier Microsoft/Canva approvals; Google on 27 Oct reported YouTube and ambiguous "branch" approved. **Not** proof of any Google Cloud compute credit.
- 16 Oct 2026: Oracle Free Trial ended; only Always Free resources remain.
- 20 Oct 2026: Google Cloud trial notice said 30 days remain, but the console must confirm credit balance/expiry.
- Azure activation: https://learn.microsoft.com/en-us/industry/nonprofit/microsoft-for-nonprofits/claim-activate-nonprofit-azure-grant — sign in as validated primary contact, Offers > Activate, acceptance of terms, billing safeguards. Activate within 90 days of offer issuance.
- Oracle A1 free: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm — 2 OCPU/12 GB RAM equivalent, capacity availability/account quota not yet checked.
- AWS worldwide nonprofit credit up to $5k: https://aws.amazon.com/government-education/nonprofits/nonprofit-credit-program/ — country-specific partner approval not verified; credits expire, usage afterward can incur charges.
- GitHub Education teacher/researcher free Copilot Pro eligibility: https://docs.github.com/en/education/about-github-education/github-education-for-teachers/apply-to-github-education-as-a-teacher — actual eligibility/academic status not verified.

**Legal separation**: do not use NGO-sponsored Azure/AWS resources to run unrelated commercial OSVČ outbound campaigns or personal chats. Segregate roles, credentials, privacy policies, cost and grant attribution. Do not activate pay-as-you-go billing, sign contracts, or charge a credit card without owner approval.
