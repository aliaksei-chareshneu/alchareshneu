import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isVerifiedAcademyBooking } from '../supabase/functions/_shared/academy-confirmation.mjs';

const verified = {
  booking_status:'CONFIRMED',
  payment_evidence_status:'BANK_VERIFIED',
  bank_verified_at:'2026-11-13T14:00:00.000Z',
  booking_confirmed_at:'2026-11-13T14:05:00.000Z',
  requested_duration_min:60,
  requested_session_at:'2026-11-15T18:00:00.000Z',
  confirmed_session_at:'2026-11-16T18:00:00.000Z',
  confirmed_session_end_at:'2026-11-16T19:00:00.000Z'
};

test('owner-confirmed 60min slot is recognized; client preference is not promoted',()=>{
  assert.equal(isVerifiedAcademyBooking(verified),true);
  assert.notEqual(verified.requested_session_at,verified.confirmed_session_at);
});
for(const [name,patch] of [
  ['client screenshot alone is not bank verification',{payment_evidence_status:'PROOF_RECEIVED'}],
  ['no bank timestamp',{bank_verified_at:null}],
  ['client-only requested status',{booking_status:'REQUESTED'}],
  ['READY is not CONFIRMED',{booking_status:'READY_TO_SCHEDULE'}],
  ['no owner confirmation timestamp',{booking_confirmed_at:null}],
  ['missing actual slot start',{confirmed_session_at:null}],
  ['missing actual slot end',{confirmed_session_end_at:null}],
  ['wrong session duration',{confirmed_session_end_at:'2026-11-16T18:15:00.000Z'}],
  ['invalid timezone value',{confirmed_session_at:'invalid'}],
  ['confirmation before bank verification',{booking_confirmed_at:'2026-11-13T13:00:00.000Z'}],
  ['zero duration',{requested_duration_min:0}],
  ['noninteger duration',{requested_duration_min:59.5}],
  ['overlong duration',{requested_duration_min:241}],
  ['cancellation must not be confirmed',{booking_status:'CANCELLED'}]
]){
  test('fail closed: '+name,()=>assert.equal(isVerifiedAcademyBooking({...verified,...patch}),false));
}
test('SQL enforces real exact slot, bank status and GiST overlap on CONFIRMED',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261113_academy_confirmed_slot_integrity.sql',import.meta.url),'utf8');
 for(const fragment of [
   'ADD COLUMN IF NOT EXISTS confirmed_session_at timestamptz',
   'ADD COLUMN IF NOT EXISTS confirmed_session_end_at timestamptz',
   'academy_confirmed_requires_bank_guard',
   "payment_evidence_status = 'BANK_VERIFIED'",
   "booking_status <> 'CONFIRMED'",
   'academy_no_overlapping_confirmed_sessions',
   'EXCLUDE USING gist',
   "tstzrange(confirmed_session_at,confirmed_session_end_at,'[)') WITH &&",
   "WHERE (booking_status = 'CONFIRMED')",
   'booking_confirmed_at >= bank_verified_at',
   'make_interval(mins => requested_duration_min)'
 ]) assert.ok(sql.includes(fragment),fragment);
 assert.doesNotMatch(sql,/\bINSERT INTO\b/i);
});
