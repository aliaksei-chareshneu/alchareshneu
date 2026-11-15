# IMPERION Agent4 — owner-only Google CRM integration

Scope: **existing** Telegram Agent4 on OCI, existing local Windows SQLite mirror and
the existing private Google Community Hub. This is NOT a new CRM, a new bot, a
second Telegram polling consumer, a web app, an external AI API or a sender.

## Provenance, classification, and legally separate controllers

On user-initiated bot contact, an explicitly scoped \`/start osvc\` or
\`/start druzina\` generates a \`telegram-agent4\` local job. Existing
\`agent4_crm_handoff.pending()\` excludes owner self-tests and sources lacking
a controller scope. The local sync worker rechecks the original local job,
source-key digest, current controller, opt-out and owner-test event before
any outbound Google API request. Data sent to Apps Script contains only the
immutable SHA-derived source key, local job number, time and controller
plus fixed metadata flags. **No chat text, phone, name, email, handle,
payment amount or full Telegram ID leaves the local SQLite store.**

The Apps Script \`ImperionAgent4CrmBridge.gs\` runs as the authenticated
existing owner: \`ocOwner_()\` must verify the canonical Community Hub is
PRIVATE and owned by the signed-in caller. It exposes only Script Execution
API callable functions; no public \`doPost\` route, webhook or anonymous key.
It refuses unexpected source fields, stale (>90d)/future timestamps,
spurious opt-in claims, identity or payment claims and unknown controllers.
Import has a separate owner-controlled feature flag
\`IMP_AGENT4_CRM_ENABLED\` default OFF and a
\`IMP_AGENT4_CRM_KILL_SWITCH\`; no new Script Properties secrets.

- OSVČ: \`Leads\`, \`Submission_ID\` = immutable source key, deterministic
  \`LEAD-AG4-...\`, \`Stage=New\`, \`Action_Status=HOLD_IDENTITY_HISTORY_CONSENT_REVIEW\`.
- Družina Moravy z.s.: \`Druzina_Enrollment_Pipeline\`, \`Evidence\` = immutable
  source key, existing numeric \`DM-###\` sequence, \`Person\` blank,
  \`Outcome=PENDING_OWNER_REVIEW\` and \`Cash_Status=NOT_BANK_VERIFIED\`.
- Each row contains NO financial promise, booking, customer identity,
  attendance, outbound delivery or bank receipt.
- The same source key is scanned under the existing ScriptLock before writing,
  and read back immediately afterward. A second independent read-only
  \`impAgent4CrmVerifyToken\` must confirm the same case ID before local
  \`CRM_READBACK_CONFIRMED\` is stored. Ambiguous results are not blindly retried.

## Deployment order

1. Run 23 adversarial offline tests in GitHub Actions; no provider effects.
2. Clone the **already-bound** Community Hub Apps Script with owner \`clasp\`,
   capture SHA256 hashes of ALL existing remote files and manifest; add ONLY
   \`ImperionAgent4CrmBridge.js\`. Abort on source conflicts. Push once,
   fresh clone and independently verify every original hash unchanged.
3. Run owner Script API \`impAgent4CrmPingToken\` read-only; verify canonical
   tabs and default feature disabled. Call owner-only
   \`impAgent4CrmEnable('GO-AG4-CRM-20261115-OWNER',true)\` only after
   owner GO for **internal metadata-only CRM** and successful readback.
   This never grants user-message or social-publishing GO.
4. In a private logged-in Windows directory, persist \`.clasp.json\` with
   ONLY the already-bound script ID; use the account's existing \`clasp.cmd\`
   OAuth credentials. Never place Google tokens or source chat data in GitHub.
5. Run the Python sync \`ops/imperion-agent4-crm-sync.py\` once against the
   existing local Agent4 data. If pending=0, it records \`IDLE_NO_PENDING\`
   and does not touch the remote CRM. Then install ONE non-overlapping
   Windows 5-minute task for this *metadata bridge only*. It never calls
   Telegram getUpdates, WhatsApp, Meta or any outbound send API.
6. On the FIRST genuine inbound, independently check remote \`Leads\` or
   NGO pipeline source key and local SQLite \`CRM_READBACK_CONFIRMED\`,
   then classify identity, budget, consent and intent with owner review.
   Until then production *real buyer E2E* is **NOT VERIFIED**.

## Operations & rollback

Any error: fail closed, store only an error code in local settings, no
external action. When remote write outcome is unknown, read back the
source key before a possible idempotent import. Stop the scheduled helper
and set \`IMP_AGENT4_CRM_ENABLED=false\` for kill; do not disable the
single OCI Telegram listener or delete existing CRM rows. Existing
SocialPublisher remains separately owner-GO-gated. No paid API/subscription.

Generated QA tests and source approval are NOT proof of provider delivery,
buyer contract, publication, invoice or bank cash.
