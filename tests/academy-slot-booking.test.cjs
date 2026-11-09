'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const page=fs.readFileSync('academy/book/index.html','utf8');
const js=fs.readFileSync('academy/book/booking.js','utf8');
const policy=fs.readFileSync('academy/book/privacy/index.html','utf8');
const sql=fs.readFileSync('supabase/migrations/20261109_academy_slot_bookings.sql','utf8');
const fn=fs.readFileSync('supabase/functions/imperion-academy-book/index.ts','utf8');
const academy=fs.readFileSync('academy/index.html','utf8');
test('client application parses and never embeds secrets or private booking data',()=>{
 assert.doesNotThrow(()=>new vm.Script(js));
 for(const forbidden of ['SUPABASE_SERVICE_ROLE_KEY','SERVICE_ROLE','7804336003','AIza','Bearer eyJ','private calendar event']) {
  assert.ok(!page.includes(forbidden),'public booking HTML leaked: '+forbidden);
  assert.ok(!js.includes(forbidden),'public booking JS leaked: '+forbidden);
 }
 assert.match(page,/connect-src 'self' https:\/\/cmrknyhnnehyjpreehcf\.supabase\.co/);
 assert.match(page,/href="privacy\//);
 assert.match(page,/type="file"[^>]+accept="application\/pdf,\.pdf" required/);
 assert.match(page,/id="day"/);
 assert.match(page,/id="slots"/);
 for(const lang of ['en','cs','ru','uk']){
  assert.ok(js.includes(lang+':{'), 'client translations: '+lang);
  assert.ok(policy.includes('id="'+lang+'"'),'private PDF policy language: '+lang);
 }
});
test('supported tutoring subjects, payer and guardian consent',()=>{
 for(const subject of ['CZECH','ENGLISH','GERMAN','MATHS','PHYSICS','CHEMISTRY','BIOLOGY','PROGRAMMING','OTHER'])
  assert.ok(page.includes('value="'+subject+'"'),'missing '+subject);
 for(const id of ['subject','service','day','slots','slot','name','email','goal','receipt','privacy','guardian','selectedSubject','requestId','result'])
  assert.ok(page.includes('id="'+id+'"'),'missing '+id);
 assert.match(page,/name="adultOrGuardian"/);
 assert.match(page,/name="privacy"/);
 assert.match(js,/new FormData\(booking\)/);
});
test('server not client owns prices, 48h urgency and private proofs',()=>{
 assert.match(sql,/v_base := case when v_slot\.service_code='LESSON' then 1000 else 250 end;/);
 assert.match(sql,/v_fee := case when now\(\)>v_slot\.starts_at-interval '48 hours'/);
 assert.match(sql,/ceil\(v_base\*0\.25\)::integer/);
 assert.match(sql,/payment_status/);
 assert.match(fn,/imperion_academy_claim_slot/);
 assert.match(fn,/PROOF_UPLOADED_UNVERIFIED|payment_verified:false/);
 assert.match(fn,/private_upload_failed/);
 assert.match(fn,/imperion-academy-payment-proofs/);
 assert.match(fn,/new Uint8Array\(await pdf\.arrayBuffer\(\)\)/);
 assert.match(fn,/pdf\.type!=="application\/pdf"/);
 assert.match(fn,/firstFive\.join\(","\)!=="37,80,68,70,45"/);
 assert.match(fn,/finally\s*\{/);
 assert.match(fn,/\.remove\(\[path\]\)/);
 assert.match(js,/clockOffset=Date\.parse\(data\.server_now\)-Date\.now\(\)/);
 assert.match(js,/selected\?\.service_code\|\|service\.value/);
 assert.match(js,/\bMath\.ceil\(base\*latePct\/100\)/);
});
test('calendar has no default open slots, no overlapping slots, no double claims',()=>{
 assert.match(sql,/is_open boolean not null default false/);
 assert.match(sql,/owner_approved_at timestamptz/);
 assert.match(sql,/academy_published_slot_no_overlap/);
 assert.match(sql,/for update/);
 assert.match(sql,/imperion_academy_one_live_booking_per_slot/);
 assert.match(sql,/status in \('PENDING_BANK_CHECK','PAYMENT_VERIFIED','BOOKING_CONFIRMED'\)/);
 assert.match(sql,/revoke all on public\.imperion_academy_slots from anon, authenticated/);
 assert.match(sql,/revoke all on function public\.imperion_academy_claim_slot/);
 assert.match(fn,/\.not\("owner_approved_at","is",null\)/);
 assert.match(fn,/\.eq\("is_open",true\)/);
 assert.match(fn,/\.in\("status",ACTIVE\)/);
 assert.match(fn,/\.in\("slot_id",slots\.map\(s=>s\.id\)\)/);
});
test('booking is unconfirmed until bank readback, duplicate protected',()=>{
 assert.match(sql,/'PENDING_BANK_CHECK'/);
 assert.match(sql,/'PROOF_UPLOADED_UNVERIFIED'/);
 assert.match(fn,/payment_verified:false,booking_confirmed:false/);
 assert.match(fn,/imperion_rsvp_allow_request/);
 assert.match(fn,/idempotency/);
 assert.match(fn,/if\(origin!==ORIGIN\)/);
 assert.ok(!fn.includes('payment_verified:true'));
 assert.ok(!fn.includes('booking_confirmed:true'));
 assert.ok(!fn.includes('createEvent'));
});
test('existing Academy CTA routes to new form in draft and old agreements protected',()=>{
 assert.match(academy,/id="navBookBtn"[^>]*href="book\//);
 assert.match(academy,/data-i18n="academy\.ctaRegister" href="book\//);
 assert.ok(!academy.includes('Urgent requests (under 48h): +50%'));
 assert.match(academy,/New individual Academy bookings: payments credited less than 48h/);
 assert.match(academy,/existing agreements remain unchanged/);
 assert.ok(!academy.includes('690 Kč'),'retired new-lead base-rate copy remains');
});
test('SQL avoids doubled slash in PostgreSQL regex literals',()=>{
 assert.ok(sql.includes('[.]pdf')&&sql.includes('[^[:space:]@]+[.]'),'expected literal-dot regex');
 assert.ok(!sql.includes('\\\\.'),'double escaped dot remains');
});
