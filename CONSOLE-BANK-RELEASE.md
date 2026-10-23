# Console bank integration — 20 October 2026

Status: code prepared and fixture-tested; NOT uploaded to Apps Script. The owner's remote device was offline during preparation. No tokens inspected or transferred; no bank requests, payments, schedules or public posts executed.

Live metadata checked on 23 October confirms that the spreadsheet-bound project is distinct from the standalone automation project. The workspace root configuration selects the standalone project; resolve the intended bound target from `projects.get` and require its `parentId` to match the configured Hub before preparing a release. Do not push standalone project files wholesale into the bound project. Existing Form handlers and recovery triggers remain in their current project pending an owner-authorized live trigger audit.

Included changes:
- FioDruzinaConsole.gs: owner-only read-only bank import into the existing Druzina_Fio_Transactions worksheet. Requires separate FIO_DRUZINA_READ_TOKEN, FIO_DRUZINA_EXPECTED_ACCOUNT_ID and FIO_DRUZINA_ENTITY_CONFIRMED=true in that project's Script Properties. Rejects reuse of the OSVC token/account. Matching is separate; imports remain unmatched. No timer installer.
- FioOSVC.gs: reject unsafe integer amounts and preserve unknown/blank bank balance.
- PaymentReconciliation.gs: reject missing/duplicate required headers even when a worksheet is empty; no payment settlement.
- OperatorConsoleServer.gs: retain headers for reconciliation validation.
- prepare-console-bank-release.cjs: create a separate upload directory from a fresh clasp pull of the explicitly confirmed bound project, preserving manifest and unrelated source. Stop on duplicate Apps Script names or functions. No push or execution.

Release procedure:
1. Reconnect the authorized device; freshly pull the bound project into a new folder.
2. Run all tests in this PR. Run `node prepare-console-bank-release.cjs FRESH_PULL_DIR NEW_RELEASE_DIR CONFIRMED_BOUND_SCRIPT_ID`.
3. Inspect diff: only the console HTML/server and bank/reconciliation modules should change. Retain the source pull as the backup. Stop if other work conflicts.
4. Push from NEW_RELEASE_DIR, then pull again into another new directory and compare every source hash.
5. Owner opens the console. Verify module availability and worksheet schemas before manual bank reading. Configure secrets privately only if actually absent; never put them in source, chat or test logs.
6. Run one manual read for each configured entity. Verify the intended account response, append deduplication, checkpoints and read-only reconciliation. No automatic bank-import timer until this passes.

Important: bank module installation is not bank configuration, receipt of money or a verified payment. Existing bank worksheet schemas must match exactly; this package must fail rather than migrate financial records implicitly. The complete platform remains unfinished.

## Source package and integration fixes — 21 October 2026

Successful Operations tests runs now publish an `imperion-console-sources-<commit>` artifact containing the console, its server, both bank adapters, reconciliation preview, preparation helper, its bundled JavaScript parser and licence, and this guide. `SOURCE_COMMIT` records the checked-out source revision; `SHA256SUMS` verifies all included files with `sha256sum -c SHA256SUMS`. This is an additive source package, not a ready-to-push Apps Script project: it deliberately omits `.clasp.json`, the live manifest, Code.gs, recovery handlers and private configuration. Extract it and run the included preparation helper against a fresh pull of the confirmed bound project as described above. No TinyFish session is needed to download or prepare this package; an existing authorized Google deployment connection is still required to install it.

Both bank adapters now use the same resolved Hub binding as the console's owner check, including projects configured through RP without the legacy SPREADSHEET_ID global. They check owner-only access again after the external bank response, reject future/impossible sync markers, and preserve an unknown balance when its stored value is whitespace. The draft worker enforces its 1–3 job limit on direct function calls as well as CLI calls.

Verification baseline (`27c1cea`): 198 Node tests, eight Python worker fixtures, 15 Python release fixtures and 28 offline Chromium scenarios pass (249 total). Complete synthetic adapter flows exercise both entities, immediate polling limits, repeated imports without duplicate rows, failed append/retry/checkpoints, RP-only binding and sharing changes during a request. Console tests also cover automatic reads, error recovery, pending bank requests, lead priorities, publication monitoring, the event agenda and recovery diagnostics below. These results do not establish installation or live bank access.

## One local and CI source builder — 21 October 2026

