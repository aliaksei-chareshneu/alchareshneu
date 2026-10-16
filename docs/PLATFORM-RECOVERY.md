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
