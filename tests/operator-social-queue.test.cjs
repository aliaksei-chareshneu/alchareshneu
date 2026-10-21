const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const server=fs.readFileSync(__dirname+'/../OperatorConsoleServer.gs','utf8');
const client=fs.readFileSync(__dirname+'/../OperatorConsole.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("\ndocument.querySelectorAll('[data-tab]')")[0];
function load(){const s={Date,URL,Utilities:{formatDate:()=> '2026-10-21'}};vm.createContext(s);vm.runInContext(server,s);vm.runInContext(client,s);return s;}
const job=(id,status,extra={})=>({Job_ID:id,Event_ID:'fixture-event',Channel:'fixture-channel',Status:status,...extra});
const plain=value=>JSON.parse(JSON.stringify(value));
const receipt='https://example.org/posts/fixture-42';

test('publication problems sort before pending work, drafts, inactive jobs and stored confirmations',()=>{
 const rows=[job('verified','PUBLISHED_VERIFIED',{Post_URL:receipt}),job('draft','DRAFT'),
  job('limit','ERROR_LIMIT',{Error:'quota exceeded; TOKEN_FIXTURE_DO_NOT_ECHO'}),job('pending','SCHEDULED_PENDING',{Post_ID:'provider-id',Post_URL:receipt}),
  job('inactive','ARCHIVED'),job('missing','PUBLISHED_VERIFIED',{Post_URL:' '}),job('unknown','new provider state'),job('manual','READY_MANUAL'),{}, {Status:' '}];
 const original=structuredClone(rows),result=load().ocSocialQueue_(rows);
 assert.deepEqual(plain(result.rows.map(r=>r.id)),['limit','missing','unknown','manual','pending','draft','inactive','verified']);
 assert.deepEqual(plain(result.queue),{total:8,attention:4,pending:1,draft:1,inactive:1,verified:1,shown:8,limit:100,truncated:false});
 assert.deepEqual(rows,original);
 assert.ok(!JSON.stringify(result).includes('TOKEN_FIXTURE_DO_NOT_ECHO'));
});

test('problems after row one hundred remain visible and totals cover the complete source queue',()=>{
 const rows=Array.from({length:125},(_,i)=>job('old-'+i,'PUBLISHED_VERIFIED',{Post_URL:receipt}));
 rows.push(job('problem','REVIEW_REQUIRED'),job('pending','BUFFER_QUEUED',{Error:'QUEUED_ONLY; verify public permalink after send'}));
 const result=load().ocSocialQueue_(rows);
 assert.deepEqual(plain(result.rows.slice(0,2).map(r=>r.id)),['problem','pending']);
 assert.equal(result.queue.total,127);assert.equal(result.queue.shown,100);assert.equal(result.rows.length,100);
 assert.equal(result.queue.verified,125);assert.equal(result.queue.truncated,true);
});

test('provider IDs and legacy publication states never become PUBLISHED_VERIFIED receipts',()=>{
 const rows=['PUBLISHED','ALREADY_POSTED','MANUAL_OWNER_CONFIRMED','MANUAL_LINK_RECORDED','MANUAL_VERIFIED','DELIVERY_UNVERIFIED']
  .map((status,i)=>job('review-'+i,status,{Post_ID:'provider-id',Post_URL:receipt}));
 rows.push(job('queued','SCHEDULED_PENDING',{Post_ID:'provider-id',Post_URL:receipt}));
 const result=load().ocSocialQueue_(rows);
 assert.equal(result.queue.verified,0);assert.equal(result.queue.attention,6);assert.equal(result.queue.pending,1);
 assert.ok(result.rows.every(r=>r.verified===false&&r.receipt===''));
});

test('server and browser reject unsafe, malformed and credential-bearing receipt links',()=>{
 const s=load(),invalid=['',' ','javascript:alert(1)','data:text/html,fixture','http://example.org/post','//example.org/post','https:example.org/post',
  'https://owner:secret@example.org/post','https://example.org:8443/post','https://localhost/post','https://127.0.0.1/post','https://-bad.example/post',
  'https://example.org\\@evil.example/post','https://example.org/<img>','https://example.org/post\nnext','https://éxample.org/post',
  'https://example.org/?access_token=TOKEN_FIXTURE','https://example.org/?%61pi-key=KEY_FIXTURE','https://example.org/#access_token=TOKEN_FIXTURE',
  'https://example.org/?X-Amz-Signature=SIGNATURE_FIXTURE','https://example.org/?%E0%A4=broken'];
 for(const url of invalid){assert.equal(s.ocSocialReceipt_(url),'',url);assert.equal(s.socialReceipt(url),'',url);
  const item=s.ocSocialSummary_([job('bad','PUBLISHED_VERIFIED',{Post_URL:url})])[0];
  assert.equal(item.state,'ATTENTION');assert.equal(item.verified,false);assert.equal(item.receipt,'');
 }
});

test('public HTTPS receipt URLs retain permalink query parameters and explicit default ports',()=>{
 const s=load(),urls=[receipt,' https://t.me/fixture_public/42 ',
  'https://www.facebook.com/permalink.php?story_fbid=42&id=123','https://www.instagram.com/p/Fixture_42/?utm_source=fixture',
  'https://www.youtube.com/watch?v=fixture42','https://example.org:443/posts/42#comments','HTTPS://EXAMPLE.ORG/posts/42'];
 for(const url of urls){assert.ok(s.ocSocialReceipt_(url),url);assert.ok(s.socialReceipt(url),url);
  const item=s.ocSocialSummary_([job('confirmed',' published_verified ',{Post_URL:url,Error:' '})])[0];
  assert.equal(item.state,'VERIFIED');assert.equal(item.verified,true);
 }
});

test('raw provider errors stay server-side while queued notes, limits and conflicting records stay distinct',()=>{
 const rows=[job('conflict','PUBLISHED_VERIFIED',{Post_URL:receipt,Error:'Bearer CONFLICT_FIXTURE_SECRET'}),
  job('note','BUFFER_QUEUED',{Error:'QUEUED_ONLY; verify public permalink after send'}),
  job('rate','SCHEDULED_PENDING',{Error:'429 account limit; Bearer RATE_FIXTURE_SECRET'}),
  job('failed','DRAFT',{Error:'provider failure; https://example.org/?token=ERROR_FIXTURE_SECRET'}),
  job('inactive','CANCELLED',{Error:'Bearer CANCELED_FIXTURE_SECRET'})];
 const result=load().ocSocialQueue_(rows),byId=Object.fromEntries(result.rows.map(r=>[r.id,r]));
 assert.equal(byId.conflict.reason,'RECORD_CONFLICT');assert.equal(byId.conflict.receipt,'');
 assert.equal(byId.note.state,'PENDING');assert.equal(byId.note.reason,'WAITING');
 assert.equal(byId.rate.reason,'PROVIDER_LIMIT');assert.equal(byId.failed.reason,'PUBLISH_ERROR');
 assert.equal(byId.inactive.state,'INACTIVE');
 assert.ok(!JSON.stringify(result).includes('FIXTURE_SECRET'));
 assert.ok(result.rows.every(r=>!Object.hasOwn(r,'error')&&!Object.hasOwn(r,'Error')));
});

test('unknown and oversized statuses require review without exporting arbitrary status text',()=>{
 const rows=[job('new','unexpected TOKEN_FIXTURE_SECRET'),job('oversized','ERROR_'+'A'.repeat(200)),job('missing','')];
 const result=load().ocSocialQueue_(rows);
 assert.equal(result.queue.attention,3);assert.equal(result.queue.draft,0);
 assert.ok(result.rows.every(r=>r.status==='UNKNOWN'&&r.reason==='UNKNOWN_STATUS'));
 assert.ok(!JSON.stringify(result).includes('TOKEN_FIXTURE_SECRET'));
});

test('the actual server projection and counts satisfy client validation for all queue categories',()=>{
 const s=load(),result=s.ocSocialQueue_([job('error','FAILED'),job('pending','CLAIMED'),job('draft','DRAFT'),
  job('inactive','SKIPPED'),job('verified','PUBLISHED_VERIFIED',{Post_URL:receipt})]);
 const payload={at:'2026-10-21T08:00:00Z',leads:{count:0,excludedTests:0,needsAction:[]},
  banks:{osvc:{balance:null,configured:false,lastSuccess:''},druzina:{balance:0,configured:true,lastSuccess:''}},
  social:result.rows,socialQueue:result.queue,events:[],missing:[]};
 assert.doesNotThrow(()=>s.validateSnapshot(payload));
 assert.equal(result.rows.find(r=>r.id==='pending').reason,'IN_PROGRESS');
});

test('snapshot converts native schedule Dates and sends only the bounded publication projection',()=>{
 const s=load(),headers=['Job_ID','Event_ID','Channel','Scheduled_At','Status','Post_URL','Error'];
 const data=[headers,['confirmed','fixture-event','fixture-channel',new Date('2026-10-22T08:00:00Z'),'PUBLISHED_VERIFIED',receipt,''],
  ['problem','fixture-event','fixture-channel','','ERROR_LIMIT','','RAW_FIXTURE_SECRET']];
 const original=structuredClone(data);s.ocOwner_=()=>{};s.ocId_=()=>'fixture';
 s.PropertiesService={getScriptProperties:()=>({getProperty:()=>null})};
 s.SpreadsheetApp={openById:()=>({getUrl:()=> 'https://docs.google.com/spreadsheets/d/fixture/edit',getSheetByName:name=>name==='SocialPublishing'?
  {getLastRow:()=>data.length,getDataRange:()=>({getValues:()=>data.map(row=>[...row])}),getSheetId:()=>2}:null})};
 const result=s.operatorSnapshot();
 assert.equal(result.socialQueue.attention,1);assert.equal(result.socialQueue.verified,1);
 assert.equal(result.social[0].id,'problem');assert.equal(result.social[1].scheduled,'2026-10-22T08:00:00.000Z');
 assert.ok(!result.missing.includes('SocialPublishing'));assert.ok(!JSON.stringify(result).includes('RAW_FIXTURE_SECRET'));
 assert.doesNotThrow(()=>s.validateSnapshot(result));assert.deepEqual(data,original);
});

test('missing or duplicate publication headers stop the snapshot before later sheet reads',()=>{
 const headers=['Job_ID','Event_ID','Channel','Scheduled_At','Status','Post_URL','Error'];
 for(const invalid of [headers.filter(h=>h!=='Post_URL'),[...headers,'Status']]){
  const s=load(),reads=[];s.ocOwner_=()=>{};s.ocId_=()=>'fixture';
  s.SpreadsheetApp={openById:()=>({})};s.PropertiesService={getScriptProperties:()=>({})};
  s.ocRows_=(_ss,name)=>{reads.push(name);return name==='Leads'?{missing:true,rows:[]}:{missing:false,headers:invalid,rows:[]};};
  assert.throws(()=>s.operatorSnapshot(),/SocialPublishing schema/);assert.deepEqual(reads,['Leads','SocialPublishing']);
 }
});
