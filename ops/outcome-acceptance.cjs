'use strict';
/** Evidence-to-autonomy gate. Execution proof is not a business outcome. */
function reviewOperatorResult(job, result) {
  if (!result || result.ok !== true) return { allowed: false, reason: 'EXECUTOR_NOT_OK' };
  if (job.command === 'operator.selftest') {
    return { allowed: true, source: 'SYNTHETIC_SELFTEST', businessOutcome: 'NOT_APPLICABLE', independentlyVerified: false };
  }
  if (job.command !== 'event.verify') return { allowed: false, reason: 'UNREVIEWED_COMMAND_TYPE' };
  const e = result.evidence;
  if (!e || typeof e !== 'object' || Array.isArray(e)) return { allowed: false, reason: 'SOURCE_READBACK_MISSING' };
  const target = String(job.subject_id || job.subjectId || '').trim();
  const id = String(e.eventId || '').trim(), status = String(e.status || '').trim();
  if (!target || !id || target !== id) return { allowed: false, reason: 'SOURCE_EVENT_ID_MISMATCH' };
  if (!status || status.length > 80) return { allowed: false, reason: 'SOURCE_EVENT_STATUS_MISSING' };
  if (typeof job.payload?.expected === 'string' && job.payload.expected.trim() && status !== job.payload.expected.trim()) {
    return { allowed: false, reason: 'SOURCE_EVENT_STATUS_MISMATCH' };
  }
  return { allowed: true, source: 'EVENT_ROW_READBACK', businessOutcome: 'UNVERIFIED', independentlyVerified: false };
}
function markBrowserStep(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result) || !Object.keys(result).length) {
    return { allowed: false, reason: 'BROWSER_STEP_RESULT_INVALID' };
  }
  return { allowed: true, value: { ...result, _outcomeGate: { state: 'UI_STEP_ONLY', businessOutcome: 'UNVERIFIED', independentlyVerified: false } } };
}
module.exports = { reviewOperatorResult, markBrowserStep };
