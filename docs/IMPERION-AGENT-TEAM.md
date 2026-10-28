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
| Chief of Staff | Sorts urgent existing jobs, upcoming non-draft events | Inbox/calendar fully checked or saved time |
| Sales | Scores existing leads, excludes HOLD/Lost/opt-out, dedupes, requires verified SENT history and stop list | New SENT messages, orders, cleared cash |
| Social Media | Uses SocialPublishing.Job_ID, calls existing AI content adapter in zero-network PREVIEW on PUBLIC_APPROVED source | Post, permalink or delivered update |
| AEO + SEO | Audits local robots, sitemap, root and corporate HTML | Production ranking, crawl, live deployment |
| Video Editor | Reviews rights/hash readiness in existing ShortFactory snapshot | A rendered, uploaded or published clip |

Review checks must cover legal entity, private/public data classification, media rights, consent, opt-out, prior contact history, source ID, Europe/Prague deadline, duplicate jobs, payments and owner approval. No replay of provider ERROR, PENDING or DELIVERY_UNVERIFIED without independent reconciliation.

## Blocked and not claimed

- `zmrzlina` was online but Desktop Commander returned MONTHLY_QUOTA_EXHAUSTED on 28 Oct; no local Windows execution was verified in this run.
- n8n, bound Apps Script, social publisher, payment system and production GitHub Pages are NOT deployed or modified by this change.
- Qwen3 4B and ShortFactory existed in previous verified state; this patch does not start inference or render jobs, and does not assume current resource availability.
- Any production rollout, posts, financial/legal commitments and external sends require owner authorization and real readback.

Do not merge merely because tests pass. This code is a bounded review-first integration point into the existing operator lane.