`package_console_release.py` builds the same eleven-file package used by Operations tests. Historical commits retain their original nine-file format. Run it from a repository checkout containing the expected commit. The commit must be its full lowercase SHA, obtained from the reviewed PR or successful run, rather than an abbreviated SHA or branch name:

```sh
python package_console_release.py build --commit FULL_COMMIT_SHA --output-dir NEW_PACKAGE_DIR --zip NEW_PACKAGE.zip
python package_console_release.py verify --commit FULL_COMMIT_SHA NEW_PACKAGE.zip
```

The optional ZIP has fixed entry order, timestamps and permissions and stores bytes without compression, so repeated builds of the same commit produce identical ZIP bytes. GitHub's uploaded artifact can use its own ZIP metadata; verification accepts either that ZIP or the extracted package directory. Replace the ZIP argument to `verify` with the directory path to check an extracted download. Both the repository checkout and the expected commit must be available locally for this stronger check; it makes no network requests. `sha256sum -c SHA256SUMS` remains available for standalone integrity checks, but does not independently establish that files match the expected commit.

The builder reads only the nine approved source blobs from Git, then generates SOURCE_COMMIT and SHA256SUMS. Older commits without the parser dependency use the original seven-source allowlist; partial or missing parser dependencies are rejected. Dirty edits, untracked files, private settings, recovery handlers and the live manifest are excluded. Missing or symlinked source files and invalid commits fail before output creation. Existing output destinations are rejected. The verifier compares every byte against the selected commit, including regenerated checksums, and rejects extra/missing entries, duplicate ZIP names, symlinks and oversized files. It reads ZIP entries without extraction. Recomputing a tampered package's checksums does not make it pass this comparison.

Operations tests now build and independently read back this package before uploading it, using the exact checked-out commit. Artifact naming and the preparation-helper interface remain compatible. Current packages have eleven files; historical commits retain their exact nine-file allowlist. The builder itself lives in the repository, not in the upload package. Its result records `uploaded: false`; preparing or verifying this source package does not install Apps Script or authorize a live bank read. The reviewed bound-project release procedure above remains necessary. A fixture also runs the packaged preparation helper against a synthetic bound-project pull and verifies preservation of its manifest, binding and unrelated source.

## Automatic console reads — 21 October 2026

After the first successful snapshot, the open console reads existing Hub data once per minute. The checkbox above the tabs' content turns automatic reads off for that dialog; manual Refresh remains available. Reads pause while the page is hidden, another request is running or a bank request is still pending, including after a timeout followed by manual Refresh. Errors stop automatic reads until a successful manual Refresh. Returning to a visible page schedules at most one overdue read, without replaying missed intervals.

Automatic reads call only `operatorSnapshot`. They do not fetch bank statements, reconcile or settle payments, publish content, recover leads or install server triggers. Bank imports remain explicit button actions. This source update still requires the reviewed bound-project installation above.

## Lead deadline queue — 21 October 2026

The Leads tab now sorts all eligible rows before selecting the first 40. Overdue work comes first, followed by today's deadlines, invalid dates, missing dates and future deadlines. Counters include the entire eligible queue, and the console says how many rows are shown with a link to the existing CRM for the full list. Empty rows and synthetic records are excluded; the existing closed/held/dormant/waiting action states and Won/Lost stages are excluded regardless of case or surrounding whitespace.

Deadlines use Europe/Prague. `YYYY-MM-DD` means the entire local day; timestamps require an explicit `Z` or UTC offset, while native spreadsheet Date cells use the existing ISO conversion. Impossible dates, timezone-free text timestamps and unsupported formats are shown for review rather than assigned guessed deadlines. Each snapshot recalculates priorities without changing CRM cells, contacting leads or creating triggers.

The snapshot rejects missing or duplicate required Leads columns instead of treating a broken schema as missing task dates. No schema migration is performed. The client validates queue totals and displayed rows before replacing the previous snapshot; an absent sheet or older server module is explicitly labeled unavailable rather than shown as a verified zero-task queue.

## Publication monitoring — 21 October 2026

The Publications tab now prioritizes records requiring attention, then pending work, drafts, inactive jobs and stored confirmations. The server classifies the full existing SocialPublishing sheet before returning at most 100 rows. Counters cover all nonempty records; a truncation notice links to the existing Hub queue. No publisher is called, no retry is scheduled and no status is written.

