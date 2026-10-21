const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const server=fs.readFileSync(__dirname+'/../OperatorConsoleServer.gs','utf8');
const client=fs.readFileSync(__dirname+'/../OperatorConsole.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("\ndocument.querySelectorAll('[data-tab]')")[0];
const NOW=Date.parse('2026-10-21T08:00:00Z');
const localFixtures={
 '2026-10-21 10:00':'2026-10-21T08:00:00Z','2026-10-21 11:00':'2026-10-21T09:00:00Z',
 '2026-10-21 10:00:30':'2026-10-21T08:00:30Z','2026-10-21 11:00:30':'2026-10-21T09:00:30Z',
 '2026-01-22 00:30':'2026-01-21T23:30:00Z','2026-01-22 01:30':'2026-01-22T00:30:00Z',
 '2026-07-22 00:30':'2026-07-21T22:30:00Z','2026-07-22 01:30':'2026-07-21T23:30:00Z',
 // Simulate a lenient parse of the nonexistent hour and either choice of the repeated hour.
 '2026-03-29 02:30':'2026-03-29T01:30:00Z','2026-03-29 04:00':'2026-03-29T02:00:00Z',
 '2026-10-25 02:30':'2026-10-25T01:30:00Z','2026-10-25 04:00':'2026-10-25T03:00:00Z'
};
function load(){
 const s={Date,URL,Utilities:{formatDate:(date,zone,pattern)=>{
  assert.equal(zone,'Europe/Prague');
  assert.ok(['yyyy-MM-dd','yyyy-MM-dd HH:mm','yyyy-MM-dd HH:mm:ss'].includes(pattern));
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const value=type=>parts.find(part=>part.type===type).value;
  return ['year','month','day'].map(value).join('-')+(pattern.length>10?' '+['hour','minute',...(pattern.endsWith(':ss')?['second']:[])].map(value).join(':'):'');
 },parseDate:(text,zone,pattern)=>{
  assert.equal(zone,'Europe/Prague');assert.equal(pattern,text.length===16?'yyyy-MM-dd HH:mm':'yyyy-MM-dd HH:mm:ss');
  if(!localFixtures[text])throw Error('Outside the bounded local-time fixture');
  return new Date(localFixtures[text]);
 }}};
 vm.createContext(s);vm.runInContext(server,s);vm.runInContext(client,s);return s;
}
const event=(id,start,end,extra={})=>({Event_ID:id,Title:'Fixture '+id,Community:'Fixture community',Status:'Active',Start_DateTime:start,End_DateTime:end,...extra});
const plain=value=>JSON.parse(JSON.stringify(value));
const payload=result=>({at:new Date(NOW).toISOString(),leads:{count:0,excludedTests:0,needsAction:[]},banks:{osvc:{balance:null,configured:false,lastSuccess:''},druzina:{balance:0,configured:true,lastSuccess:''}},social:[],events:result.rows,eventQueue:result.queue,missing:[]});

test('agenda sorts active events by schedule phase and reports the full eligible queue',()=>{
 const rows=[event('past','2026-10-20T08:00Z','2026-10-20T09:00Z'),event('future','2026-10-22T08:00Z','2026-10-22T09:00Z'),
  event('review','2026-10-21T09:00Z',''),event('today','2026-10-21T09:00Z','2026-10-21T10:00Z'),
  event('live','2026-10-21T07:00Z','2026-10-21T09:00Z',{Status:' active '}),event('cancelled','','',{Status:'Cancelled'}),{}];
 const s=load(),original=structuredClone(rows),result=s.ocEventQueue_(rows,NOW);
 assert.deepEqual(plain(result.rows.map(r=>r.id)),['live','today','future','review','past']);
 assert.deepEqual(plain(result.queue),{total:5,live:1,today:1,upcoming:1,review:1,past:1,shown:5,limit:100,truncated:false,timeZone:'Europe/Prague'});
 assert.deepEqual(rows,original);assert.doesNotThrow(()=>s.validateSnapshot(payload(result)));
});

test('nearby events after the first hundred historical rows stay visible with complete totals',()=>{
 const rows=Array.from({length:125},(_,i)=>event('old-'+i,'2026-01-01T08:00Z','2026-01-01T09:00Z'));
 rows.push(event('upcoming','2026-10-22T08:00Z','2026-10-22T09:00Z'),event('today','2026-10-21T09:00Z','2026-10-21T10:00Z'));
 const result=load().ocEventQueue_(rows,NOW);
 assert.deepEqual(plain(result.rows.slice(0,2).map(r=>r.id)),['today','upcoming']);
 assert.equal(result.queue.total,127);assert.equal(result.queue.past,125);
 assert.equal(result.queue.shown,100);assert.equal(result.rows.length,100);assert.equal(result.queue.truncated,true);
});

test('start is inclusive, end is exclusive and reversed or empty intervals require review',()=>{
 const result=load().ocEventQueue_([
  event('starts-now','2026-10-21T08:00Z','2026-10-21T09:00Z'),event('ends-now','2026-10-21T07:00Z','2026-10-21T08:00Z'),
  event('empty','2026-10-21T08:00Z','2026-10-21T08:00Z'),event('reversed','2026-10-21T09:00Z','2026-10-21T08:00Z')],NOW);
 const rows=Object.fromEntries(result.rows.map(r=>[r.id,r]));
 assert.equal(rows['starts-now'].state,'LIVE');assert.equal(rows['ends-now'].state,'PAST');
 assert.equal(rows.empty.reason,'END_NOT_AFTER_START');assert.equal(rows.reversed.reason,'END_NOT_AFTER_START');
});

test('the existing local Events format is normalized explicitly to Prague instants',()=>{
 const s=load(),result=s.ocEventQueue_([event('minutes','2026-10-21 10:00','2026-10-21T11:00'),
  event('seconds','2026-10-21 10:00:30','2026-10-21 11:00:30')],NOW);
 assert.equal(result.rows[0].startAt,'2026-10-21T08:00:00.000Z');assert.equal(result.rows[0].state,'LIVE');
 assert.equal(result.rows[1].startAt,'2026-10-21T08:00:30.000Z');assert.equal(result.rows[1].state,'TODAY');
 assert.equal(result.rows[0].date,'2026-10-21 10:00');assert.doesNotThrow(()=>s.validateSnapshot(payload(result)));
});

test('winter and summer midnight use the Prague day rather than the UTC day',()=>{
 const s=load();
 for(const [now,day] of [['2026-01-21T23:00:00Z','2026-01-22'],['2026-07-21T22:00:00Z','2026-07-22']]){
  const result=s.ocEventQueue_([event('local',day+' 00:30',day+' 01:30')],Date.parse(now));
  assert.equal(result.queue.today,1);assert.equal(result.queue.upcoming,0);
  const data=payload(result);data.at=now;assert.doesNotThrow(()=>s.validateSnapshot(data));
 }
});

test('a lenient parse cannot turn a nonexistent spring clock time into a valid event',()=>{
 const result=load().ocEventQueue_([event('missing-hour','2026-03-29 02:30','2026-03-29 04:00')],Date.parse('2026-03-29T00:00Z'));
 assert.equal(result.rows[0].state,'REVIEW');assert.equal(result.rows[0].reason,'START_INVALID');assert.equal(result.rows[0].startAt,null);
});

test('an ambiguous rollback hour is kept for review instead of choosing an arbitrary instant',()=>{
 const s=load(),result=s.ocEventQueue_([event('repeated-hour','2026-10-25 02:30','2026-10-25 04:00')],NOW);
 assert.equal(result.rows[0].state,'REVIEW');assert.equal(result.rows[0].reason,'START_AMBIGUOUS');assert.equal(result.rows[0].startAt,null);
 assert.equal(result.rows[0].date,'2026-10-25 02:30');assert.doesNotThrow(()=>s.validateSnapshot(payload(result)));
});

test('explicit offsets disambiguate rollback hours and preserve chronological order',()=>{
 const result=load().ocEventQueue_([
  event('later','2026-10-25T02:15:00+01:00','2026-10-25T02:45:00+01:00'),
  event('earlier','2026-10-25T02:15:00+02:00','2026-10-25T02:45:00+02:00')],Date.parse('2026-10-25T00:00Z'));
 assert.deepEqual(plain(result.rows.map(r=>r.id)),['earlier','later']);assert.equal(result.queue.today,2);
});

test('missing, date-only, impossible and ambiguous end values retain specific review reasons',()=>{
 const s=load(),start='2026-10-21T09:00Z',end='2026-10-21T10:00Z';
 const rows=[event('start-missing','',end),event('start-impossible','2026-02-30T09:00Z',end),event('start-date-only','2026-10-21',end),
  event('end-missing',start,''),event('end-impossible',start,'not a date'),event('end-date-only',start,'2026-10-21'),event('end-ambiguous',start,'2026-10-25 02:30')];
 const result=s.ocEventQueue_(rows,NOW),reasons=Object.fromEntries(result.rows.map(r=>[r.id,r.reason]));
 assert.equal(result.queue.review,7);assert.equal(result.queue.live,0);
 assert.deepEqual(reasons,{'start-missing':'START_MISSING','start-impossible':'START_INVALID','start-date-only':'START_TIME_MISSING',
  'end-missing':'END_MISSING','end-impossible':'END_INVALID','end-date-only':'END_TIME_MISSING','end-ambiguous':'END_AMBIGUOUS'});
 assert.doesNotThrow(()=>s.validateSnapshot(payload(result)));
});

test('missing or duplicate event headers fail before configuration or later processing',()=>{
 const headers=['Event_ID','Title','Community','Status','Start_DateTime','End_DateTime'];
 for(const invalid of [headers.filter(h=>h!=='End_DateTime'),[...headers,'Start_DateTime']]){
  const s=load(),reads=[];s.ocOwner_=()=>{};s.ocId_=()=>'fixture';
  s.SpreadsheetApp={openById:()=>({})};s.PropertiesService={getScriptProperties:()=>({})};
  s.ocRows_=(_ss,name)=>{reads.push(name);return name==='Events'?{missing:false,headers:invalid,rows:[]}:{missing:true,rows:[]};};
  assert.throws(()=>s.operatorSnapshot(),/Events schema/);assert.deepEqual(reads,['Leads','SocialPublishing','Events']);
 }
});

test('snapshot reads native event Date cells and returns only existing display fields and schedule metadata',()=>{
 const s=load(),headers=['Event_ID','Title','Community','Status','Start_DateTime','End_DateTime'];
 const data=[headers,['old','Fixture old','Fixture community','Active',new Date('2000-01-01T08:00Z'),new Date('2000-01-01T09:00Z')],
  ['future','Fixture future','Fixture community','Active',new Date('2099-01-01T08:00Z'),new Date('2099-01-01T09:00Z')]];
 const original=structuredClone(data);s.ocOwner_=()=>{};s.ocId_=()=>'fixture';
 s.PropertiesService={getScriptProperties:()=>({getProperty:()=>null})};
 s.SpreadsheetApp={openById:()=>({getUrl:()=> 'https://docs.google.com/spreadsheets/d/fixture/edit',getSheetByName:name=>name==='Events'?
  {getLastRow:()=>data.length,getDataRange:()=>({getValues:()=>data.map(row=>[...row])}),getSheetId:()=>3}:null})};
 const result=s.operatorSnapshot();assert.equal(result.eventQueue.past,1);assert.equal(result.eventQueue.upcoming,1);
 assert.equal(result.events[0].id,'future');assert.equal(result.events[0].date,'2099-01-01T08:00:00.000Z');
 assert.ok(!result.missing.includes('Events'));assert.doesNotThrow(()=>s.validateSnapshot(result));assert.deepEqual(data,original);
});

test('accepting existing local event text does not relax timezone-free lead deadlines',()=>{
 const s=load(),text='2026-10-21 10:00';
 assert.equal(s.ocEventTime_(text).kind,'TIME');
 assert.equal(s.ocLeadDeadline_(text,NOW,'2026-10-21').state,'INVALID_DATE');
});
