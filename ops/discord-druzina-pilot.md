# Druzina Moravy Discord pilot - Project 80

Case_ID: JOB-IMP-COMMUNITY-PRESENCE-20261110
Entity: Druzina Moravy z.s., never personal OSVC or BrnoWalkers
Budget: 0 CZK incremental; no new paid cloud service or scheduled worker.
Stage: STAGED CODE / NOT LIVE; Discord account, server and bot authentication NOT VERIFIED.

## What is automated

A one-shot, dependency-free Node.js 20+ script:
- inventories channels and roles in an already-authorized Discord guild;
- checks names and category/parent conflicts before any write;
- creates only 3 categories, 8 text channels and 4 interest roles when absent;
- makes welcome/rules/announcements channels read-only for ordinary members;
- refuses invalid guild IDs, missing bot credentials and missing case-specific owner GO;
- never creates invites, sends public announcements or DMs, imports member lists, assigns staff privileges, creates payments or runs background polling.

The manifest is English-first; Czech/Russian/Ukrainian replies can be offered voluntarily. Discord interest roles are not legal association membership, course entitlement, verified skill or payment status. Website is the source for actual event terms: https://aliaksei-chareshneu.github.io/alchareshneu/druzina/ .

## Safe setup and first run

1. Owner only: check whether there already is an owned Druzina Moravy Discord server. Reuse it if found. Otherwise create one in the native Discord interface: https://discord.com/app . Never automate a personal Discord account.
2. Owner only: at https://discord.com/developers/applications create or select a bot application controlled by the organization and use official OAuth2 bot install to add it to that server. Restrict to View Channels, Manage Channels, Manage Roles; never grant Administrator, ban/kick, payments or DMs. Confirm role hierarchy.
3. Store DISCORD_BOT_TOKEN in a secure private secret store or local environment on an authorized executor; never paste a token into ChatGPT, GitHub, public browser pages, logs or a Sheet. Verify DISCORD_GUILD_ID belongs to the intended organization.
4. Read-only preview: node scripts/imperion-discord-bootstrap.cjs --plan
5. Tests: node --test tests/imperion-discord-bootstrap.test.cjs
6. Only after verifying exact server owner and approving this configuration operation, on a controlled host set IMPERION_DISCORD_WRITE_GO=JOB-IMP-COMMUNITY-PRESENCE-20261110:APPROVED, DISCORD_GUILD_ID and DISCORD_BOT_TOKEN, then run node scripts/imperion-discord-bootstrap.cjs --apply.
7. Inspect the Discord server itself, confirm role/channel permissions, and save real guild/channel IDs and observed action receipts in existing IMPERION_Execution_Receipts. No LIVE status without independent readback.
8. Owner manually enables Community/safety screening/onboarding, reviews moderator permissions and age settings, and validates every invite destination before inviting anybody. In Czechia Discord minimum age is 15. Do not require Discord from younger club participants.
9. Remove bot setup permissions after configuration if no ongoing management is necessary.

## Explicitly excluded from this release

- No server creation through a user token, self-bot or hidden browser automation.
- No public invites, partner outreach, autoposting, announcements, site changes, event registration or direct messages.
- No migration of BrnoWalkers/Telegram/WhatsApp users into Discord.
- No sync of private PII, minors, consent or member ranks to Discord.
- No new scheduler/agent/CRM. Future approved distribution uses existing Agent 3 and existing Channel Registry.

## Evidence and official references

- Discord server creation: https://support.discord.com/hc/en-us/articles/33023827550359-Discord-Server-Setup-Guide
- Self-bots forbidden: https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots
- Discord bot OAuth2: https://discord.com/developers/docs/topics/oauth2
- Discord channels API: https://discord.com/developers/docs/resources/guild
- Discord country minimum ages: https://support.discord.com/hc/en-us/articles/360040724612-Why-is-Discord-asking-for-my-birthday

Acceptance: CODE + TESTED is not SERVER LIVE. Record auth/date/server ID, 3 categories/8 channels/4 roles, permission readback, owner-managed onboarding, verified invite and website CTA before marking DONE.
