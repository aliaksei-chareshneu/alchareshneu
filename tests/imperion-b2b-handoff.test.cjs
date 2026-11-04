'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {crm}=require('./helpers/b2b-runtime.cjs');
const record=i=>({id:'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),created_at:'2026-11-03T00:00:00Z',
 retention_until:'2027-05-02T00:00:00Z',company:'Synthetic',contact_name:'Synthetic Contact',email:'nobody@example.invalid',
 offer:'DATA_PILOT',source:'qa',summary:'Synthetic report only',budget_band:'unknown'});
const cfg={email:'owner@example.invalid',sheetId:'synthetic'};
test('handoff recovers an interrupted marker without duplicating its queued UUID',()=>{
 const c=crm(),r=record(1);c.api.impWriteB2B_(c.ss,[r]);c.faults({marker:true});
 assert.throws(()=>c.api.impRecoverB2BOwnerDigest_(c.ss),/marker outage/);
 assert.equal(c.api.impPendingDigest_().b2b,1);c.faults({});
 c.api.impRecoverB2BOwnerDigest_(c.ss);assert.equal(c.api.impPendingDigest_().b2b,1);
 c.api.impFlushOwnerDigest_(cfg,c.ss,{});c.api.impRecoverB2BOwnerDigest_(c.ss);
 assert.equal(c.mailbox.length,1);assert.equal(c.kv.size,0);
 assert.ok(c.mailbox[0][2].includes(r.id));
});
test('more than one digest of B2B rows retains every recoverable UUID',()=>{
 const c=crm(),records=Array.from({length:15},(_,i)=>record(i+1));
 c.api.impWriteB2B_(c.ss,records);c.api.impRecoverB2BOwnerDigest_(c.ss);
 assert.equal(c.api.impPendingDigest_().b2b,12);
 // Generic RSVP detail must not evict already queued B2B UUIDs.
 c.api.impQueueOwnerDigest_(1,0,0,c.ss);assert.equal(c.api.impPendingDigest_().items.length,12);
 c.api.impFlushOwnerDigest_(cfg,c.ss,{});c.api.impRecoverB2BOwnerDigest_(c.ss);
 assert.equal(c.api.impPendingDigest_().b2b,3);c.api.impFlushOwnerDigest_(cfg,c.ss,{});
 c.api.impRecoverB2BOwnerDigest_(c.ss);assert.equal(c.kv.size,0);
 const text=c.mailbox.map(m=>m[2]).join('\n');
 for(const r of records)assert.equal(text.split(r.id).length-1,1);
 assert.equal(c.rows().length,15);
});
test('missing owner next-action column blocks B2B import instead of silently dropping it',()=>{
 const c=crm();c.grid[0][c.HEADERS.indexOf('Next_Action_At')]='Legacy_Column';
 assert.throws(()=>c.api.impWriteB2B_(c.ss,[record(1)]),/Missing Leads header: Next_Action_At/);
 assert.equal(c.rows().length,0);
});
test('untrusted source status cannot promote a lead to contracted or paid',()=>{
 const c=crm();c.api.impWriteB2B_(c.ss,[{...record(1),status:'PAID',paid_czk:99999}]);
 assert.equal(c.rows()[0].Stage,'New');assert.equal(c.rows()[0].Paid_CZK,'0');
});
