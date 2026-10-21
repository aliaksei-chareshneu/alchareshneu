# Platform recovery and media worker — 2026-10-16

This extends the existing Community Hub and MediaMachine. No second CRM, public site, bank ledger or paid subscription.

## Components and actual boundaries

| Component | Implementation | Activation evidence required |
| --- | --- | --- |
| Intake | Existing RevenuePipeline plus PlatformRecovery.gs | Actual Form -> exactly one Leads row -> replay yields no duplicate |
| Recovery | Published Form ID cross-check, specific trigger repair, bounded idempotent catch-up | Owner preview, reviewed start window, manual readback, then timer |
| Money | Existing Fio PR #25 | Correct legal account owner, read-only token, bank readback, dedup test |
| Social | Existing Social Publisher PR #23 | Per-channel official auth, rights, duplicate check, real post receipt |
| Video drafts | shortfactory_autopilot.py extends existing ShortFactory | Source SHA256 + queued licensed/owned/public-domain status, output/DB readback |
| Community | Existing bookings, members, products and calendars | Existing business/consent rules remain authoritative |

## Intake install
Add PlatformRecovery.gs to the existing bound script only after comparing cloud source with local files; preserve all existing files and deployments. This file deliberately adds no doGet/doPost endpoint and does not replace onOpen. Requires current RevenuePipeline with idempotent rpAppendLead_.

Store PLATFORM_RECOVERY_SINCE as a reviewed ISO timestamp in Script Properties. It is a fixed recovery window: no automatic cursor advance can hide an older failure. Run platformRecoveryPreview(), then platformRepairFormTrigger() if source-bound trigger count is not one. Repair does not call the legacy setup that also installs cleanup/digest jobs or edits Form items.

Run platformRecoverMissingLeads() (maximum 50 missing responses each invocation) and verify existing Leads. It reuses rpOnLeadFormSubmit, including existing owner notifications. No customer outreach. Do not rerun rpSetupRevenuePipeline as repair. Mark actual synthetic Form test unmistakably TEST and exclude it from cash and funnel metrics. Only after actual Form/readback/replay set PLATFORM_RECOVERY_E2E_VERIFIED=true and run platformInstallRecoveryTimer(). Rollback: platformPauseRecovery(); leave audit/CRM records intact.

Caveat: the existing lead handler still defines values/priorities and notification behavior. This add-on does not claim those business rules have been modernized. A notification failure after append can leave a saved lead without a notification; inspect owner notification integration separately. Do not call recovery a sales/payment or outreach engine.

## Media draft worker
Install shortfactory_autopilot.py beside the existing short_factory.py. Preview with `python shortfactory_autopilot.py`; process up to two eligible queued jobs with `python shortfactory_autopilot.py --execute`. It does not enqueue jobs, discover rights, generate scripts, narrate, approve or publish. It produces vertical draft videos using the existing renderer. A source whose hash changed is blocked; a renderer exit code alone is insufficient: READY_FOR_REVIEW and nonempty output are required. Existing lock is never stolen. A private JSON status contains counts and job IDs only.

Keep existing ingest/trends tasks. If adding a draft-render schedule, first check for an existing one and use a single named task with IgnoreNew, maximum two jobs/run and execution timeout. No autonomous public release is authorized by a successful draft render. If the PC is off, local processing is unavailable; VPS migration needs verified access before any uptime claim.

## Verification
- Node: `node --test tests/platform-recovery.test.cjs` — 12 synthetic cases pass.
- Python: `python -m unittest discover -s tests -p 'test_*.py' -v` — 6 fixture cases pass.
- These tests do not prove live Form ingestion, bank connection or social publication.
- Secrets and private source briefs are excluded from this public repository.


## Owner console and two bank profiles — 2026-10-17

New staged files: OperatorConsoleServer.gs, OperatorConsole.html, FioOSVC.gs.
The owner console reads the existing Hub: Leads, SocialPublishing, Events and Revenue_Config.
It displays bank profiles separately, excludes marked synthetic leads, and never treats expected revenue or CRM Paid status as verified cash.
Publication verification shown in the console means a stored PUBLISHED_VERIFIED record with a receipt URL; refreshing the console does not re-query providers.

Install these files in the current bound Apps Script project after reviewing the latest cloud source. Preserve the repaired RevenuePipeline and all other existing files. Do not replace doGet, doPost or onOpen. Run operatorInstallMenu() in an owner session, then open IMPERION. The menu is session-local; add operatorInstallMenu() to the existing onOpen only after inspecting that handler. The HTML is not a standalone public application.

OSVC adapter prerequisites in Script Properties:
- FIO_OSVC_READ_TOKEN: separate owner-created read-only token.
- FIO_OSVC_EXPECTED_ACCOUNT_ID: owner-verified account ID.
- FIO_OSVC_ENTITY_CONFIRMED: true only after account ownership verification.
Druzina uses the existing FioBank.gs and FIO_DRUZINA_* properties. Never put tokens in source, chat or logs.
Both account IDs and tokens must differ. OSVC imports only to OSVC_Fio_Transactions, deduplicates bank transaction IDs and does not settle NGO payments or mark orders paid.
Private owner-only Hub sharing is required. Verify one manual read against the bank and repeat without duplicates before enabling any schedule. No new OSVC banking timer has been installed.
A bank read-only adapter does not implement checkout, payment requests, invoices or automatic order fulfillment. These remain unfinished.

