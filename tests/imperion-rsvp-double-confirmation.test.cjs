'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

const pages=[
 'register/index.html',
 'register/en/index.html',
 'register/ru/index.html',
 'register/uk/index.html'
];

for (const page of pages){
 test('RSVP and age are explicit, not silently selected: '+page,()=>{
  const html=fs.readFileSync(path.join(root,page),'utf8');
  assert.match(html,/<input type="radio" name="rsvp" value="YES" required>/);
  assert.match(html,/<input type="radio" name="age" value="adult" required>/);
  assert.doesNotMatch(html,/<input type="radio" name="rsvp" value="YES" required checked>/);
  assert.doesNotMatch(html,/<input type="radio" name="age" value="adult" required checked>/);
  assert.match(html,/if\(!form\.checkValidity\(\)\)\{form\.reportValidity\(\);return;\}/);
 });
 test('Free HEMA receipt displays distinct attendance-reply and place-approval instructions: '+page,()=>{
  const html=fs.readFileSync(path.join(root,page),'utf8');
  assert.match(html,/function requiresFreeHemaReply\(e\)/);
  assert.match(html,/requiresFreeHemaReply\(eventData\)&&body\.rsvp==='YES'/);
  assert.match(html,/RSVP_REPLY_NEXT\[lang\]/);
 });
}

test('Transactional receipt requests one reply only for eligible free HEMA events',()=>{
 const s=fs.readFileSync(path.join(root,'imperion-intake-sync.gs'),'utf8');
 const start=s.indexOf('function impRsvpReceiptCopy_(');
 const end=s.indexOf('function impReceiptMessage_(',start);
 assert.ok(start>=0&&end>start,'isolated receipt copy');
 const ctx=require('node:vm').createContext({});
 require('node:vm').runInContext(s.slice(start,end),ctx,{timeout:1000});
 for(const locale of ['cs','en','ru','uk']){
  const ask=ctx.impRsvpReceiptCopy_(locale,'REGISTERED',true);
  const passive=ctx.impRsvpReceiptCopy_(locale,'REGISTERED',false);
  assert.ok(ask.next!==passive.next,'specialized text for '+locale);
  assert.ok(ask.next.length>60,'substantive localized instructions for '+locale);
  assert.equal(ctx.impRsvpReceiptCopy_(locale,'MAYBE',true).next,
   ctx.impRsvpReceiptCopy_(locale,'MAYBE',false).next);
 }
 assert.match(s,/receiptEvent\.price_verified===true/);
 assert.match(s,/Number\(receiptEvent\.price_czk\)===0/);
 assert.match(s,/impRsvpReceiptCopy_\(lang,v\('RSVP_Status'\),requireAttendanceReply\)/);
});

test('Unformatted Google Sheets serial dates never trigger 1970 premature privacy cleanup',()=>{
 const gs=fs.readFileSync(path.join(root,'imperion-intake-sync.gs'),'utf8');
 const start=gs.indexOf('function impRetentionDate_(');
 const end=gs.indexOf('function imperionCleanupPrivateIntake(',start);
 assert.ok(start>=0&&end>start,'isolated retention parser');
 const vm=require('node:vm');
 const ctx=vm.createContext({Utilities:{formatDate:(d,tz,pattern)=>{
  assert.equal(tz,'Europe/Prague');
  assert.equal(pattern,'Z');
  return '+0100';
 }}});
 vm.runInContext(gs.slice(start,end),ctx,{timeout:1000});
 const asIso=expr=>vm.runInContext(expr,ctx,{timeout:1000});
 assert.equal(asIso('impRetentionDate_(46430.60416666667,"Europe/Prague").toISOString()'),
  '2027-02-12T13:30:00.000Z');
 assert.equal(asIso('impRetentionDate_("46430,60416666667","Europe/Prague").toISOString()'),
  '2027-02-12T13:30:00.000Z');
 assert.equal(asIso('impRetentionDate_(new Date("2027-02-12T13:30:00.000Z"),"Europe/Prague").toISOString()'),
  '2027-02-12T13:30:00.000Z');
 assert.equal(asIso('impRetentionDate_(0,"Europe/Prague")'),null);
 assert.equal(asIso('impRetentionDate_("not-a-date","Europe/Prague")'),null);
 assert.match(gs,/if\(!date\|\|date>now\)return;/);
});
