'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

const NOW=Date.parse('2026-10-25T11:00:00Z');
function load(){
 const s={
  Date,String,Number,Object,JSON,Error,isFinite,
  Utilities:{formatDate:(date,zone)=>new Intl.DateTimeFormat('en-CA',{
   timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'
  }).format(date)}
 };
 vm.createContext(s);
 vm.runInContext(fs.readFileSync(__dirname+'/../OperatorConsoleServer.gs','utf8'),s);
 return s;
}
const plain=value=>JSON.parse(JSON.stringify(value));
const lead=(id,date,extra={})=>({Lead_ID:id,Service:'Corporate',Stage:'New',Action_Status:'OPEN',Next_Action_At:date,...extra});
const defaultMissing=()=>({Leads:false,SocialPublishing:false,Events:false});
function choose(s,leadRows=[],socialRows=[],eventRows=[],missing=defaultMissing()){
 const leads=s.ocLeadSummary_(leadRows,NOW);
 const social=s.ocSocialQueue_(socialRows).rows;
 const events=s.ocEventQueue_(eventRows,NOW).rows;
 return plain(s.ocNextAction_(leads,social,events,missing));
}

test('missing canonical source blocks a false all-clear',()=>{
 const n=choose(load(),[lead('A','2026-10-24')],[],[],{Leads:false,SocialPublishing:true,Events:false});
 assert.deepEqual(n,{mode:'READ_ONLY',kind:'SOURCE',ref:'SocialPublishing',reason:'MISSING_CANONICAL_SHEET',executed:false,approved:false});
});

test('unsafe active event date outranks sales outreach',()=>{
 const n=choose(load(),[lead('A','2026-10-24')],[],[{Event_ID:'EV1',Status:'ACTIVE',Start_DateTime:'not-a-date',End_DateTime:'2026-10-26T12:00:00Z'}]);
 assert.equal(n.kind,'EVENT');
 assert.equal(n.ref,'EV1');
 assert.equal(n.reason,'INVALID_ACTIVE_EVENT_TIME');
});

test('old, synthetic, waiting, closed and won leads are excluded before picking a client',()=>{
 const n=choose(load(),[
  lead('TEST-ONLY-NO-CONTACT','2026-10-01',{Notes:'SYNTHETIC'}),
  lead('WAIT','2026-10-01',{Action_Status:'WAITING FOR REPLY'}),
  lead('DONE','2026-10-01',{Stage:'Won'}),
  lead('PAUSED','2026-10-01',{Action_Status:'HOLD'}),
  lead('REAL','2026-10-24')
 ]);
 assert.equal(n.kind,'LEAD');
 assert.equal(n.ref,'REAL');
 assert.equal(n.reason,'OVERDUE');
 assert.equal(n.executed,false);
});

test('today client beats publication review; future contact is not selected',()=>{
 const s=load();
 assert.equal(choose(s,[lead('TODAY','2026-10-25')],[{Job_ID:'PUB',Status:'FAILED'}]).kind,'LEAD');
 const n=choose(s,[lead('FUTURE','2026-12-25')],[{Job_ID:'PUB',Status:'PUBLISHED',Post_URL:'https://example.org'}]);
 assert.equal(n.kind,'POST');
 assert.equal(n.ref,'PUB');
 assert.equal(n.reason,'VERIFY_PROVIDER_RECEIPT');
});

test('unknown due date only prompts CRM repair; no emails are sent',()=>{
 const n=choose(load(),[lead('MISSING','')]);
 assert.equal(n.kind,'LEAD_DATE');
 assert.equal(n.reason,'NO_DATE');
 assert.equal(n.approved,false);
});

test('no due work never creates a fake completed action',()=>{
 const n=choose(load(),[lead('FUTURE','2026-12-25')],[]);
 assert.deepEqual(n,{mode:'READ_ONLY',kind:'NONE',ref:'',reason:'NO_IMMEDIATE_SAFE_ACTION',executed:false,approved:false});
});

test('provider claim PUBLISHED still requires provider verification',()=>{
 const n=choose(load(),[],[{Job_ID:'PUB2',Status:'PUBLISHED',Post_URL:'https://example.org'}]);
 assert.equal(n.kind,'POST');
 assert.equal(n.reason,'VERIFY_PROVIDER_RECEIPT');
});

test('function does not require Gmail, payments, network or mutable Apps Script services',()=>{
 const s=load();
 const n=choose(s,[lead('R','2026-10-24')]);
 assert.equal(n.mode,'READ_ONLY');
 assert.equal(n.executed,false);
 assert.equal(n.approved,false);
});
