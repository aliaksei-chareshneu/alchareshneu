const {test}=require('node:test');
const assert=require('node:assert/strict');
const {reviewOperatorResult,markBrowserStep}=require('../ops/outcome-acceptance.cjs');
const job={command:'event.verify',subject_id:'EV-2026-11',payload:{expected:'ACTIVE'}};
const good={ok:true,evidence:{eventId:'EV-2026-11',status:'ACTIVE',title:'Synthetic record'}};

test('real event readback passes execution but leaves business outcome UNVERIFIED',()=>{
 const x=reviewOperatorResult(job,good);
 assert.equal(x.allowed,true);assert.equal(x.source,'EVENT_ROW_READBACK');
 assert.equal(x.businessOutcome,'UNVERIFIED');assert.equal(x.independentlyVerified,false);
});
test('missing event evidence fails closed',()=>assert.equal(reviewOperatorResult(job,{ok:true}).reason,'SOURCE_READBACK_MISSING'));
test('empty event evidence fails closed',()=>assert.equal(reviewOperatorResult(job,{ok:true,evidence:{}}).reason,'SOURCE_EVENT_ID_MISMATCH'));
test('wrong event id fails closed',()=>assert.equal(reviewOperatorResult(job,{ok:true,evidence:{...good.evidence,eventId:'OTHER'}}).reason,'SOURCE_EVENT_ID_MISMATCH'));
test('missing status fails closed',()=>assert.equal(reviewOperatorResult(job,{ok:true,evidence:{eventId:job.subject_id}}).reason,'SOURCE_EVENT_STATUS_MISSING'));
test('expected status mismatch fails closed',()=>assert.equal(reviewOperatorResult(job,{ok:true,evidence:{...good.evidence,status:'DRAFT'}}).reason,'SOURCE_EVENT_STATUS_MISMATCH'));
test('future publishing commands cannot claim done from ok alone',()=>assert.equal(reviewOperatorResult({...job,command:'event.publish'},good).reason,'UNREVIEWED_COMMAND_TYPE'));
test('executor failure cannot pass',()=>assert.equal(reviewOperatorResult(job,{ok:false,evidence:good.evidence}).reason,'EXECUTOR_NOT_OK'));
test('selftest remains non-business proof',()=>{
 const x=reviewOperatorResult({command:'operator.selftest'},{ok:true});
 assert.equal(x.allowed,true);assert.equal(x.businessOutcome,'NOT_APPLICABLE');
});
test('browser step cannot become verified business result by itself',()=>{
 const x=markBrowserStep({url:'https://example.com',title:'test'});
 assert.equal(x.allowed,true);assert.equal(x.value.url,'https://example.com');
 assert.equal(x.value._outcomeGate.businessOutcome,'UNVERIFIED');
});
test('empty browser success fails closed',()=>assert.equal(markBrowserStep({}).allowed,false));
test('browser array fails closed',()=>assert.equal(markBrowserStep([]).allowed,false));
