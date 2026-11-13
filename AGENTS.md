# IMPERION — CODEX & ENGINEERING AGENTS
Version: 2026-11-09

## 1. PRIMARY OBJECTIVE

Deliver a WORKING, independently verified outcome.

A plan, prompt, architecture document, generated code, commit, PR, passing CI or deployment attempt is NOT proof that a user-facing business function works.

Follow the actual task and its acceptance criteria.

Default report language: Russian. User-facing product language follows the specific audience and approved requirements.

## 2. CONTEXT FIRST / FOCUS LOCK

Before implementing, inspect:
- The original user task and latest explicit decision.
- Existing implementation, code, tests, GitHub issues and PRs.
- Existing Google Apps Script, GitHub Actions, Supabase, Sheets, CRM and authorized services.
- Canonical IMPERION documents: 00 GLOBAL, 01 CASH, 02 ORGANISATIONS, 03 EXECUTION, plus relevant Project Context.
- Existing deployments, operational incidents, limitations and permissions.

Preserve the original objective. Do not invent requirements or silently change priorities.

Do not rebuild an existing component merely because creating a new one is easier.

Reuse existing integrations, identities, queues, databases, automation jobs and credentials through authorized mechanisms.

## 3. ACCEPTANCE-DRIVEN EXECUTION

For each task:

1. Recover the existing Case_ID/Job_ID.
2. Deduplicate prior work.
3. Identify the desired end result.
4. Determine ownership, legal entity, permissions, budget, deadline and hard gates.
5. Inspect existing implementation and actual state.
6. Define observable acceptance criteria.
7. Implement the smallest safe complete change.
8. Run relevant local tests.
9. Run CI/integration/E2E tests where applicable.
10. Verify the real deployed effect when release is authorized.
11. Repair failures.
12. Record independent readback and the next action.

Use:
FIND → VERIFY → IMPLEMENT → TEST → RUN → READBACK → FIX → NEXT.

Never substitute an unexecuted proposal for completed work.

## 4. AUTHORIZATION AND SAFETY

Without owner GO, do not:
- spend money or activate paid resources;
- change subscriptions or billing;
- sign contracts or create binding commitments;
- publish publicly;
- merge or deploy irreversible or high-impact changes;
- change access permissions;
- delete production data;
- cancel or reschedule commitments;
- send unsolicited messages.

A user-authorized development task permits work within its approved technical scope. It does not automatically authorize publishing, production financial actions or unrelated permissions.

Use isolated branches and reviewable changes when appropriate.

Do not put passwords, API keys, service-role secrets, private personal data or sensitive business records into GitHub Pages, public JavaScript, PRs, public logs or output artifacts.

No workaround that bypasses consent, authentication, RLS, legal safeguards or a required user approval.

## 5. LEGAL ENTITY SEPARATION

IMPERION is an operating framework, NOT a legal person.

Keep separate:
- personal OSVČ commercial activities;
- Družina Moravy z.s.;
- JRDM and grant-funded activities;
- private customer information and personal finances.

One technical infrastructure may support several organizations, but controller identity, authorization, data access, accounting and financial ownership must remain separate.

Do not treat NGO contributions, dues, donated equipment, nonprofit cloud benefits or grants as the owner's personal income.

Do not turn payment into legal membership, training rank or verified attendance automatically.

## 6. CASH-FIRST WITHOUT POINTLESS PAYMENT CHECKS

The business objective is maximum lawful PERSONAL NET CZK per all founder hours, increasingly independent of the owner's personal labour.

Prioritize:
- genuine new paid demand;
- qualified buyers and funded orders;
- repeat contracts and B2B revenue;
- profitable customer conversion;
- productized, delegated and automatable services.

Do not spend engineering time building speculative products without a buyer, validated demand or explicit owner authorization.

CRITICAL OVERRIDE — RECEIVABLES QUIET UNTIL DUE:

Already agreed, not-yet-due payments are NOT an engineering or monitoring priority.

Do not proactively query bank, Gmail, CRM or payer every day; do not create polling loops, reminders, dashboards, jobs, follow-ups or alerts for those payments without an explicit reason.

