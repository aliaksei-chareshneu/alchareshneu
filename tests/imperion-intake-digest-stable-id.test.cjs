'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','imperion-intake-sync.gs'),'utf8');
const context={console};
vm.createContext(context);
vm.runInContext(src,context);
const b2b='OSVC-B2B-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const academy='OSVC-ACADEMY-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function ss(ids){
  const sheet={
    getLastRow:()=>ids.length+1,
    getLastColumn:()=>1,
    getRange:(row,col,amount)=>({
      getDisplayValues:()=>row===1?[['Submission_ID']]:
        ids.slice(row-2,row-2+amount).map(x=>[x])
    })
  };
  return {getSheetByName:name=>name==='Leads'?sheet:null};
}
test('stale B2B row pointer resolves by verified submission ID',()=>{
 const v=context.impVerifiedDigestPointers_(ss(['outbound','another',b2b]),
   [{kind:'B2B',row:2,submissionId:b2b,service:'IT/Science'}]);
 assert.equal(v.length,1);
 assert.equal(v[0].row,4);
});
test('outgoing job applications do not become inbound enquiries',()=>{
 const v=context.impVerifiedDigestPointers_(ss(['LEAD-IMP-JOB']),
   [{kind:'B2B',row:2,submissionId:'LEAD-IMP-JOB'}]);
 assert.equal(v.length,0);
 assert.equal(context.impVerifiedDigestPointers_(ss(['job']),[{kind:'B2B',row:2}]).length,0);
});
test('B2B and Academy identifiers are never interchangeable',()=>{
 const v=context.impVerifiedDigestPointers_(ss([academy,b2b]),
  [{kind:'B2B',row:2,submissionId:academy},
   {kind:'ACADEMY',row:99,submissionId:academy}]);
 assert.equal(v.length,1);assert.equal(v[0].kind,'ACADEMY');assert.equal(v[0].row,2);
});
test('duplicate IDs fail closed and unrelated digest entries survive',()=>{
 const v=context.impVerifiedDigestPointers_(ss([b2b,b2b]),
  [{kind:'RSVP',row:7},{kind:'B2B',row:2,submissionId:b2b}]);
 assert.equal(v.length,1);assert.equal(v[0].kind,'RSVP');
 const m=context.impVerifiedDigestPointers_(null,[{kind:'B2B',row:3,submissionId:b2b}]);
 assert.equal(m.length,0);
});
test('email shows unverifiable sync state, not confirmed website leads',()=>{
 assert.match(src,/B2B import bez ověřeného leadu/);
 assert.match(src,/prokazatelné aktuální řádky/);
 assert.match(src,/impVerifiedDigestPointers_\(ss,Array\.isArray\(pending\.items\)/);
});
