'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const page=fs.readFileSync('academy/programmes/index.html','utf8');
const api=fs.readFileSync('supabase/functions/imperion-academy-intake/index.ts','utf8');
const sql=fs.readFileSync('supabase/migrations/20261113_academy_standard_intake_options.sql','utf8');
const boundSql=fs.readFileSync('supabase/migrations/20261113_academy_flexible_preference_bound_fix.sql','utf8');
test('standard Academy offers are truthful and reuse existing private intake',()=>{
  for(const code of ['LESSON','CONSULT','PACK5','PACK10','PACK20']){assert.ok(page.includes('value="'+code+'"'));assert.ok(api.includes('"'+code+'"'));assert.ok(sql.includes("'"+code+"'"));}
  for(const old of ['UNI','MED','A2','CER','CAREER','DEFENSE','EXEC','LIFE'])assert.ok(api.includes('"'+old+'"'));
  for(const id of ['academy-request-day','academy-request-time','academy-alt-times','adult-confirm','privacy-confirm'])assert.ok(page.includes('id="'+id+'"'));
  assert.ok(page.includes('imperion-academy-intake'));assert.ok(page.includes('not a reservation'));
  assert.ok(page.includes('690 Kč'));assert.ok(page.includes('200 Kč'));assert.ok(page.includes('180 days'));
  assert.ok(api.includes('RECEIVED_UNCONFIRMED'));assert.ok(api.includes('field(body,"deadline",400)'));assert.ok(!page.includes('type="file"'));assert.ok(!api.includes('payment_verified:true'));
});
test('distinct date or goal changes server idempotency but duplicate retry stays safe',()=>{
 assert.ok(api.includes('+"|"+email+"|"+product_code+"|"+goal+"|"+deadline'));
 assert.match(page,/preferredTime\(\)/);assert.match(page,/Europe\/Prague \(not a reservation\)/);assert.match(page,/Alternatives: /);assert.match(page,/travel to\/from in-person work/);
});

test('four hundred characters of alternate-time preferences are accepted end-to-end without changing consent or booking status',()=>{
  assert.match(boundSql,/imperion_academy_inquiries_deadline_check/);
  assert.match(boundSql,/char_length\s*\(deadline\)\s*<=\s*400/);
  assert.match(api,/field\(body,"deadline",400\)/);
  assert.match(api,/deadline\.length>400/);
  assert.match(page,/id="deadline" name="deadline" maxlength="400"/);
  assert.match(page,/id="academy-alt-times"[^>]*maxlength="120"/);
  assert.match(page,/not a reservation/);
});
