# IMPERION project instructions for Codex and engineering agents

## Objective
Deliver a working, independently verified change, not a plan, prompt, architecture document, or PR presented as production.

## Procedure
- Preserve the user's original task. Check prior implementation, issues, existing Google Apps Script, GitHub Actions, Supabase and Sheets before creating anything.
- Define real acceptance criteria, then inspect -> implement -> test -> run -> independently verify -> repair.
- Reuse the existing public registration flow and private intake-to-CRM bridge. Do not create another CRM or bypass approval of events.
- Keep OSVČ commercial data, Družina Moravy z.s. and grant-funded data and funds separate.
- Never publish to Facebook groups through a bypass or a profile without actual permission. Social campaigns require owner review and a verified direct permalink before a POSTED claim.
- Do not place PII or credentials into GitHub Pages, logs, client JavaScript or public files.
- Preserve informed consent, safety, nonbinding registration, explicit time/location approvals, copyright and platform rules.
- Do not spend money, issue new subscriptions, send unsolicited bulk messages, or assume unlimited third-party credits.
- A draft, CI pass, Git commit or PR is not a production release. Check the live endpoint and existing CRM when the task requires them.

## Existing project
- Node and Playwright tests are in tests/.
- Public register endpoint: supabase/functions/imperion-register/index.ts.
- Private intake bridge: supabase/functions/imperion-intake-bridge/index.ts and imperion-intake-sync.gs.
- Safe public campaign refresh: scripts/imperion-autopilot.cjs, .github/workflows/imperion-autopilot.yml.
- Public website: autopilot/index.html. Feed is public and must NEVER contain private contact data.
- Canonical operating docs: existing 00 GLOBAL / 01 CASH / 02 ORGANISATIONS / 03 EXECUTION in connected Drive.

## Report
Separate DONE with evidence, PREPARED but not live, and BLOCKED with precise next action. Respond in Russian unless the user's task requests another language.
