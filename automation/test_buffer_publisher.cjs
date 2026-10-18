// Isolated synthetic QA. No real social, Buffer or Google requests.
const test=require('node:test'),assert=require('node:assert/strict');
global.Utilities={
 parseDate(s){return new Date(s.replace(' ','T')+'+02:00');},
 formatDate(d){
  const local=new Date(d.getTime()+2*3600000);
  return local.toISOString().slice(0,16).replace('T',' ');
 }
};
const m=require('./src/BufferPublisher.js');
const entity='Družina Moravy z.s.';
const channelKey='facebook_page|'+entity;
const routes={[channelKey]:{id:'CHANNEL-TEST',entity,service:'facebook'}};
const future='2026-10-22 12:00',now=Date.parse('2026-10-18T12:00:00Z');
function make(overrides={}){
 return Object.assign({
  Job_ID:'PILOT-1',Event_ID:'CAMPAIGN-GIRLS21',Channel:'facebook_page',Status:'BUFFER_APPROVED',
  Duplicate_Checked:'YES',Rights_OK:'YES',Approved_At:'2026-10-18 11:00',
  Visibility:'public',Made_For_Kids:'NO',Post_ID:'',Post_URL:'',Attempted_At:'',
  Caption:'Beginner club taster. Read safety details.',Media_URL:'',Video_Drive_ID:'',
  Grant_Funded:'NO',Grant_Text:'',Entity:entity,Scheduled_At:future
 },overrides);
}
const decide=(p,other=[],ev={},route=routes)=>m.p80BufferGuard_(p,[p,...other],ev,route,now);
test('approved evergreen no previous delivery passes',()=>{assert.equal(decide(make()).allowed,true);});
test('draft, pending and no approval fail',()=>{
 for(const overrides of [{Status:'DRAFT'},{Status:'SCHEDULED_PENDING'},{Approved_At:''},{Made_For_Kids:''},{Rights_OK:''},{Duplicate_Checked:''},{Visibility:'private'}]){
  assert.equal(decide(make(overrides)).allowed,false);
 }
});
test('ambiguous same-channel same-event prevents Buffer replay',()=>{
 const p=make();
 assert(decide(p,[make({Job_ID:'OLDCALL',Status:'DELIVERY_UNVERIFIED'})]).reasons.includes('PRIOR_OR_PENDING_PROVIDER_DELIVERY'));
 assert(decide(p,[make({Job_ID:'OLDMETRICOOL',Status:'SCHEDULED_PENDING'})]).reasons.includes('PRIOR_OR_PENDING_PROVIDER_DELIVERY'));
 assert(decide(p,[make({Job_ID:'OLDERR',Status:'ERROR_LIMIT'})]).reasons.includes('PRIOR_OR_PENDING_PROVIDER_DELIVERY'));
});
test('existing provider id or attempt fences',()=>{
 assert(decide(make({Post_ID:'buffer_abc'})).reasons.includes('HAS_PROVIDER_PROOF'));
 assert(decide(make({Attempted_At:'2026-10-18'})).reasons.includes('ALREADY_ATTEMPTED'));
});
test('image requirement and channel mapping',()=>{
 const e='instagram|'+entity,map={[e]:{id:'IG-CHANNEL',entity,service:'instagram'}};
 assert(decide(make({Channel:'instagram'}),[],{},map).reasons.includes('INSTAGRAM_NEEDS_IMAGE'));
 assert(decide(make({Channel:'instagram',Media_URL:'https://example.com/photo.png'}),[],{},map).reasons.includes('INSTAGRAM_REQUIRES_JPEG'));
 assert.equal(decide(make({Channel:'instagram',Media_URL:'https://example.com/photo.jpg'}),[],{},map).allowed,true);
 assert(decide(make(),[],{},{}).reasons.includes('TARGET_NOT_MAPPED'));
});
test('grant credit mandatory and complete',()=>{
 const p=make({Grant_Funded:'YES',Grant_Text:'Podpořeno z programu Grant ABC'});
 assert(decide(p).reasons.includes('GRANT_CREDIT_MISSING'));
 assert.equal(decide(make({Grant_Funded:'YES',Grant_Text:'Podpořeno z programu Grant ABC',Caption:'Hello. Podpořeno z programu Grant ABC'})).allowed,true);
});
test('valid real free event but not paid, inactive or past',()=>{
 const p=make({Event_ID:'VUT20261021'});
 const e={Event_ID:'VUT20261021',Status:'Active',Price_CZK:'0',Start_DateTime:'2026-10-24 12:00'};
 assert.equal(decide(p,[],{VUT20261021:e}).allowed,true);
 assert(decide(p,[],{VUT20261021:{...e,Price_CZK:'120'}}).reasons.includes('PAID_ACTIVITY_REQUIRES_SEPARATE_REVIEW'));
 assert(decide(p,[],{VUT20261021:{...e,Status:'Cancelled'}}).reasons.includes('SOURCE_INACTIVE'));
 assert(decide(p,[],{VUT20261021:{...e,Start_DateTime:'2026-10-17 12:00'}}).reasons.includes('SOURCE_EVENT_PASSED'));
});
test('scheduling window and DST ambiguity blocked',()=>{
 assert(decide(make({Scheduled_At:'2026-10-18 14:05'})).reasons.includes('TIME_NOT_IN_SAFE_WINDOW'));
 assert(decide(make({Scheduled_At:'2026-12-10 14:05'})).reasons.includes('TIME_NOT_IN_SAFE_WINDOW'));
 assert(Number.isNaN(m.p80BufferParseTime_('2026-10-25 02:30')));
 assert(Number.isNaN(m.p80BufferParseTime_('2026-03-29 02:30')));
});
test('GraphQL custom scheduling correct, no second CRM',()=>{
 const p=make({Caption:'⚔️ Future\nText "quoted"',Media_URL:'https://example.com/photo.jpg'});
 const d=decide(p);
 assert.equal(d.allowed,true);
 const q=m.p80BufferGraphql_(p,d);
 assert.match(q,/customScheduled/);assert.match(q,/dueAt: "2026-10-22T10:00:00.000Z"/);
 assert.match(q,/channelId: "CHANNEL-TEST"/);assert.match(q,/assets: \[\{image:/);
 assert.match(q,/Future\\nText/);
});
test('kill switch disabled and missing key return before any outbound',()=>{
 global.PropertiesService={getScriptProperties(){return{getProperty(k){return k==='P80_BUFFER_ENABLED'?'false':''}}}};
 assert.deepEqual(m.p80BufferTick(),{enabled:false,queued:0,reason:'DISABLED'});
 global.PropertiesService={getScriptProperties(){return{getProperty(k){return k==='P80_BUFFER_ENABLED'?'true':''}}}};
 assert.equal(m.p80BufferTick().reason,'API_KEY_NOT_CONFIGURED');
});
