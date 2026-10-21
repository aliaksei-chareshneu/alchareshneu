const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../OperatorConsoleServer.gs','utf8');
const NOW=Date.parse('2026-10-21T08:00:00Z');
function load(){
 const context={Date,Utilities:{formatDate:(date,zone,pattern)=>{
  assert.equal(zone,'Europe/Prague');assert.equal(pattern,'yyyy-MM-dd');
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  return ['year','month','day'].map(type=>parts.find(part=>part.type===type).value).join('-');
 }}};
 vm.createContext(context);vm.runInContext(source,context);return context;
}
const lead=(id,next,extra={})=>({Lead_ID:id,Stage:'New',Action_Status:'OPEN',Next_Action_At:next,...extra});
const plain=value=>JSON.parse(JSON.stringify(value));

test('overdue work beyond the first forty rows is selected before future work',()=>{
 const rows=Array.from({length:45},(_,i)=>lead('future-'+i,'2026-11-01'));
 rows.push(lead('urgent','2026-10-19'),lead('today','2026-10-21'));
 const before=structuredClone(rows),summary=load().ocLeadSummary_(rows,NOW);
 assert.deepEqual(plain(summary.needsAction.slice(0,2).map(r=>r.id)),['urgent','today']);
 assert.deepEqual(plain(summary.queue),{total:47,overdue:1,today:1,upcoming:45,noDate:0,invalidDate:0,shown:40,limit:40,truncated:true,timeZone:'Europe/Prague'});
 assert.equal(summary.needsAction.length,40);
 assert.deepEqual(rows,before);
 assert.equal(summary.cash,null);assert.equal(summary.contracted,null);assert.equal(summary.weighted30,null);
});

test('closed, waiting and synthetic records do not create tasks or hide real undated work',()=>{
 const rows=[lead('open',''),lead('won','2026-10-20',{Stage:' won '}),lead('lost','2026-10-20',{Stage:'lost'}),
  ...[' closed ','HOLD',' dormant ','waiting for reply'].map((status,i)=>lead('excluded-'+i,'2026-10-20',{Action_Status:status})),
  lead('fixture','2026-10-20',{Notes:'SYNTHETIC NO.CONTACT'}),{}, {Lead_ID:' ',Next_Action_At:null}];
 const summary=load().ocLeadSummary_(rows,NOW);
 assert.equal(summary.count,7);assert.equal(summary.excludedTests,1);
 assert.equal(summary.queue.total,1);assert.equal(summary.queue.noDate,1);
 assert.equal(summary.needsAction[0].id,'open');
 assert.equal(summary.needsAction[0].dueState,'NO_DATE');
});

test('date-only deadlines last for the entire Prague day including winter and summer midnight',()=>{
 const server=load();
 for(const [now,day] of [['2026-01-21T23:15:00Z','2026-01-22'],['2026-07-21T22:15:00Z','2026-07-22']]){
  const before=server.ocLeadSummary_([lead('whole-day',day)],Date.parse(now));
  assert.equal(before.needsAction[0].dueState,'TODAY');
  const after=server.ocLeadSummary_([lead('whole-day',day)],Date.parse(now)+86400000);
  assert.equal(after.needsAction[0].dueState,'OVERDUE');
 }
});

test('explicit timestamp deadlines use instants and Prague days rather than the UTC date',()=>{
 const summary=load().ocLeadSummary_([
  lead('elapsed','2026-10-21T09:59:59+02:00'),lead('exactly-now','2026-10-21T10:00:00+02:00'),
  lead('end-of-day','2026-10-21T21:59:59Z'),lead('next-day','2026-10-21T22:00:00Z'),
  lead('whole-day','2026-10-21')],NOW);
 const states=Object.fromEntries(summary.needsAction.map(r=>[r.id,r.dueState]));
 assert.deepEqual(states,{'elapsed':'OVERDUE','exactly-now':'TODAY','end-of-day':'TODAY','whole-day':'TODAY','next-day':'UPCOMING'});
 assert.deepEqual(plain(summary.needsAction.map(r=>r.id)),['elapsed','exactly-now','end-of-day','whole-day','next-day']);
});

test('repeated daylight-saving clock hours keep their chronological order',()=>{
 const summary=load().ocLeadSummary_([
  lead('later','2026-10-25T02:15:00+01:00'),lead('earlier','2026-10-25T02:45:00+02:00')],Date.parse('2026-10-25T00:00:00Z'));
 assert.deepEqual(plain(summary.needsAction.map(r=>r.id)),['earlier','later']);
 assert.equal(summary.queue.today,2);
});

