# IMPERION — five agent functions without subscriptions

**28 October 2026 — REVIEW BRANCH, NOT PRODUCTION.** This is one read-only operator over the EXISTING workflows, not five new CRMs, accounts, subscriptions or publishers.
Implementation: `ops/imperion-agent-team.cjs`, Node 22, no added dependencies. Its functions are `chief`, `sales`, `social`, `seo`, `video`.

## Acceptance

- Now: unit tests and a synthetic end-to-end run must show a READ_ONLY_PREVIEW report with **zero emails, posts, charges, payments, bookings or remote/paid AI requests**.
- Later: authorized existing Hub/n8n exports a current private snapshot, the agent report is compared to live rows, approved actions run only through EXISTING guarded workflows, and every real effect has an independent provider receipt.
- A GitHub commit or green CI test does NOT establish that an autonomous runtime is installed, running continuously or connected to Gmail/Calendar/n8n.

## Owner-only Google Sheets snapshot bridge (STAGED, NOT INSTALLED)

`ImperionAgentSnapshot.gs` provides the private function
`imperionAgentBuildSnapshot_()` in the existing, owner-authenticated
Community Hub-bound Apps Script project. It reads only the exact current
`Leads`, `Revenue_Actions`, `SocialPublishing`, `Events`,
`IMPERION_Agent_Jobs` headers, with a narrow field allowlist.
It omits free-text Notes, customer names, descriptions and social captions,
and turns actual Google Sheets Date objects into UTC ISO strings. It does
not use Gmail, Calendar, n8n, paid models, write cells, create a timer or
expose a web endpoint. It returns data only to an authorized private
server/editor caller, never to a public page, log or PR. Media remains
an existing ShortFactory SQLite source on the owner's device; the
snapshot intentionally labels that list empty until independently read.
No cloud installation or protected-data export has been performed.

## 01 November 2026 main-forward-port
Current main no longer contains the old ops/ai-content-pipeline.cjs module or the old operations-tests.yml.
Do not resurrect them. Social now returns SOURCE_VALIDATED_PREVIEW_NOT_RENDERED after public-source
checks, and never claims generated content. Tests run in the existing site-quality.yml.
Added ops/imperion-proof-auditor.cjs, a public GitHub GET-only proof verifier with
strict repository and numeric-ID allowlist. It verifies a PR or one exact CI run only,
not a deployed website, published post, accepted service, contract, or bank-cleared cash.
Example public readback: node ops/imperion-proof-auditor.cjs --kind pr --id 154
--claim PR_DRAFT_OPEN --sha EXPECTED_HEAD_SHA (40 hex chars).
CI must be pinned to the exact run head SHA.

## Existing sources: one queue, no duplication

Use Community Hub tabs `Leads`, `Revenue_Actions`, `Events`, `SocialPublishing`, `IMPERION_Agent_Jobs`. Media source is the existing ShortFactory SQLite database; do not move customer data into the public repository. Input is a bounded locally exported JSON snapshot using existing exact tab keys, `schema_version:1`, `source_system:"EXISTING_IMPERION_HUB"`, an opaque `snapshot_id`, and an explicit ISO offset-aware `captured_at`. The marker is a format contract, **not authentication**. Real snapshots belong to the authorized private owner process.

**Synthetic smoke, zero network:**

    node ops/imperion-agent-team.cjs --input ops/imperion-agent-team-synthetic.json

**Private snapshot, still read only:**

    node ops/imperion-agent-team.cjs --input <local-private-snapshot.json>

Results go to stdout, not a second queue or database.

## Agents / verified outcome boundaries

| Function | Actual functionality | NOT proof of |
| --- | --- | --- |
| Chief of Staff | Sorts urgent jobs and events; surfaces claimed DONE/VERIFIED without independent receipt for review | Inbox/calendar checked, provider-readback or saved time |
| Sales | Scores existing leads, quarantines explicit synthetic QA fixtures, propagates no-contact by Lead_ID/email/company, requires verified SENT history and stop list | New SENT messages, orders, cleared cash |
| Social Media | Uses SocialPublishing.Job_ID, validates PUBLIC_APPROVED source and rights, no content rendering | Post, permalink or delivered update |
| AEO + SEO | Audits local robots, sitemap, root and corporate HTML | Production ranking, crawl, live deployment |
| Video Editor | Reviews rights/hash readiness in existing ShortFactory snapshot | A rendered, uploaded or published clip |