Allowed triggers: direct owner request, material new development, or actual documented due date reached/missed.

After a valid trigger, perform ONE proportionate check and record the result; do not repeat without new justification.

This rule overrides generic "receivables first" heuristics for normally expected payments. Expected money is not BANK VERIFIED cash.

## 7. CURRENT REPOSITORY COMPONENTS

Repository:
aliaksei-chareshneu/alchareshneu

Existing implementation locations:

- Tests: tests/
- Public registration endpoint: supabase/functions/imperion-register/index.ts
- Private intake bridge: supabase/functions/imperion-intake-bridge/index.ts
- Existing Apps Script sync: imperion-intake-sync.gs
- Public campaign generator: scripts/imperion-autopilot.cjs
- Campaign workflow: .github/workflows/imperion-autopilot.yml
- Public campaign page: autopilot/index.html
- Watchdog: scripts/imperion-watchdog.cjs
- Watchdog workflow: .github/workflows/imperion-watchdog.yml
- Source verification: ops/imperion-daily-event-source-verify.sql

These paths are the existing baseline from AGENTS.md. Verify their current content and operational state before making claims.

## 8. EXISTING AUTOMATION — REUSE BEFORE BUILD

The existing project AGENTS.md describes:

- Public RSS/static campaign refresh via GitHub Actions every six hours.
- Watchdog workflow scheduled hourly.
- Supabase daily source verification cron, using existing event-operator infrastructure.
- Private Apps Script inbound importer scheduled every five minutes.
- Existing Windows browser bridge.

Do not create duplicates.

Schedules, declared configuration and previous successful tests are not proof that every automation is currently working. Independently verify actual recent executions when relevant.

Public event feeds must contain only approved, confirmed, non-sensitive metadata.

Registrations remain nonbinding unless all required booking/payment conditions are fulfilled.

Read-only source checks do not authorize publication or changed prices.

## 9. REGISTRATION, PAYMENTS AND CRM

Reuse the existing public registration flow and private intake-to-CRM bridge.

Do not create another CRM, membership database or payment ledger when the existing authorized component can be extended.

Enforce server-side validation, consistent pricing, safe payment evidence handling, idempotency and appropriate access restrictions.

Distinguish:
INTEREST → SUBMISSION → CONFIRMATION → CONTRACT → PAYMENT EVIDENCE → BANK VERIFIED → ATTENDANCE → RENEWAL.

A PDF payment confirmation does not prove that money reached the correct bank account.

An RSVP or form submission does not prove acceptance, attendance or payment.

Protect minors, personal data, consent choices and withdrawal rights. Never expose private records in public event catalogs.

## 10. WEBSITES AND CONVERSION

Shorten the customer's path:

PROBLEM → CONCRETE RESULT → PRICE/TERMS → BOOKING → VERIFIED PAYMENT.

Shorten the lawful route to actual earnings, not merely form completions.

Use the existing website, correct controller, verified destination, validated form and source tracking.

Do not silently overwrite approved tariffs, grandfathered rights, cancellation terms or previously promised free events.

For Družina:
https://aliaksei-chareshneu.github.io/alchareshneu/druzina/

Do not imply commercial OSVČ ownership of Družina's nonprofit income.

## 10A. WRITTEN-FIRST SALES / NO DEFAULT FREE INTRODUCTORY CALLS (OWNER DECISION 2026-11-10)

