/**
 * Side-effect-free, public-safe state guard: only an independently approved
 * exact timespan plus documented bank status may be described as CONFIRMED.
 * This helper never checks a bank, calendar, or merchant account itself.
 */
export function isVerifiedAcademyBooking(row) {
  if (!row || row.booking_status !== 'CONFIRMED' ||
      row.payment_evidence_status !== 'BANK_VERIFIED' ||
      !row.bank_verified_at || !row.booking_confirmed_at ||
      !row.confirmed_session_at || !row.confirmed_session_end_at) return false;
  const bankAt = Date.parse(String(row.bank_verified_at));
  const confirmedAt = Date.parse(String(row.booking_confirmed_at));
  const starts = Date.parse(String(row.confirmed_session_at));
  const ends = Date.parse(String(row.confirmed_session_end_at));
  const minutes = Number(row.requested_duration_min);
  return [bankAt, confirmedAt, starts, ends].every(Number.isFinite) &&
    confirmedAt >= bankAt &&
    Number.isInteger(minutes) && minutes >= 10 && minutes <= 240 &&
    ends > starts && ends - starts === minutes * 60000;
}
