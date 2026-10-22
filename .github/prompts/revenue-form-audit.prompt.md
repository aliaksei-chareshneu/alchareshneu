---
description: "Read-only regression audit of the previously resolved lead form -> CRM integration"
---

# Revenue form regression audit (issue #13 resolved)

[Issue #13](https://github.com/aliaksei-chareshneu/alchareshneu/issues/13) was **closed 2026-10-17** after owner-authenticated synthetic Form→canonical Leads→Telegram checks and live same-response-ID replay. This is historical evidence, not proof of new production activity. **Do not reopen, rebuild, resubmit Form responses, reconfigure triggers or generate duplicate customer alerts by default.**

Read `AGENTS.md`, `.github/copilot-instructions.md`, the existing issue resolution notes, and the actual current revenue code/tests if accessible. Determine whether a *new* failure or owner-requested regression test exists before proposing any change. If it does not, report `NO_NEW_INCIDENT` with the source and stop.

If a new regression is documented, provide a **read-only first** diagnosis:
1. Identify the authorized source Form, current bound Apps Script, installed trigger (handler **and** form ID), validation, and destination CRM `Leads`. Where account access is absent, state `NOT VERIFIED`; never guess runtime state from an old source checkout.
2. Review immutable `Submission_ID` deduplication, alert acknowledgments/fallback and present source coverage. Never read/commit/export private customer responses into this public repository.
3. Propose the smallest testable fix **only if the defect is reproduced**. Use offline synthetic fixtures first. A fresh synthetic live submission or trigger write needs explicit appropriate authorization; never contact a QA identity.
4. Deliver a concise test/acceptance report and, only if warranted, a small reviewable PR. A code diff, green CI or browser thank-you screen does not itself prove a new CRM row or any paid order.

Keep current Academy WhatsApp and corporate email fallbacks until separately reviewed. Do not create a second CRM, new workflow, recurring alerts, paid product, or production release.