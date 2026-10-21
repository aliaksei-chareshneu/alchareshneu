# Console bank integration — 20 October 2026

Status: code prepared and fixture-tested; NOT uploaded to Apps Script. The owner's remote device was offline during preparation. No tokens inspected or transferred; no bank requests, payments, schedules or public posts executed.

The verified spreadsheet-bound project is distinct from the standalone automation project. Do not push standalone project files wholesale into the bound project. Existing Form handlers and recovery triggers remain in their current project pending an owner-authorized live trigger audit.

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

Successful Operations tests runs now publish an `imperion-console-sources-<commit>` artifact containing the console, its server, both bank adapters, reconciliation preview, preparation helper and this guide. `SOURCE_COMMIT` records the checked-out source revision; `SHA256SUMS` verifies all included files with `sha256sum -c SHA256SUMS`. This is an additive source package, not a ready-to-push Apps Script project: it deliberately omits `.clasp.json`, the live manifest, Code.gs, recovery handlers and private configuration. Extract it and run the included preparation helper against a fresh pull of the confirmed bound project as described above. No TinyFish session is needed to download or prepare this package; an existing authorized Google deployment connection is still required to install it.

Both bank adapters now use the same resolved Hub binding as the console's owner check, including projects configured through RP without the legacy SPREADSHEET_ID global. They check owner-only access again after the external bank response, reject future/impossible sync markers, and preserve an unknown balance when its stored value is whitespace. The draft worker enforces its 1–3 job limit on direct function calls as well as CLI calls.

Current local verification: 81 Node tests, eight Python worker fixtures and eight offline Chromium scenarios pass. Complete synthetic adapter flows exercise both entities, immediate polling limits, repeated imports without duplicate rows, failed append/retry/checkpoints, RP-only binding and sharing changes during a request. Console tests also cover automatic reads, disabling them, hidden-page pauses, error recovery and bank requests still pending after a timeout. These results do not establish installation or live bank access.

## Automatic console reads — 21 October 2026

After the first successful snapshot, the open console reads existing Hub data once per minute. The checkbox above the tabs' content turns automatic reads off for that dialog; manual Refresh remains available. Reads pause while the page is hidden, another request is running or a bank request is still pending, including after a timeout followed by manual Refresh. Errors stop automatic reads until a successful manual Refresh. Returning to a visible page schedules at most one overdue read, without replaying missed intervals.

Automatic reads call only `operatorSnapshot`. They do not fetch bank statements, reconcile or settle payments, publish content, recover leads or install server triggers. Bank imports remain explicit button actions. This source update still requires the reviewed bound-project installation above.