test('impossible, ambiguous and numeric dates require review instead of invented deadlines',()=>{
 const invalid=['2026-02-30','2026-02-29T09:00:00Z','2026-10-21T24:00:00Z','2026-10-21T10:00',
  '21.10.2026','2026-10-21T10:00:60Z','2026-10-21T10:00+14:01','2026-10-21T10:00+02:60',45951,'not a date'];
 const summary=load().ocLeadSummary_(invalid.map((next,i)=>lead('review-'+i,next)),NOW);
 assert.equal(summary.queue.invalidDate,invalid.length);
 assert.equal(summary.queue.overdue,0);assert.equal(summary.queue.today,0);assert.equal(summary.queue.noDate,0);
 assert.ok(summary.needsAction.every(row=>row.dueState==='INVALID_DATE'));
 assert.deepEqual(plain(summary.needsAction.map(r=>r.next)),invalid.map(String));
 assert.equal(load().ocLeadSummary_([lead('leap','2024-02-29')],NOW).needsAction[0].dueState,'OVERDUE');
});

test('date and empty cells remain serializable and tied deadlines keep original row order',()=>{
 const summary=load().ocLeadSummary_([
  lead('same-first','2026-10-21T12:00Z'),lead('same-second',new Date('2026-10-21T12:00:00Z')),
  lead('invalid','bad'),lead('blank','  '),lead('null',null),lead('missing',undefined),lead('future','2027-01-01')],NOW);
 assert.deepEqual(plain(summary.needsAction.map(r=>r.id)),['same-first','same-second','invalid','blank','null','missing','future']);
 assert.equal(summary.needsAction[1].next,'2026-10-21T12:00:00.000Z');
 assert.equal(summary.queue.noDate,3);
 assert.ok(summary.needsAction.filter(r=>r.dueState==='NO_DATE').every(r=>r.next===''));
});

test('each snapshot evaluation moves a task from today to overdue without mutating CRM data',()=>{
 const server=load(),rows=[lead('task','2026-10-21T10:00:00Z')];
 assert.equal(server.ocLeadSummary_(rows,NOW).queue.today,1);
 assert.equal(server.ocLeadSummary_(rows,Date.parse('2026-10-21T10:00:01Z')).queue.overdue,1);
 assert.equal(rows[0].Action_Status,'OPEN');assert.equal(rows[0].Next_Action_At,'2026-10-21T10:00:00Z');
});

test('missing or duplicate required lead headers stop the snapshot before other sheet reads',()=>{
 const headers=['Lead_ID','Full_Name','Subject_Goal','Notes','Stage','Next_Action_At','Action_Status','Service'];
 for(const invalid of [headers.filter(h=>h!=='Next_Action_At'),[...headers,'Action_Status']]){
  const server=load(),reads=[];
  server.ocOwner_=()=>{};server.ocId_=()=>'fixture';
  server.SpreadsheetApp={openById:()=>({})};server.PropertiesService={getScriptProperties:()=>({})};
  server.ocRows_=(_ss,name)=>{reads.push(name);return {missing:false,headers:invalid,rows:[]};};
  assert.throws(()=>server.operatorSnapshot(),/Leads schema/);
  assert.deepEqual(reads,['Leads']);
 }
});

test('snapshot reads sheet Date cells through the existing adapter and returns only queue display fields',()=>{
 const server=load(),headers=['Lead_ID','Full_Name','Subject_Goal','Notes','Stage','Next_Action_At','Action_Status','Service'];
 const data=[headers,['earlier','Fixture person','Fixture goal','','New',new Date('2000-01-01T10:00:00Z'),'OPEN','Fixture service'],
  ['later','Fixture person','Fixture goal','','New',new Date('2099-01-01T10:00:00Z'),'OPEN','Fixture service']];
 const original=structuredClone(data);
 server.ocOwner_=()=>{};server.ocId_=()=>'fixture';
 server.PropertiesService={getScriptProperties:()=>({getProperty:()=>null})};
 server.SpreadsheetApp={openById:()=>({getUrl:()=> 'https://docs.google.com/spreadsheets/d/fixture/edit',
  getSheetByName:name=>name==='Leads'?{getLastRow:()=>data.length,getDataRange:()=>({getValues:()=>data.map(row=>[...row])}),getSheetId:()=>1}:null})};
 const result=server.operatorSnapshot();
 assert.equal(result.leads.queue.overdue,1);assert.equal(result.leads.queue.upcoming,1);
 assert.equal(result.leads.needsAction[0].next,'2000-01-01T10:00:00.000Z');
 assert.deepEqual(plain(Object.keys(result.leads.needsAction[0])).sort(),['dueState','id','next','service','stage','status']);
 assert.ok(!result.missing.includes('Leads'));
 assert.deepEqual(data,original);
});