Confirmation means a stored `PUBLISHED_VERIFIED` status, a valid absolute HTTPS receipt and no conflicting error. A provider ID, scheduled/queued status, legacy publication status or missing receipt does not qualify. Receipt links reject embedded credentials, malformed hosts and common token/signature parameters; links open with `noopener noreferrer`. These checks do not fetch a receipt or revalidate publication with a provider.

Raw provider errors are no longer included in the server response. Fixed diagnostic categories explain service limits, errors, manual action, unknown statuses and unverified results. The known `QUEUED_ONLY` note remains pending, while a stored error alongside confirmation requires review. Inspect details privately in the existing Hub before retrying. Explicitly zoned schedule timestamps display in Prague time; other values remain as recorded in Hub, without guessed timezone conversion.

Required publication columns must appear exactly once. The client validates counters, rows and receipt links before replacing its previous snapshot. Missing sheets and older modules show unavailable diagnostics; legacy rows still cannot create unsafe links or confirmations from conflicting errors. The mobile table keeps the result first and scrolls horizontally within the page. All new fixtures are synthetic; this revision still requires reviewed installation in the bound Apps Script project.

## Event agenda — 21 October 2026

The Events tab now classifies the existing Active rows at the snapshot time in Europe/Prague. Current scheduled intervals come first, followed by starts later today, future events, dates requiring review and past intervals. Within those groups it shows intervals ending soon, upcoming starts in chronological order and the most recent past intervals first. Counters cover the full active dataset; at most 100 rows are returned with a truncation notice and the existing Hub link. Passing an interval's end does not prove that an event took place.

Native spreadsheet Date cells and explicitly zoned ISO timestamps are supported. Existing local `YYYY-MM-DD HH:mm` or `YYYY-MM-DD HH:mm:ss` text, with a space or `T`, is parsed explicitly in Prague time. Round-trip validation rejects impossible dates and nonexistent clock hours; repeated clock hours require review unless an explicit offset disambiguates them. Missing times, date-only values and an end not later than the start receive review reasons. Start is inclusive and end is exclusive. Timezone-free lead deadlines remain strict and are not relaxed by this event-specific support.

Required event columns must occur exactly once. Client validation checks totals, interval order and phase at the snapshot time before updating the panel. Missing sheets and older modules are labeled unavailable, and legacy display is also bounded to 100 rows. The table scrolls horizontally on mobile. Only the owner console reads and displays these records; this update changes no events, bookings, calendar entries, reminder jobs, messages, prices or public routes.

Verification uses synthetic dates and bounded local-time parser fixtures, with real Node/Chromium Prague timezone formatting. It does not establish execution of Utilities.parseDate in the live bound project. Install and verify this revision through the reviewed procedure above.

## Recovery diagnostics and manual report — 21 October 2026

The System tab now shows a structured read-only report from the existing recovery preview: responses checked in its configured window, unique responses missing from CRM, matching Form submit triggers visible to the current owner in this project, and the separate recovery batch limit. The console adds a server completion timestamp and drops unknown module fields, IDs and raw errors. A zero trigger count or duplicates receive a review message; one matching trigger is not proof of working ingestion. This report does not audit other projects or all historical responses, restore leads or send notifications. It remains labeled with its own check time across snapshot refreshes and runs only when explicitly requested.

Automatic snapshots read selected settings and recorded timestamps only: recovery Hub/Form binding presence, configured window, last successful marker and last error marker. They do not open Forms, enumerate triggers, inspect response contents or run the preview. Missing configuration, missing run history, invalid/future timestamps and an error without a later successful marker remain distinct. Values are normalized to ISO instants for Prague display; invalid property text and IDs are omitted. A date-only recovery marker is shown for review without changing the existing recovery module's parsing behavior. Recorded markers do not establish timer health, recovered counts, new intake or notification delivery.

Optional diagnostics are validated before any snapshot replacement. Older server modules show unavailable diagnostics and clear stale marker text. Preview counts and explicit read-only flags are checked on the server and client; malformed, failed, timed-out or late responses preserve the last complete report. The existing explicit pause action now requires a PAUSED receipt, retains its confirmation time through the subsequent snapshot and explains that work already in progress may continue. No recovery, repair, timer or ingestion implementation was changed; recovery modules remain excluded from this additive source package. Install only through the reviewed procedure above.


## Payment review queue — 22 October 2026

The manual Družina reconciliation report now counts the complete existing payment/import plan before choosing up to 100 rows. Exact VS/amount candidates appear first, followed by records needing review, unmatched transfers and debits/zero amounts. Source order is retained within each group. Full category totals and a truncation notice distinguish the dataset from the visible rows. Each row has a fixed Russian explanation; a candidate still requires manual review and never confirms or settles payment.