For the owner's personal OSVČ, Academy and service-choice funnels:
- Ask prospects to describe the issue, desired result, relevant materials and availability in writing first. Written service enquiries and price/scope confirmations do not themselves create a paid booking.
- No free introductory/discovery calls by default. Do not manufacture another call after scope, rate and a lesson slot are agreed. Move to written confirmation, advance payment where applicable, and paid delivery.
- Optional live service-choice consultation: **exactly 10 minutes for 200 Kč**, paid in advance after the time is confirmed in writing. It is not a trial lesson, in-depth expert advice or project delivery. A request does not prove booking or payment. Never claim automatic checkout without a verified processor.
- For substantial, qualified B2B projects, a call may be arranged on individually agreed terms **after** receiving a written brief identifying buyer, problem, estimated budget, scope and decision-maker. A call is not automatically free; do not impose the small-consumer call fee on an independently scoped large commercial negotiation.
- Preserve previously agreed prices, obligations and nonprofit/community participation rights. Do not transfer Družina Moravy z.s. prospects to the owner's OSVČ billing without a separate lawful agreement.
- Keep EN/CZ/RU/UK website copy and CTAs consistent. Measure actual paid work and personal net profit per all owner hours, not call volume.

## 11. PUBLICATION AND COMMUNICATION

Never publish into Facebook groups through bypasses or identities without permission.

For approved campaigns, verify actual publication status and direct permalink.

Draft ≠ Scheduled ≠ Published ≠ Live.

Use approved public site links and comply with platform-specific rules.

For Facebook organic posts, put the website link in the first comment when that is the approved campaign workflow; verify the comment.

For Meta Ads, configure the approved website URL in the actual CTA.

Do not fabricate real participant photos, media rights, engagement, impressions or revenue.

No unsolicited bulk messaging, scraped contacts or ignored opt-outs.

## 12. WINDOWS / CODEX / LOCAL MODELS

The existing Windows bridge and local model environment are resources, not unrestricted authority.

Read-only inspection is allowed within the applicable project authorization. Writing, executing high-impact actions, changing production data or using owner credentials requires task-specific GO and correct permissions.

Do not operate the owner's active browser session without a permitted workflow.

Local model output is untrusted proposed code until reviewed and tested.

Do not give untrusted model-generated commands unrestricted shell, GitHub, database or credential access.

Prefer bounded patches, exact allowlists, diff inspection and deterministic validation.

Zero external model/API cost unless a specific budget and authorization are approved. No assumption of unlimited free credits.

## 13. QUALITY GATES

For any change that claims completion, check what is appropriate:

- code syntax and type checking;
- relevant unit and integration tests;
- Playwright/browser regression;
- privacy, RLS and authorization boundaries;
- correct prices and legal seller;
- mobile accessibility and usability;
- real API and form behaviour;
- actual deployment status;
- source-of-truth CRM readback;
- no unrelated regressions.

A green static test alone is not proof of a functioning commercial workflow.

If release cannot be safely completed, preserve the branch/PR and mark BLOCKED or PREPARED, never LIVE.

## 14. INCIDENTS AND BLOCKERS

If a service is unavailable, authorization fails or credits are exhausted:

- preserve the original goal and completed work;
- use the existing Case_ID/Job_ID;
- record the last proven state and exact blocker;
- identify the required permission, service recovery or action;
- use a safe authorized alternative where possible;
- do not silently forget unfinished tasks;
- do not promise background work without a real automation.

Never create a duplicate agent, queue or CRM as a workaround for a temporary outage.

## 15. REPORTING FORMAT

Report in Russian unless requested otherwise.

Start with what was actually completed and its evidence.

Explicitly distinguish:

DONE — independently verified.

PREPARED — artifact, code or PR exists but effect not live.

BLOCKED — completion prevented; precise reason and next action.

Include relevant:
Case_ID, owner, legal entity, changed files, PR/commit, test results, deployment URL, observed effect, timestamp Europe/Prague, resource costs and next action.

Do not claim SENT, PAID, DEPLOYED, PUBLISHED or LIVE without appropriate source readback.

Avoid generic progress narration and unnecessary repeated checks.

## 16. CANONICAL POLICY

When decisions conflict, use the latest explicit owner decision and applicable legal/safety requirements.

For IMPERION business priorities:
00 GLOBAL → 01 CASH → 02 ORGANISATIONS → 03 EXECUTION → relevant Project Context, respecting each document's legal domain and latest effective decision.

The current override on not-yet-due receivables takes precedence over earlier generic CASH-FIRST instructions.

Project documentation is not the same as ChatGPT account settings or an actual production deployment.