Observed operational state on 2026-10-17:
- Existing Form-to-Leads synthetic E2E succeeded after RevenuePipeline repair; alert/replay/history checks remain outstanding.
- Telegram has a recorded verified publication today.
- Facebook/Instagram publication remains constrained by Metricool quota.
- Existing Windows ShortFactory scheduled task was installed and verified on 2026-10-16; it had no eligible queued jobs. Current PC offline prevents execution/deployment checks.
- New console and OSVC module are committed here, not deployed. No live banking access or balance has been verified.
- Automated checks: 25 Node tests + 6 Python tests pass. HTML script syntax parses; live UI and bank integration are not yet tested.

Release checklist: reconnect existing PC; pull current cloud Apps Script source and diff; review staged changes; install add-ons without replacing repaired modules; open console as owner; configure distinct bank profiles privately; verify bank reads/dedup and UI; validate recovery replay and notifications; resolve social quota; run one eligible video end to end. Record evidence before declaring the platform live.

## Payment reconciliation preview
Add PaymentReconciliation.gs to the same reviewed installation. The console action previewPayments reads Druzina_Payments and Druzina_Fio_Transactions without updating either sheet. Exact numeric VS and CZK amounts yield CANDIDATE_ONLY, never settlement. Reused references, multiple transfers per payment, partial/excess payments, debits, currency mismatches and closed payment records require review. Current result is capped to 100 displayed rows, with total and truncation notice. Bank snapshot freshness is shown. OSVC Leads are not an order ledger and are deliberately excluded. 12 reconciliation fixture tests pass (37 Node tests total). Live banking/console E2E remains unverified.

## Console response recovery — 21 October 2026

The console now keeps both bank-import buttons disabled while a previously sent bank request has no callback, including after its 90-second timeout and a successful snapshot refresh. Reading the existing data remains available. A late success or failure callback releases the pending request without replacing a newer snapshot or automatically issuing another bank request. Errors describe the action result as unverified because a failed response cannot prove that no data was written.

Complete snapshots and payment previews are validated before updating the displayed records. Incomplete responses retain the previous values; malformed snapshots cannot replace a previously displayed bank balance with zero or label partial data as freshly updated. Failures during Google bridge setup also leave Refresh usable.

This guard applies to the currently open console; closing or reloading the dialog does not retain its pending-request state. After an interrupted session, inspect the existing bank import and checkpoints before retrying. The adapters' existing server locks, transaction-ID deduplication and polling interval remain authoritative across sessions.

Verification: 64 Node tests pass, including timeout followed by refresh, late callbacks, duplicate clicks, incomplete financial responses, zero versus unknown balances, and bridge initialization failure. The existing six Python worker tests also pass. Source syntax and whitespace checks pass. No authenticated Google UI or bank integration was exercised, no bank requests were issued, and this console update has not been uploaded to Apps Script. Install it only through the existing reviewed bound-project release procedure.

Browser verification follow-up: five additional tests now run the actual console HTML in Chromium with synthetic Google callbacks and networking disabled. They cover timeout/refresh/late receipt, incomplete snapshots, incomplete reconciliation previews, bridge failure, and all five tabs at 375 px, including external text remaining inert. Install the pinned dependency with `python -m pip install -r tests/browser/requirements.txt`, then `python -m playwright install chromium` and `python -B -m unittest discover -s tests/browser -p 'test_*.py' -v`. Set `CONSOLE_BROWSER_ARTIFACTS` to an output directory to capture synthetic screenshots. All 75 tests pass locally. The Operations tests workflow now runs the 64 Node tests, six worker fixtures and five browser tests for relevant pushes and pull requests; the Site quality workflow alone does not cover these modules. Authenticated Google runtime checks remain separate and unverified.

## Verified installation — 2026-10-18
At 07:24 Europe/Prague, clasp push succeeded for 14 files in the existing bound project. Fresh clasp pull and SHA256 comparisons matched all 14 files. Added console server/HTML, OSVC reader, reconciliation preview and recovery; inserted one IMPERION Operations item in the existing Community Hub menu. Current cloud baseline (including recent Telegram/RevenuePipeline changes) preserved and backed up locally before patching. No new public web-app deployment, banking sync, recovery timer or settlement was invoked. Server filename is OperatorConsoleServer.gs because Apps Script rejects server and HTML files with the same basename. Tests after rename: 37 Node cases pass. CLI operatorSnapshot execution failed with a permission error; authenticated UI opening and runtime data integration remain NOT VERIFIED. Open the existing spreadsheet, reload, choose Community Hub > IMPERION · Operations as the owner. Do not confuse source upload with complete platform activation. Video scheduled task last observed 07:20:58 result0; 07:24 preview selected0/rendered0/published0.