Closed payment statuses remain protected with surrounding whitespace or mixed case. Amounts must be finite numbers or signed decimal text with at most two fractional digits; comma fractions remain supported. Hexadecimal/exponent text, sub-cent values, coercible objects, unsafe cent integers and amounts that lose cents in the numeric report are rejected. Invalid imported or expected values remain review records rather than candidates. Existing ambiguity and multiple-transfer protections stay in place.

The report has its own server completion timestamp and the bank checkpoint observed during that request, displayed in Prague time. Existing Fio offset timestamps and UTC timestamps are supported with calendar validation. Invalid or future checkpoints are not presented as valid loading times. At the two-hour boundary, freshness becomes unconfirmed without discarding the report. These markers describe stored import evidence, not a new bank request or verification of individual payments. Snapshot refreshes leave the complete manual report unchanged and do not repeat reconciliation. Older modules without queue/time metadata explicitly show these details as unavailable.

The client validates read-only mode, Družina entity, zero settlements, row values, priority order and complete/visible totals before updating the report. Invalid, failed, timed-out and late responses preserve its previous complete result. The table scrolls within the mobile page and treats source text as plain text. All checks use synthetic fixtures, including the actual preview path and bank checkpoint format. This source revision has not been installed in Apps Script and makes no settlement, financial-status, bank-request or schedule changes.


## Parse declarations before staging — 23 October 2026

The preparation helper now parses every retained and replacement script before writing an output directory. It rejects duplicate global function declarations regardless of indentation, same-line placement, async/generator syntax or escaped identifier spelling. Global variable, destructuring and class declarations also cannot silently replace a handler. Nested helper functions, named function expressions, comments and strings are excluded. Sloppy-script block functions are conservatively treated as possible global bindings; strict block-local functions remain local. Repeated `var` declarations remain legal when they do not collide with another declaration kind.

The check does not execute source files. Syntax failures identify only the filename, without printing private source text. This is a declaration check, not proof that dynamic assignments or initialization code are safe; retained cloud code still requires review. Manifest, binding and unrelated files remain byte-for-byte preserved, and existing destinations are never overwritten. A duplicate legacy bank handler must be reviewed in the existing project rather than bypassed or blindly removed.

`console-release-acorn.cjs` is the unmodified Acorn 8.15.0 `dist/acorn.js` distribution from `https://registry.npmjs.org/acorn/8.15.0`; the npm tarball's SHA-512 integrity was verified before vendoring. Its SHA-256 is `fdb08546776ec6228b03e8d02b40d4ab3255bae5f401adba7ff5dad927ac5c9c`. The complete upstream MIT licence is included as `console-release-acorn-LICENSE.txt`. Keep both beside the preparation helper. No npm install or network access is required to prepare a release. These two support files are part of the downloadable source package and are not copied into the Apps Script upload directory.

The verifier selects the exact allowlist from the requested commit, so previous nine-file archives still verify. A current helper referencing the parser cannot fall back to the old format when its dependency files are missing. This change only strengthens local staging; it does not upload or activate an Apps Script project.


## Bound-project target and execution readback — 23 October 2026

Fresh API metadata confirms that the earlier workspace/18 October installation target is standalone. The separate 19 October target is bound to the existing Hub: its spreadsheet parent matches the configured Hub, is owned by the current account and has no nonowner sharing permissions. The confirmed bound project still contains the older console and lacks the three bank/reconciliation add-ons in this package. The historical successful source upload must not be treated as evidence of a current bound-project installation. Full private identifiers and project source stay on the authorised device.

The bound project has no API executable entry point. Managing its source and running functions through `scripts.run` are separate capabilities; [Google documents the execution requirements](https://developers.google.com/apps-script/api/how-tos/execute). The owner console's spreadsheet menu remains the intended runtime verification route. Changing API deployment or Cloud configuration is a separate action, not a prerequisite for preparing the additive release. Preserve the original manifest and existing handlers while preparing the update, then independently verify source readback and the owner interface before claiming successful installation or bank access.

Windows-generated UTF-8 `.clasp.json` files may contain a leading byte-order mark. The preparation helper accepts that marker while retaining the exact script-ID/root-directory check and preserving the original configuration bytes. This compatibility fix changes no Google credentials, scopes or API execution permissions.
