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

New staged files: OperatorConsole.gs, OperatorConsole.html, FioOSVC.gs.
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
