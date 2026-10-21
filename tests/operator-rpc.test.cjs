const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const script=fs.readFileSync(__dirname+'/../OperatorConsole.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("\ndocument.querySelectorAll('[data-tab]')")[0];
function setup(){const elements={},timers=[],calls=[],buttons=[{dataset:{}},{dataset:{action:'syncOSVC'}}];let success,failure;const runner={withSuccessHandler:f=>(success=f,runner),withFailureHandler:f=>(failure=f,runner),operatorSnapshot:()=>calls.push('read'),operatorAction:a=>calls.push(a)};const s={window:{google:true},google:{script:{run:runner}},document:{getElementById:id=>elements[id]||(elements[id]={style:{}}),querySelectorAll:()=>buttons},setTimeout:f=>(timers.push(f),timers.length),clearTimeout:()=>{}};vm.createContext(s);vm.runInContext(script,s);return {s,e:elements,timers,calls,buttons,success:()=>success,failure:()=>failure,run:c=>vm.runInContext(c,s)};}
test('snapshot timeout releases refresh but disables actions and ignores late response',()=>{const t=setup();t.run('rpc("operatorSnapshot")');const old=t.success();t.timers[0]();assert.equal(t.buttons[0].disabled,false);assert.equal(t.buttons[1].disabled,true);assert.match(t.e.message.textContent,/30 секунд/);t.run('render=()=>{throw Error("late render must be ignored")}');old({});});
test('action timeout never automatically retries a write',()=>{const t=setup();t.run('capabilities={actions:{syncOSVC:true}};rpc("operatorAction","syncOSVC")');t.timers[0]();assert.deepEqual(t.calls,['syncOSVC']);assert.match(t.e.message.textContent,/НЕ ПРОВЕРЕН/);assert.equal(t.buttons[1].disabled,true);});
test('double click cannot create concurrent requests',()=>{const t=setup();t.run('rpc("operatorSnapshot");rpc("operatorSnapshot")');assert.deepEqual(t.calls,['read']);});
test('malformed render ends loading with visible failure',()=>{const t=setup();t.run('rpc("operatorSnapshot")');t.success()({});assert.equal(t.buttons[0].disabled,false);assert.match(t.e.message.textContent,/не удалось отобразить/);});
test('late prior callback cannot overwrite a newer read',()=>{const t=setup();t.run('rpc("operatorSnapshot")');const old=t.success();t.timers[0]();t.run('rpc("operatorSnapshot");render=()=>{globalThis.rendered=true}');old({});assert.equal(t.s.rendered,undefined);t.success()({});assert.equal(t.s.rendered,true);assert.equal(t.buttons[0].disabled,false);});

test('refresh after a bank timeout cannot enable another bank import',()=>{
 const t=setup();
 t.run('capabilities={actions:{syncOSVC:true,syncDruzina:true}};rpc("operatorAction","syncOSVC")');
 t.timers[0]();
 t.run('rpc("operatorSnapshot");render=d=>{capabilities=d.capabilities;controls()}');
 t.success()({capabilities:{actions:{syncOSVC:true,syncDruzina:true}}});
 assert.equal(t.buttons[0].disabled,false);
 assert.equal(t.buttons[1].disabled,true);
 t.run('rpc("operatorAction","syncOSVC");rpc("operatorAction","syncDruzina")');
 assert.deepEqual(t.calls,['syncOSVC','read']);
});

test('late bank receipt unlocks imports without overwriting a newer snapshot',()=>{
 const t=setup();
 t.run('capabilities={actions:{syncOSVC:true}};rpc("operatorAction","syncOSVC")');
 const bankReceipt=t.success();
 t.timers[0]();
 t.run('rpc("operatorSnapshot");render=d=>{capabilities=d.capabilities;globalThis.renderCount=(globalThis.renderCount||0)+1;controls()}');
 t.success()({capabilities:{actions:{syncOSVC:true}}});
 bankReceipt({imported:1});
 assert.equal(t.s.renderCount,1);
 assert.equal(t.buttons[1].disabled,false);
 assert.deepEqual(t.calls,['syncOSVC','read']);
});

test('malformed snapshot cannot replace the last complete data',()=>{
 const t=setup();
 t.run('document.getElementById("updated").textContent="previous snapshot";document.getElementById("osvcBalance").textContent="100 Kč"');
 assert.throws(()=>t.run('render({at:"2026-10-21T08:00:00Z",banks:{osvc:{balance:0,configured:true,lastSuccess:""},druzina:{balance:null,configured:false,lastSuccess:""}}})'));
 assert.equal(t.e.updated.textContent,'previous snapshot');
 assert.equal(t.e.osvcBalance.textContent,'100 Kč');
});

test('bank failure does not claim that no server side effect occurred',()=>{
 const t=setup();
 t.run('capabilities={actions:{syncOSVC:true}};rpc("operatorAction","syncOSVC")');
 t.failure()();
 assert.doesNotMatch(t.e.message.textContent,/Действие не выполнено/);
 assert.match(t.e.message.textContent,/НЕ ПРОВЕРЕН/);
 assert.equal(t.buttons[0].disabled,false);
});

test('broken Google bridge ends loading with a visible error',()=>{
 const t=setup();
 t.s.google.script.run.withSuccessHandler=()=>{throw Error('bridge unavailable')};
 assert.doesNotThrow(()=>t.run('rpc("operatorSnapshot")'));
 assert.equal(t.buttons[0].disabled,false);
 assert.match(t.e.message.textContent,/Не удалось отправить/);
});

function snapshot(){return {
 at:'2026-10-21T08:00:00Z',capabilities:{actions:{syncOSVC:true}},
 banks:{osvc:{balance:0,configured:true,lastSuccess:''},druzina:{balance:null,configured:false,lastSuccess:''}},
 leads:{count:1,excludedTests:0,needsAction:[]},social:[],events:[],missing:[],ingestion:'NOT_VERIFIED'
};}

test('complete snapshot preserves zero and unknown balances as different states',()=>{
 const t=setup();t.s.payload=snapshot();
 t.run('table=()=>{};link=()=>{};render(payload)');
 assert.match(t.e.osvcBalance.textContent,/0/);
 assert.equal(t.e.ngoBalance.textContent,'НЕ ПРОВЕРЕНО');
 assert.match(t.e.updated.textContent,/Обновлено:/);
});

test('invalid financial value or capability cannot partially update a snapshot',()=>{
 for(const invalid of ['0',NaN,Infinity,undefined]){
  const t=setup();t.s.payload=snapshot();t.s.payload.banks.osvc.balance=invalid;
  assert.throws(()=>t.run('render(payload)'),/Incomplete/);
  assert.equal(t.e.updated,undefined);
 }
 const t=setup();t.s.payload=snapshot();t.s.payload.capabilities.actions.syncOSVC='true';
 assert.throws(()=>t.run('render(payload)'),/Incomplete/);
 assert.equal(t.e.updated,undefined);
});

test('incomplete payment preview leaves the previous table and summary intact',()=>{
 const t=setup();
 t.run('document.getElementById("paymentState").textContent="previous preview";document.getElementById("paymentTable").textContent="previous rows";capabilities={actions:{previewPayments:true}};rpc("operatorAction","previewPayments")');
 t.success()({rows:[{transaction:'fixture'}],total:1,truncated:false});
 assert.equal(t.e.paymentState.textContent,'previous preview');
 assert.equal(t.e.paymentTable.textContent,'previous rows');
 assert.match(t.e.message.textContent,/не удалось отобразить/);
});

test('late bank error releases the pending request without replacing newer data',()=>{
 const t=setup();
 t.run('capabilities={actions:{syncOSVC:true}};rpc("operatorAction","syncOSVC")');
 const bankFailure=t.failure();t.timers[0]();
 t.run('rpc("operatorSnapshot");render=d=>{capabilities=d.capabilities;globalThis.renderCount=(globalThis.renderCount||0)+1;controls()}');
 t.success()({capabilities:{actions:{syncOSVC:true}}});bankFailure();
 assert.equal(t.s.renderCount,1);
 assert.equal(t.buttons[1].disabled,false);
 assert.match(t.e.message.textContent,/НЕ ПРОВЕРЕН/);
 assert.deepEqual(t.calls,['syncOSVC','read']);
});

test('invalid lead queue metadata or deadlines cannot replace the previous snapshot',()=>{
 const breakQueue=[d=>d.leads.queue.total++,d=>d.leads.queue.shown=0,d=>d.leads.queue.timeZone='UTC',
  d=>d.leads.needsAction[0].dueState='__proto__',d=>delete d.leads.needsAction[0].next,
  d=>d.leads.needsAction[0].next='not a deadline',d=>d.leads.needsAction[0].next='2026-10-22T09:00'];
 for(const change of breakQueue){
  const t=setup(),data=snapshot();
  data.leads.queue={total:1,overdue:0,today:0,upcoming:1,noDate:0,invalidDate:0,shown:1,limit:40,truncated:false,timeZone:'Europe/Prague'};
  data.leads.needsAction=[{id:'fixture',next:'2026-10-22',dueState:'UPCOMING'}];
  change(data);t.s.payload=data;
  t.run('document.getElementById("leadQueue").textContent="previous queue";document.getElementById("osvcBalance").textContent="100 Kč"');
  assert.throws(()=>t.run('render(payload)'),/lead queue/);
  assert.equal(t.e.leadQueue.textContent,'previous queue');assert.equal(t.e.osvcBalance.textContent,'100 Kč');
 }
});

test('older snapshot modules clear stale priority counts and label unavailable queue data',()=>{
 const t=setup();t.s.payload=snapshot();
 t.run('document.getElementById("leadQueue").textContent="previous queue";table=()=>{};link=()=>{};render(payload)');
 assert.match(t.e.leadQueue.textContent,/недоступен в этой версии/);
 assert.doesNotMatch(t.e.leadQueue.textContent,/Открытых задач: 0/);
});

test('inconsistent publication counters and unsafe confirmations preserve previous data',()=>{
 const changes=[d=>d.socialQueue.total++,d=>d.socialQueue.verified=0,d=>d.socialQueue.shown=0,
  d=>d.social[0].verified=false,d=>d.social[0].receipt='javascript:alert(1)',
  d=>d.social[0].receipt='https://example.org/?access_token=FIXTURE',d=>d.social[0].reason='__proto__',
  d=>d.social[0].status='SCHEDULED_PENDING',d=>d.social[0].error='Unresolved provider error'];
 for(const change of changes){
  const t=setup(),data=snapshot();t.s.URL=URL;
  data.socialQueue={total:1,attention:0,pending:0,draft:0,inactive:0,verified:1,shown:1,limit:100,truncated:false};
  data.social=[{id:'fixture',event:'fixture',channel:'fixture',scheduled:'',status:'PUBLISHED_VERIFIED',state:'VERIFIED',reason:'VERIFIED',receipt:'https://example.org/posts/fixture',verified:true}];
  change(data);t.s.payload=data;
  t.run('document.getElementById("socialQueue").textContent="previous queue";document.getElementById("osvcBalance").textContent="100 Kč"');
  assert.throws(()=>t.run('render(payload)'),/publication queue/);
  assert.equal(t.e.socialQueue.textContent,'previous queue');assert.equal(t.e.osvcBalance.textContent,'100 Kč');
 }
});

test('inconsistent event counters, intervals and phase labels preserve the previous snapshot',()=>{
 const changes=[d=>d.eventQueue.total++,d=>d.eventQueue.live=0,d=>d.eventQueue.timeZone='UTC',d=>d.events[0].state='__proto__',
  d=>d.events[0].endAt='2026-10-21T07:00:00.000Z',d=>delete d.events[0].startAt,d=>d.events[0].startAt='not a date',
  d=>d.events[0].state='TODAY',d=>d.events[0].reason='START_MISSING'];
 for(const change of changes){
  const t=setup(),data=snapshot();
  data.eventQueue={total:1,live:1,today:0,upcoming:0,review:0,past:0,shown:1,limit:100,truncated:false,timeZone:'Europe/Prague'};
  data.events=[{id:'fixture',title:'Fixture',community:'Fixture',date:'2026-10-21T08:00Z',end:'2026-10-21T09:00Z',startAt:'2026-10-21T08:00:00.000Z',endAt:'2026-10-21T09:00:00.000Z',state:'LIVE',reason:'RANGE_VALID'}];
  change(data);t.s.payload=data;
  t.run('document.getElementById("eventQueue").textContent="previous agenda";document.getElementById("osvcBalance").textContent="100 Kč"');
  assert.throws(()=>t.run('render(payload)'),/event agenda/);
  assert.equal(t.e.eventQueue.textContent,'previous agenda');assert.equal(t.e.osvcBalance.textContent,'100 Kč');
 }
});
