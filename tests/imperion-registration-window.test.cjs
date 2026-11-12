'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('supabase/functions/imperion-register/index.ts','utf8').replace(/\r\n/g,'\n');

// Execute only the self-contained production date gate after dropping TypeScript
// annotations; never invoke Deno.serve, secrets, PII storage or provider writes.
const match=source.match(/const REGISTRATION_CLOSES_AT = Object\.freeze\(\{[\s\S]*?\}\);\nfunction registrationStillOpen\([\s\S]*?\n}\n/);
assert.ok(match,'real registration window guard must exist');
const executable=match[0]
  .replace('eventId: string','eventId')
  .replace('atMs: number =','atMs =')
  .replace('): boolean',')')
  .replace('eventId as keyof typeof REGISTRATION_CLOSES_AT','eventId');
const stillOpen=vm.runInNewContext(executable+'\nregistrationStillOpen;',{}, {timeout:1000});

test('Orel accepts preliminary RSVP until event starts at 12:00 CET on 14 Nov',()=>{
  assert.equal(stillOpen('PUB-OREL-20261114',Date.parse('2026-11-01T23:00:00Z')),true);
  assert.equal(stillOpen('PUB-OREL-20261114',Date.parse('2026-11-14T10:59:59Z')),true);
  assert.equal(stillOpen('PUB-OREL-20261114',Date.parse('2026-11-14T11:00:00Z')),false);
  assert.equal(stillOpen('PUB-OREL-20261114',Date.parse('2026-11-14T12:00:00Z')),false);
});
test('unrelated event is never auto-closed by Orel deadline',()=>{
  assert.equal(stillOpen('PUB-HIKE-20261128',Date.parse('2026-11-29T00:00:00Z')),true);
  assert.equal(stillOpen('PUB-WALK-TALK-20261111',Date.parse('2026-11-02T00:00:00Z')),true);
});
test('public GET catalog hides closed event independent of stale is_open field',()=>{
  assert.match(source,/events:\(data\|\|\[\]\)\.filter\(e=>registrationStillOpen\(e\.event_id\)\)/);
});
test('direct POST refuses registration before database query and before insert',()=>{
  const first=source.indexOf('if (!registrationStillOpen(v.eventId))');
  const second=source.indexOf('if (!registrationStillOpen(v.eventId))',first+1);
  const query=source.indexOf("const {data:event,error:eventError}=await api.from('imperion_rsvp_events')");
  const insert=source.indexOf("await api.from('imperion_rsvp_submissions').insert");
  assert.ok(first>0 && first<query && second>query && second<insert,
    'deadline must guard direct POST regardless of stale database is_open');
  assert.match(source.slice(second,insert),/event_not_available/);
});
