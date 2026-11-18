import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isVerifiedAcademyBankCredit,isVerifiedAcademyBooking} from '../supabase/functions/_shared/academy-confirmation.mjs';

const verified={
  booking_status:'CONFIRMED',
  payment_quote_status:'APPROVED',
  payment_evidence_status:'BANK_VERIFIED',
  quote_locked_at:'2026-11-13T13:00:00.000Z',
  quote_recipient:'Aliaksei Chareshneu OSVC',
  quote_account:'CZ00SYNTHETICNOTAREALACCOUNT',
  quoted_amount_czk:690,
  bank_verified_amount_czk:690,
  bank_verification_ref_hash:'a'.repeat(64),
  bank_verified_at:'2026-11-13T14:00:00.000Z',
  owner_calendar_checked_at:'2026-11-13T14:03:00.000Z',
  owner_calendar_check_note:'Owner checked Google, work, travel and prior clients',
  booking_confirmed_at:'2026-11-13T14:05:00.000Z',
  requested_duration_min:60,
  requested_session_at:'2026-11-15T18:00:00.000Z',
  confirmed_session_at:'2026-11-16T18:00:00.000Z',
  confirmed_session_end_at:'2026-11-16T19:00:00.000Z'
};

test('audited bank credit may be verified without a client screenshot',()=>{
  assert.equal(isVerifiedAcademyBankCredit(verified),true);
  assert.equal(verified.payment_proof_received_at,undefined);
});

for(const [name,patch] of [
  ['client screenshot alone',{payment_evidence_status:'PROOF_RECEIVED'}],
  ['no bank timestamp',{bank_verified_at:null}],
  ['no quote authorization',{payment_quote_status:'NOT_QUOTED'}],
  ['missing quote lock time',{quote_locked_at:null}],
  ['bank verification precedes quote',{bank_verified_at:'2026-11-13T12:59:00.000Z'}],
  ['incorrect bank amount',{bank_verified_amount_czk:600}],
  ['missing independently verified amount',{bank_verified_amount_czk:null}],
  ['missing bank transaction hash',{bank_verification_ref_hash:null}],
  ['invalid transaction hash',{bank_verification_ref_hash:'fake'}],
  ['wrong legal payee',{quote_recipient:''}],
  ['missing settlement account',{quote_account:''}]
]){
  test('bank must fail closed: '+name,()=>{
    assert.equal(isVerifiedAcademyBankCredit({...verified,...patch}),false);
    assert.equal(isVerifiedAcademyBooking({...verified,...patch}),false);
  });
}
test('owner-confirmed exact slot is recognized; preferred time is NOT booked',()=>{
  assert.equal(isVerifiedAcademyBooking(verified),true);
  assert.notEqual(verified.requested_session_at,verified.confirmed_session_at);
});
for(const [name,patch] of [
  ['client-only requested status',{booking_status:'REQUESTED'}],
  ['READY is not confirmed',{booking_status:'READY_TO_SCHEDULE'}],
  ['no confirmation timestamp',{booking_confirmed_at:null}],
  ['missing actual slot start',{confirmed_session_at:null}],
  ['missing actual slot end',{confirmed_session_end_at:null}],
  ['wrong session duration',{confirmed_session_end_at:'2026-11-16T18:15:00.000Z'}],
  ['invalid timezone',{confirmed_session_at:'invalid'}],
  ['confirmation before bank verification',{booking_confirmed_at:'2026-11-13T13:00:00.000Z'}],
  ['no owner calendar check',{owner_calendar_checked_at:null}],
  ['calendar check before bank verification',{owner_calendar_checked_at:'2026-11-13T13:59:00.000Z'}],
  ['calendar check after booking confirmation',{owner_calendar_checked_at:'2026-11-13T14:10:00.000Z'}],
  ['no calendar check scope',{owner_calendar_check_note:''}],
  ['unacceptably short calendar note',{owner_calendar_check_note:'google'}],
  ['start already in the past at confirmation',{confirmed_session_at:'2026-11-13T14:04:00.000Z',confirmed_session_end_at:'2026-11-13T15:04:00.000Z'}],
  ['zero duration',{requested_duration_min:0}],
  ['noninteger duration',{requested_duration_min:59.5}],
  ['overlong duration',{requested_duration_min:241}],
  ['cancellation must not be confirmed',{booking_status:'CANCELLED'}]
]){
  test('booking must fail closed: '+name,()=>{
    assert.equal(isVerifiedAcademyBooking({...verified,...patch}),false);
  });
}
test('SQL supports bank credit without screenshot and requires owner cross-calendar check',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261113_academy_confirmed_slot_integrity.sql',import.meta.url),'utf8');
 for(const fragment of [
   'ADD COLUMN IF NOT EXISTS confirmed_session_at timestamptz',
   'ADD COLUMN IF NOT EXISTS confirmed_session_end_at timestamptz',
   'ADD COLUMN IF NOT EXISTS owner_calendar_checked_at timestamptz',
   'ADD COLUMN IF NOT EXISTS bank_verified_amount_czk integer',
   'ADD COLUMN IF NOT EXISTS bank_verification_ref_hash text',
   'academy_bank_status_timestamp_pair_guard',
   'academy_confirmed_requires_bank_guard',
   'academy_confirmed_requires_calendar_guard',
   "payment_evidence_status = 'BANK_VERIFIED'",
   "payment_quote_status = 'APPROVED'",
   'academy_bank_verification_ref_unique_idx',
   "booking_status <> 'CONFIRMED'",
   'academy_no_overlapping_confirmed_sessions',
   'EXCLUDE USING gist',
   "tstzrange(confirmed_session_at,confirmed_session_end_at,'[)') WITH &&",
   "WHERE (booking_status = 'CONFIRMED')",
   'booking_confirmed_at >= bank_verified_at',
   'make_interval(mins => requested_duration_min)'
 ]) assert.ok(sql.includes(fragment),fragment);
 assert.doesNotMatch(sql,/\bINSERT INTO\b/i);
 assert.doesNotMatch(sql,/payment_proof_received_at\s+IS\s+NOT\s+NULL/i,
   'Bank verification must not require a customer screenshot');
});