Review checks must cover legal entity, private/public data classification, media rights, consent, opt-out, prior contact history, source ID, Europe/Prague deadline, duplicate jobs, payments and owner approval. No replay of provider ERROR, PENDING or DELIVERY_UNVERIFIED without independent reconciliation.

## Blocked and not claimed

- `zmrzlina` was online but Desktop Commander returned MONTHLY_QUOTA_EXHAUSTED on 28 Oct; no local Windows execution was verified in this run.
- n8n, bound Apps Script, social publisher, payment system and production GitHub Pages are NOT deployed or modified by this change.
- Qwen3 4B and ShortFactory existed in previous verified state; this patch does not start inference or render jobs, and does not assume current resource availability.
- Any production rollout, posts, financial/legal commitments and external sends require owner authorization and real readback.

Do not merge merely because tests pass. This code is a bounded review-first integration point into the existing operator lane.

## 1 November 2026: bounded audit fixes (still not LIVE)

- Sales excludes explicit `QA_SYNTHETIC` / `TEST_FIXTURE` flags from the existing Hub queue without treating those fixtures as genuine opt-outs. A real stop/opt-out action blocks every matching `Lead_ID` even when the Revenue_Actions tab has no Email or Company columns. Report `qa_only_excluded` separately.
- Chief no longer drops claimed `DONE/CLOSED/VERIFIED` jobs from all visibility. `completed_needing_readback` exposes each closed claim for external receipt audit; presence of Evidence_URI is NOT proof of real execution.
- Node tests cover the new QA exclusions, stop-list inheritance, evidence-missing and evidence-present-but-unverified cases. The operator still sends no messages, changes no cash status and makes no network requests.
- Before a release, recheck the current `main` divergence (252 commits behind at 1 Nov readback); never force merge the old Draft PR. The owner-bound Apps Script and real provider receipts remain separate release gates.


## 01 Nov 2026: closed-loop booking and proof pilot (PRIVATE SOURCE INSTALL, NO SETTLEMENT)
- Added \`ImperionClosedLoopAudit.gs\`, an owner-only Apps Script read-only aggregate auditor using EXISTING Community Hub tabs. It correlates \`Druzina_Bookings\` to \`Druzina_Payments\` / \`Druzina_Sessions\`, reviews quotes, agent jobs and existing execution receipts, checks duplicate IDs and deployment checklist hard gates. It returns only counters and technical gate IDs — no contact data or payment references.
- The first independent cloud source readback on 01 Nov showed 10/10 owner Apps Script files matching SHA-256 (after \`clasp push\` and a new \`clasp pull\`), including this new module; no trigger, web app endpoint or new spreadsheet was created. This is **SOURCE_INSTALLED**, not proof that an authorized owner has invoked the function successfully. \`clasp run\` still has no API-executable deployment and is not a safe substitute for a real user runtime test.
- The auditor is deliberately incapable of confirming a payment: \`bank_readback='NOT_PERFORMED'\`, \`bank_verified_receipts=0\`, \`provider_verified_bookings=0\`, \`paid_checkout_release_allowed=false\`. A \`VERIFIED\` CRM field, a stored receipt URL or a Stripe payout status cannot supersede an independently obtained verified bank transaction.
- \`ImperionAgentSnapshot.gs\` optionally attaches the sanitized \`control_audit\` aggregate when both private modules are installed; \`ops/imperion-agent-team.cjs\` now includes a \`closed_loop\` section that copies **only allowlisted aggregate counts** and explicitly rejects forged paid/approved/posted signals. The snapshot itself remains PRIVATE and must never be pushed or printed in CI or a public URL.
- Synthetic tests cover owner / Hub identity / timezone guards, duplicate IDs, partial payments, orphan bookings, closed jobs without independent receipts, approved status forgery, privacy redaction, and no network/sends/triggers.
- Existing public registration remains a **nonbinding request**. Družina paid HEMA checkout, new quotes, booking confirmation, calendar sync and cash recognition remain blocked by owner legal, insurer, payee and independent provider proof gates. No release or merge from this PR without an independent live user-session readback and a separate GO.
- Runtime next: invoke \`imperionClosedLoopAuditHealth\` privately as the verified owner inside the existing Apps Script project, inspect ONLY the aggregate response, then connect a bounded handler through the EXISTING private operator lane (no duplicate cron or CRM). Verify actual provider receipts per legal entity before any settlement.
