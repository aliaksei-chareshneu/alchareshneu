---
description: "Diagnose existing lead form -> canonical CRM ingestion without real customer data"
---

Investigate [issue #13](https://github.com/aliaksei-chareshneu/alchareshneu/issues/13) within this existing repository.

Read `AGENTS.md`, `.github/copilot-instructions.md` and the relevant revenue source and tests first. Do not open a duplicate issue, submit genuine personal contact details, disclose existing customer responses, or modify production Apps Script triggers without specific approval.

Deliver a reviewable PR with:
1. A grounded diagnosis of form ID, installed trigger source/handler, failure points and idempotency by `Submission_ID`. If live access is unavailable, explicitly label diagnosis NOT VERIFIED.
2. The smallest safe code/test fix for reconciling installed triggers by **both** handler and form ID and avoiding duplicate CRM appends.
3. A synthetic test plan: one TEST-only form submission, exactly one corresponding canonical `Leads` row on readback, no duplicate on retry, and a controlled failure surfaced for review.
4. Evidence for each check; no false claim of live deployment or paid customers.

Never push secrets, Form response PII, account tokens or CRM copies to the public repo. Stop at draft/test PR if account login, owner approval or access to private Apps Script is required.
