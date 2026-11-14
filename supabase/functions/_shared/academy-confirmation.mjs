/**
 * Fail-closed status predicates used exclusively by the private Academy checkout.
 * These do not call a bank, create calendar events or trust submitted receipts.
 * A privileged owner must independently check bank credit and every conflict.
 */
export function isVerifiedAcademyBankCredit(row) {
  if (!row || row.payment_evidence_status !== 'BANK_VERIFIED' ||
      row.payment_quote_status !== 'APPROVED') return false;
  const lockedAt = Date.parse(String(row.quote_locked_at || ''));
  const bankAt = Date.parse(String(row.bank_verified_at || ''));
  const quoted = Number(row.quoted_amount_czk);
  const cleared = Number(row.bank_verified_amount_czk);
  const digest = String(row.bank_verification_ref_hash || '');
  const payee = String(row.quote_recipient || '').trim();
  const account = String(row.quote_account || '').trim();
  return [lockedAt, bankAt].every(Number.isFinite) && bankAt >= lockedAt &&
    Number.isInteger(quoted) && quoted > 0 && quoted < 10000000 &&
    Number.isInteger(cleared) && cleared === quoted &&
    /^[0-9a-f]{64}$/.test(digest) &&
    payee.length >= 3 && account.length >= 8;
}

export function isVerifiedAcademyBooking(row) {
  if (!isVerifiedAcademyBankCredit(row) ||
      row.booking_status !== 'CONFIRMED' ||
      !row.booking_confirmed_at ||
      !row.confirmed_session_at || !row.confirmed_session_end_at) return false;
  const bankAt = Date.parse(String(row.bank_verified_at));
  const calendarAt = Date.parse(String(row.owner_calendar_checked_at || ''));
  const confirmedAt = Date.parse(String(row.booking_confirmed_at));
  const starts = Date.parse(String(row.confirmed_session_at));
  const ends = Date.parse(String(row.confirmed_session_end_at));
  const minutes = Number(row.requested_duration_min);
  const checkNote = String(row.owner_calendar_check_note || '').trim();
  return [bankAt, calendarAt, confirmedAt, starts, ends].every(Number.isFinite) &&
    calendarAt >= bankAt && confirmedAt >= calendarAt && starts > confirmedAt &&
    checkNote.length >= 15 && checkNote.length <= 500 &&
    Number.isInteger(minutes) && minutes >= 10 && minutes <= 240 &&
    ends > starts && ends - starts === minutes * 60000;
}
