# Platform recovery and media worker — 2026-10-16

Latest installation state (23 October 2026): the reviewed console/bank/reconciliation sources from `7d6358f6e8f69d54c48abe5c793adc02704b34c2` are now installed in the confirmed Hub-bound project, with all seven cloud file hashes independently verified. Existing handlers and manifest were preserved, and the existing menu already references `operatorOpen`. This supersedes historical statements below that the console has not been uploaded. See [the live installation readback](../CONSOLE-BANK-RELEASE.md#live-installation-readback--23-october-2026) for verified headers, runtime limitations and remaining ecosystem acceptance checks. Full ecosystem operation is not yet verified.

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

Recovery source validation now requires a real calendar date, seconds and an explicit `Z` or numeric timezone offset in `PLATFORM_RECOVERY_SINCE`; date-only and timezone-free values are rejected before reading Form responses. The existing Leads sheet must have exactly one `Submission_ID` column so an ambiguous header cannot hide already imported submissions. These guards are source changes pending installation in the existing recovery project; they neither set the recovery window nor enable recovery.

After installation of the updated recovery source, a successful `platformRecoveryPreview` editor run also writes one `RECOVERY_PREVIEW` JSON entry to the execution log. It contains the check time, response/missing counts, batch limit and exact matching trigger count, plus explicit zero recovery/publication and unverified-cash flags. No response identifiers, customer fields or Script Properties are logged. A failed or denied preview emits no successful receipt. This makes the result visible without relying on editor return-value display; it does not prove ingestion, execute recovery or install a timer.

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

The checked-in Code.gs now also adds an IMPERION Operations entry to the existing Community Hub menu when operatorOpen is installed. Menu construction does not run the console or request owner/bank data; the owner check still runs on opening the console. Code.gs without console modules retains its existing commands. For a live project, compare its current onOpen first and apply only the conditional menu entry if absent; the source package deliberately omits Code.gs to preserve cloud changes.

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

## Automatic console reads — 21 October 2026

The open console now refreshes its existing Hub snapshot once per minute after the first successful load. A checkbox disables automatic reads for that dialog, and the status explains pauses. A hidden page, active request or pending bank callback pauses the timer. Errors and timeouts require a successful manual Refresh before automatic reads resume. Returning to the page schedules one overdue read without replaying missed intervals. Queued callbacks from canceled timers cannot issue new requests.

Only `operatorSnapshot` runs automatically. Bank imports, payment preview, recovery and publishing are not invoked by the timer, and no Apps Script trigger is installed. A pending bank request continues to block automatic reads even if its timeout has expired and the owner manually refreshed the snapshot.

Verification: 81 Node tests, eight Python worker fixtures and eight offline Chromium scenarios pass (97 total). Browser checks include automatic reads, disabling/re-enabling, page visibility, recovery from an error, and the existing pending-bank and mobile-layout scenarios. This revision has not been uploaded to Apps Script; the historical installation below predates it.

## Lead deadline queue — 21 October 2026

The console now selects the 40 displayed lead tasks after sorting the complete eligible queue. It prioritizes overdue deadlines, today's deadlines, invalid dates, missing dates and future work, with totals and a truncation notice. Blank rows and synthetic records do not count; closed/held/dormant/waiting actions and Won/Lost stages remain excluded with case and whitespace normalized. Deadlines use Europe/Prague, including daylight-saving changes. Date-only text lasts the whole local day; timestamps need an explicit timezone, and invalid or ambiguous text stays visible for review. Each automatic snapshot refresh recalculates priorities without modifying the CRM or sending messages.

Missing or duplicate required lead headers fail the snapshot. Client checks reject inconsistent counters or incomplete rows before replacing displayed data. Missing sheets and older server modules show an unavailable queue, not a verified zero. Verification: 93 Node tests, eight worker fixtures and 12 offline Chromium scenarios pass (113 total), including complete sheet Date conversion, tasks beyond row 40, Prague midnight and repeated daylight-saving hours, invalid dates, legacy-module fallback, automatic priority refresh, and mobile layout. This source revision has not been installed in Apps Script.

## Publication monitoring — 21 October 2026

The console now classifies all nonempty SocialPublishing records and selects at most 100 after prioritizing records needing attention. Counters and a truncation notice distinguish the complete sheet from displayed rows. Pending jobs, drafts, inactive records and stored confirmations stay distinct. Confirmation requires `PUBLISHED_VERIFIED`, an acceptable absolute HTTPS receipt and no conflicting stored error. Provider IDs, queued states and legacy publication labels do not qualify. This remains a view of Hub evidence, not a live provider verification or publisher.

The server returns fixed diagnostic codes instead of raw provider errors. Service limits, manual work, unknown statuses and uncertain results remain visible without copying technical response bodies into the panel. Receipt links reject embedded credentials and common token/signature parameters; the client rechecks links, including legacy responses. Missing/duplicate required publication headers fail the snapshot, inconsistent counters preserve the previous complete display, and missing sheets/older modules are labeled unavailable. No posting, retries, triggers or sheet writes are added.

Verification: 104 Node tests, eight worker fixtures and 16 offline Chromium scenarios pass (128 total). They include attention records beyond row 100, complete versus displayed counts, public receipt parameters, malformed/credential-bearing links, queued informational notes, raw-error omission, server/client response compatibility, native schedule Date conversion, schema checks, automatic confirmation refresh, legacy fallback and mobile scrolling. This source revision has not been installed in Apps Script.

## Event agenda — 21 October 2026

The owner console now sorts Active event rows into current scheduled intervals, starts later today, future events, date reviews and past intervals. It calculates every phase at the same snapshot time, uses Prague calendar days, returns up to 100 rows after sorting and reports totals for the full active dataset. Within groups, current intervals end soonest first, future starts sort chronologically and past intervals sort most recent first. The displayed phase is schedule information, not proof of attendance or delivery.

The shared strict ISO parser preserves existing lead-deadline behavior. Events additionally accept the existing Prague local text format with minute or second precision, validated by a parsing/formatting round trip and repeated-hour checks. Native Date cells and explicit timezone offsets normalize to UTC instants for display in Prague. Ambiguous/nonexistent hours, missing times and invalid intervals remain visible for review. Required headers must appear exactly once; client checks reject inconsistent counters or phases and keep the prior snapshot. Missing sheets and older modules show unavailable diagnostics rather than verified zero counts. No calendar, registration, reminder, messaging or payment write is added.

Verification: 117 Node tests, eight worker fixtures and 20 offline Chromium scenarios pass (145 total), including events beyond row 100, exact start/end boundaries, Prague midnight, daylight-saving fixtures, explicit offset ordering, native Date conversion, schema errors, automatic phase changes, legacy fallback and mobile scrolling. Local-time parsing uses bounded synthetic Utilities.parseDate fixtures and does not verify the live Google runtime. This revision has not been installed in Apps Script.

## Recovery diagnostics and manual report — 21 October 2026

The System tab now replaces the raw recovery preview JSON with counts, a server completion time shown in Prague, trigger review messages and the limit for a separate recovery run. Scope is the configured window at the time of the manual request and matching Form submit triggers visible to the owner in the current project. Other projects and historical responses outside that window are not audited. The server checks the existing module's read-only contract and returns only approved counters and flags; raw errors, response IDs and unknown fields are omitted. No response is recovered or notification sent by this check. Automatic refreshes retain the timestamped report without rerunning it.

Snapshots separately display selected recovery settings and recorded window/success/error markers. This reads properties only, without Form or trigger APIs. Missing module/binding/form/window, absent success history, invalid/future values and an error lacking a later success marker have fixed diagnostic messages. Stored values never establish current timer health, recovered counts, new intake or notification delivery. Invalid property text is suppressed; date-only timestamps receive a review label without changing the recovery module's parser. Older console servers explicitly show unavailable diagnostics and clear old markers.

Incomplete metadata rejects the snapshot before display changes. Invalid, failed, timed-out and late previews preserve the last complete manual report. The existing pause action validates the PAUSED receipt and retains its confirmation time after refreshing settings, with an in-progress-work caveat. PlatformRecovery.gs, RevenuePipeline, repair/install functions and schedules are unchanged. This console revision still requires reviewed installation in the bound project; source merge does not deploy Apps Script.

Verification: 127 Node tests, eight Python worker fixtures and 24 offline Chromium scenarios pass (159 total). New checks cover owner/binding guards, normalized/invalid/future markers, diagnostic precedence, current module preview compatibility, bounded counters and read-only flags, omitted private fixture fields, snapshot reads without Form/trigger access, automatic refresh separation, mobile layout, pause readback and stale/malformed/failed response handling. No live Google, Form, banking or messaging call was made.

## Reproducible console source package — 21 October 2026

Operations tests and local downloads now use `package_console_release.py` to assemble the existing nine-file allowlist from an explicit full Git commit SHA. The local optional ZIP has fixed metadata and uncompressed bytes. Readback compares the package against committed source blobs and regenerated SOURCE_COMMIT/SHA256SUMS, so changed source plus recomputed checksums still fails. Dirty/untracked files, private project settings, the live manifest, Code.gs and recovery handlers are excluded. Unknown/missing entries, duplicate ZIP names, symlinks and oversized files are rejected without extracting archives or accessing Google.

See CONSOLE-BANK-RELEASE.md for build and verification commands. Existing outputs are preserved, and the prepared artifact remains compatible with the existing bound-project preparation helper. A synthetic integration test exercises the packaged helper and verifies that it preserves unrelated cloud-source fixtures and manifest/binding values. No real cloud source was read or uploaded. Verification: 127 Node tests, eight worker fixtures, 13 release fixtures and 24 offline Chromium scenarios pass (172 total). Packaging does not verify live intake, banking, publication or deployment.

## Payment review queue — 22 October 2026

The manual Družina payment preview now prioritizes the complete reconciliation plan before returning at most 100 rows: candidates for manual review, discrepancies, unmatched transfers and debits/zero amounts. Counters cover the full dataset, and source order remains stable within each group. Russian explanations distinguish matches from confirmed payments. Surrounding whitespace no longer bypasses closed-status protection. Strict signed decimal parsing rejects hexadecimal/exponent text, sub-cent values and unsafe or lossy cent conversions instead of producing false candidates; ordinary number/comma-decimal inputs remain supported.

The report retains its own server completion time and observed bank checkpoint across automatic snapshot refreshes. Fio's existing explicit-offset timestamp is accepted with strict calendar/time validation; invalid or future markers stay unavailable. Crossing the two-hour freshness threshold does not discard an otherwise valid report. The UI validates read-only/Družina/zero-settlement flags, amounts, statuses, queue totals and row priority before any replacement. Malformed, failed, timed-out and late responses leave the previous report intact. Legacy modules clear unavailable queue/time metadata, and the mobile table scrolls horizontally without expanding the page.

Verification: 149 Node tests, eight worker fixtures, 13 release fixtures and 28 offline Chromium scenarios pass (198 total). Added coverage includes candidates beyond row 100, full versus visible counts, every server classification, status normalization, strict money parsing and safe numeric round trips, real preview owner/schema checks, existing offset bank markers, invalid response preservation, manual/automatic separation, late callbacks and inert source text on mobile. No live Google or bank calls were made. This remains a source-only update with no settlement, production financial-status write or Apps Script deployment.

## Release declaration checks — 23 October 2026

The local preparation helper now parses JavaScript global declarations rather than matching function names at the start of lines. It blocks indented/inline/async/generator/escaped duplicate handlers and conflicting global aliases or classes before creating the release directory. It ignores nested helpers, comments and strings, does not execute cloud source, and suppresses source excerpts on syntax errors. Sloppy-script block functions conservatively require conflict review. Runtime assignments and initialization still need source review.

The source package includes the pinned unmodified Acorn parser and its MIT licence (eleven files total), with no install or network requirement during preparation. These local support files are not uploaded. Old nine-file packages remain verifiable against their exact commits, while incomplete parser dependencies cannot silently use the legacy format. The manifest, binding and unrelated cloud files remain preserved. Verification: 190 Node tests, eight worker fixtures, 15 release fixtures and 28 offline Chromium scenarios pass (241 total). No Apps Script source or permissions were changed by this staging improvement.

## Correct target confirmed — 23 October 2026

Fresh Apps Script `projects.get` metadata identifies the earlier workspace/18 October target as a standalone script: it has no `parentId`. The separate target retained in the 19 October bound-project configuration has a spreadsheet parent matching its configured Hub ID. Drive metadata confirms that the current account owns that spreadsheet, can edit it and has no nonowner sharing permissions. Project IDs, credentials and private source remain outside this repository.

The standalone project currently has 16 files, including older console, payment, OSVČ and recovery code. The confirmed Hub-bound project has four files, including older console HTML/server, with no separate OSVČ, Družina or reconciliation module. Fresh console hashes in both projects differ from the tested repository source. The earlier successful upload therefore does not establish installation in the Hub-bound project.

The Hub-bound project has no API executable entry point. Source-read permission and owner-only spreadsheet access are confirmed; successful `operatorSnapshot` execution remains unverified. Remote function execution has separate deployment, OAuth and Cloud-project requirements documented in [Google's API execution guide](https://developers.google.com/apps-script/api/how-tos/execute). Verify the console through the owner session in its spreadsheet after the reviewed source update. The previous CLI permission error is not evidence that the owner lacks access to the Hub.

For the next installation, resolve the target from live project metadata and compare its parent with the Hub binding before preparing a fresh backup and additive release. The workspace root configuration points at the standalone project and must not be used as the bound-project selector. Preserve current cloud handlers and manifest. This investigation changed no cloud source, API configuration, sharing, triggers or financial records.

Verification baseline: commit `27c1cea` passed 198 Node tests, 23 Python fixtures and 28 offline Chromium scenarios (249 total). These source checks do not establish live console execution or banking. The source upload recorded below remains historical evidence for its then-selected standalone target.

## Recorded source upload — 2026-10-18 (target corrected 2026-10-23)
At 07:24 Europe/Prague, clasp push succeeded for 14 files in the then-selected project. Fresh clasp pull and SHA256 comparisons matched all 14 files. Added console server/HTML, OSVC reader, reconciliation preview and recovery; inserted one IMPERION Operations item in the existing Community Hub menu. Current cloud baseline (including recent Telegram/RevenuePipeline changes) preserved and backed up locally before patching. No new public web-app deployment, banking sync, recovery timer or settlement was invoked. Server filename is OperatorConsoleServer.gs because Apps Script rejects server and HTML files with the same basename. Tests after rename: 37 Node cases pass. CLI operatorSnapshot execution failed with a permission error; authenticated UI opening and runtime data integration remain NOT VERIFIED. Open the existing spreadsheet, reload, choose Community Hub > IMPERION · Operations as the owner. Do not confuse source upload with complete platform activation. Video scheduled task last observed 07:20:58 result0; 07:24 preview selected0/rendered0/published0.
