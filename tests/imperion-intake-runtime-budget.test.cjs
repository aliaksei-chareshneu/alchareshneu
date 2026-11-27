'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('imperion-intake-sync.gs','utf8');
function harness({locked=false,slow=false,writeError=false}={}){
  let now=0; const calls=[],acks=[],items=Array.from({length:40},(_,i)=>({id:String(i)}));
  const s={Date:{now:()=>now},console:{log(){},warn(){}},LockService:{getScriptLock:()=>({tryLock:()=>!locked,releaseLock:()=>calls.push('release')})},
    SpreadsheetApp:{openById:()=>({getSheetByName:n=>n})}};
  vm.createContext(s);vm.runInContext(source,s);
  Object.assign(s,{
    impPrivateConfig_:()=>({sheetId:'synthetic'}),
    impStartupReadWithRetry_:fn=>fn(),
    impAgent4CrmPull_:()=>{calls.push('agent4');if(slow)now=211000;return {status:'OK'}},
    impEnsureReceiptCols_:()=>{},
    impReceiptCatalog_:()=>({}),
    impPrivateFetch_:(_,payload)=>{if(payload){calls.push('ack');acks.push(payload);return {ok:true};}
      calls.push('pull');return {protocol:'imperion-intake-bridge-v1',rsvps:items,enquiries:items,b2b:items,academy:items};},
    impQueueOwnerDigest_:()=>calls.push('digest'),
    impFlushOwnerDigest_:()=>calls.push('flush'),
    impSendProofReviewAlerts_:()=>({sent:0}),
    impSendReceiptQueue_:()=>({sent:0,failed:0}),
    impSendAttendedFollowups_:()=>({sent:0}),
    impSendApprovedChatInvites_:()=>({sent:0})
  });
  for(const name of ['impWriteRsvps_','impWriteEnquiries_','impWriteB2B_','impWriteAcademy_'])
    s[name]=(_,rows)=>{calls.push(name);if(writeError)throw Error('write failed');return {ids:rows.map(r=>r.id),added:rows.length}};
  return {run:()=>s.imperionSyncPrivateIntake(),calls,acks};
}
test('lock contention defers without writes or releasing unowned lock',()=>{
  const h=harness({locked:true});
  assert.equal(h.run().status,'LOCK_BUSY_DEFERRED');assert.equal(h.calls.length,0);
});
test('one bounded batch, 5 records per type, ACK only written IDs after digest',()=>{
  const h=harness(),r=h.run();
  assert.equal(r.status,'PARTIAL_DEFERRED');assert.equal(r.acked,20);assert.equal(h.acks.length,1);
  for(const k of ['rsvps','enquiries','b2b','academy'])assert.equal(h.acks[0][k].length,5);
  assert.ok(h.calls.indexOf('digest')<h.calls.indexOf('ack'));assert.equal(h.calls.at(-1),'release');
});
test('slow early phase defers remaining work without ACK or sends',()=>{
  const h=harness({slow:true}),r=h.run();
  assert.equal(r.status,'PARTIAL_DEFERRED');assert.equal(r.acked,0);assert.equal(h.acks.length,0);
  assert.deepEqual(h.calls,['agent4','release']);
});
test('failed write does not ACK and releases lock',()=>{
  const h=harness({writeError:true});assert.throws(()=>h.run(),/write failed/);
  assert.equal(h.acks.length,0);assert.equal(h.calls.at(-1),'release');
});
test('canonical source parses and existing trigger is unchanged',()=>{
  assert.doesNotThrow(()=>new vm.Script(source));assert.match(source,/everyMinutes\(5\)/);
});
