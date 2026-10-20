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
3. Inspect diff: only the console server and bank/reconciliation modules should change. Retain the source pull as the backup. Stop if other work conflicts.
4. Push from NEW_RELEASE_DIR, then pull again into another new directory and compare every source hash.
5. Owner opens the console. Verify module availability and worksheet schemas before manual bank reading. Configure secrets privately only if actually absent; never put them in source, chat or test logs.
6. Run one manual read for each configured entity. Verify the intended account response, append deduplication, checkpoints and read-only reconciliation. No automatic timer until this passes.

Important: bank module installation is not bank configuration, receipt of money or a verified payment. Existing bank worksheet schemas must match exactly; this package must fail rather than migrate financial records implicitly. The complete platform remains unfinished.
