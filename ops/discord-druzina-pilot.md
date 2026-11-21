# Druzina Moravy Discord pilot - Project 80 / PC reconnect package

**Case_ID:** JOB-IMP-COMMUNITY-PRESENCE-20261110
**Legal entity:** Druzina Moravy z.s. (not personal OSVC, BrnoWalkers or grant-funded partners).
**Status:** CODE_READY, real Discord account/server/bot not verified or connected. ZERO public posts/invites/fees.
**Budget:** 0 CZK incremental. No new CRM, agent, paid service, PC scheduled task or public campaign.

## Current delivered assets

- `scripts/imperion-discord-bootstrap.cjs` - official Discord **bot** API, safe one-shot creator for 3 categories, 8 text channels, 4 zero-permission interest roles; reads existing objects first and aborts on conflicts.
- `tests/imperion-discord-bootstrap.test.cjs` - 12 no-network tests, including wrong server identity, duplicate names, privilege escalation, read-only channels, rate-limit/permission rejection and idempotent second run.
- `ops/discord-druzina-ready.ps1` - Windows assistant that checks Node 20+, local tests, basic Internet; prompts for guild ID, exact name and a **hidden bot token**, then does auth READ-ONLY `--inspect`. No secrets saved.
- `START-DISCORD-SETUP.cmd` - double-click on Windows and choose (1) offline preparation, (2) authenticated inspection, or (3) configuration. The setup still requires explicit typed owner approval before any write; Windows PowerShell process-only ExecutionPolicy Bypass does not change permanent system policy.
- `ops/discord-druzina-content.md` - prepared welcome, rules, first-training and event template; **no messages published**.
- `.github/workflows/discord-bootstrap-qa.yml` - CI tests on Linux and Windows for reviewable pull requests, **no Discord secrets**.

## Owner-only work required, once (no tokens sent in chat)

1. On https://discord.com/app check whether **Druzina Moravy** server already exists under the appropriate owner account. Reuse it. Otherwise create it as a club/community. The owner controls the server and must confirm the legal controller.
2. In https://discord.com/developers/applications check whether a controlled bot application is already installed. Reuse if appropriate; otherwise create a bot application, install it to **that** server by official OAuth2 with **View Channels, Manage Channels, Manage Roles** only. Do not grant Administrator, member-reading, message-reading or DM scopes. The bot's highest role must be above only the new interest roles it creates.
3. In Discord User Settings, enable Developer Mode, right-click the correct server and copy its **Server ID**. Check its exact displayed server name. Keep the bot token inside the local Windows hidden prompt, or an approved private secret store: never paste into chat/Drive/GitHub or a public site.
4. Run the prepared Windows package (download ZIP and extract to a local folder) by double-clicking `START-DISCORD-SETUP.cmd`, choose option **2 = INSPECT**. This checks ownership/name and reports exact missing channels/roles *without writing*.
5. Only after owner agrees to the missing changes, choose **3 = APPLY**, verify details and type `APPROVE DISCORD STRUCTURE`. The script checks again, creates only missing approved objects, independently rereads the live server and reports a verified structure or a blocker. It does not send invitations, posts or messages.
6. Owner completes Community server settings, onboarding, age restrictions, moderators, rules screening and safety checks. Discord in Czech Republic is 15+. A club member younger than the Discord minimum can use other lawful organiser channels instead.
7. Public invite links, notices and any promotional outreach are **separate actions requiring separate approval** and readback; do not infer permission from a created server or an internal bot role. Official website is https://aliaksei-chareshneu.github.io/alchareshneu/druzina/ . Old promised free 14 Nov workshop is unchanged; do not infer empty capacity or auto-invite.

## Paths for CLI (Windows and Unix)

Preview: `node scripts/imperion-discord-bootstrap.cjs --plan` (offline; no token required).

Tests: `node --test tests/imperion-discord-bootstrap.test.cjs` (mocked Discord API; does not call Discord).

Read-only API inspection: use the Windows wizard option 2 to pass `DISCORD_GUILD_ID`, `DISCORD_EXPECTED_GUILD_NAME` and `DISCORD_BOT_TOKEN` as ephemeral environment for `node scripts/imperion-discord-bootstrap.cjs --inspect`.

Writing: use the Windows wizard option 3; `--apply` needs case-specific `IMPERION_DISCORD_WRITE_GO=JOB-IMP-COMMUNITY-PRESENCE-20261110:APPROVED` provided only after exact owner confirmation, and a server-name match. The script never stores the bot token.

If GitHub branch PR#262 is still draft/unmerged, use the ZIP or check out the exact feature branch. **Do not run old `main` source and assume it includes this script**.

## Required readback before claiming LIVE

- Real Discord server ID and correct owner; bot member with least privilege.
- `APPLIED_READBACK_VERIFIED` after creation of only the intended 3 categories, 8 channels and 4 interests (or all existing).
- Ordinary member cannot post to #welcome, #rules-and-safety, #announcements; no staff/private leak.
- Owner reviewed Discord Community and onboarding configuration; newcomer test on desktop and mobile; legal age alternatives.
- Actual first public welcome, invite URL, source-tracked website link and enrolments only **after** separately approved publication and independent provider readback.
- Record results in existing Community Hub: `IMPERION_Agent_Jobs`, `IMPERION_Execution_Receipts`, `SocialPublishing` when applicable, and existing channel catalog. No new spreadsheets or monitoring loops.

## Current hard blockers

- `zmrzlina` offline on latest readback; Windows package cannot be copied or executed remotely now.
- Discord login, existing server dedup, bot installation and secure permissions have not been verified.
- No mechanism to auto-create a server via an ordinary user account, and self-bot use is forbidden.

## Sources

- Discord self-bot policy: https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots
- Server creation: https://support.discord.com/hc/en-us/articles/33023827550359-Discord-Server-Setup-Guide
- Roles and permissions: https://support.discord.com/hc/en-us/articles/214836687-Discord-Roles-and-Permissions
- Age policy: https://support.discord.com/hc/en-us/articles/360040724612-Why-is-Discord-asking-for-my-birthday
- Discord REST API: https://docs.discord.com/developers/resources/guild

**Operator next trigger:** after authorized owner setup and `zmrzlina` online, run option 2, get trusted readback, then option 3 only with actual owner approval. Do not represent a staged PR or Windows test as an actual LIVE Discord server.
