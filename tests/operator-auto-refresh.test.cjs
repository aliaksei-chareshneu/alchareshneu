const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const script=fs.readFileSync(__dirname+'/../OperatorConsole.html','utf8')
  .match(/<script>([\s\S]*?)<\/script>/)[1].split("\ndocument.querySelectorAll('[data-tab]')")[0];

function fixture(){
  let now=1000000;
  const elements={},calls=[],timers=[];
  class Clock extends Date {static now(){return now;}}
  const runner=(success,failure)=>({
    withSuccessHandler:callback=>runner(callback,failure),
    withFailureHandler:callback=>runner(success,callback),
    operatorSnapshot:()=>calls.push({method:'read',success,failure}),
    operatorAction:action=>calls.push({method:action,success,failure})
  });
  const context={Date:Clock,window:{google:true},google:{script:{run:runner()}},
    document:{visibilityState:'visible',querySelectorAll:()=>[],
      getElementById:id=>elements[id]||(elements[id]={checked:id==='autoRefresh',style:{}})},
    setTimeout:(callback,delay)=>{timers.push({callback,delay,canceled:false,fired:false});return timers.length;},
    clearTimeout:id=>{if(timers[id-1])timers[id-1].canceled=true;}
  };
  vm.createContext(context);vm.runInContext(script,context);
  const run=source=>vm.runInContext(source,context);
  run('render=()=>{capabilities={actions:{syncOSVC:true,syncDruzina:true}}};rpc("operatorSnapshot")');
  calls[0].success({});
  return {run,context,e:elements,calls,timers,advance:ms=>{now+=ms;},
    active:delay=>timers.findLast(timer=>!timer.canceled&&!timer.fired&&timer.delay===delay),
    fire:timer=>{assert.ok(timer,'Expected an active timer');timer.fired=true;timer.callback();}};
}

test('automatic tick reads one snapshot and never overlaps or calls an action',()=>{
  const f=fixture(),timer=f.active(60000);
  f.fire(timer);
  assert.deepEqual(f.calls.map(call=>call.method),['read','read']);
  timer.callback(); // A callback already queued before cancellation is harmless.
  assert.equal(f.calls.length,2);
  assert.equal(f.active(60000),undefined);
  f.calls[1].success({});
  assert.ok(f.active(60000));
});

test('turning off automatic reads cancels queued work and preserves manual refresh',()=>{
  const f=fixture(),old=f.active(60000);
  f.run('document.getElementById("autoRefresh").checked=false;planAutoRefresh()');
  old.callback();
  assert.equal(f.calls.length,1);
  assert.match(f.e.autoRefreshStatus.textContent,/выключено/);
  f.run('rpc("operatorSnapshot")');f.calls[1].success({});
  assert.equal(f.active(60000),undefined);
  f.run('document.getElementById("autoRefresh").checked=true;planAutoRefresh()');
  assert.ok(f.active(60000));
});

test('hidden pages pause and becoming visible schedules one overdue read',()=>{
  const f=fixture(),old=f.active(60000);
  f.context.document.visibilityState='hidden';f.run('planAutoRefresh()');
  f.advance(120000);old.callback();
  assert.equal(f.calls.length,1);
  assert.match(f.e.autoRefreshStatus.textContent,/неактивна/);
  f.context.document.visibilityState='visible';f.run('planAutoRefresh()');
  f.fire(f.active(1000));
  assert.deepEqual(f.calls.map(call=>call.method),['read','read']);
});

test('pending bank request keeps automatic reads paused after timeout and manual refresh',()=>{
  const f=fixture(),old=f.active(60000);
  f.run('rpc("operatorAction","syncOSVC")');old.callback();
  assert.deepEqual(f.calls.map(call=>call.method),['read','syncOSVC']);
  f.fire(f.active(90000));
  f.run('rpc("operatorSnapshot")');f.calls[2].success({});
  assert.equal(f.active(60000),undefined);
  assert.match(f.e.autoRefreshStatus.textContent,/ответ банка/);
  f.calls[1].success({imported:0});
  assert.ok(f.active(60000));
  assert.deepEqual(f.calls.map(call=>call.method),['read','syncOSVC','read']);
});

test('failed automatic read stops polling until a successful manual read',()=>{
  const f=fixture();f.fire(f.active(60000));f.calls[1].failure();
  f.run('planAutoRefresh()');
  assert.equal(f.active(60000),undefined);
  assert.match(f.e.autoRefreshStatus.textContent,/после ошибки/);
  assert.equal(f.calls.length,2);
  f.run('rpc("operatorSnapshot")');f.calls[2].success({});
  assert.ok(f.active(60000));
});

test('read timeout is never retried by visibility or polling callbacks',()=>{
  const f=fixture(),first=f.active(60000);f.fire(first);
  f.fire(f.active(30000));
  f.context.document.visibilityState='hidden';f.run('planAutoRefresh()');
  f.context.document.visibilityState='visible';f.run('planAutoRefresh()');
  first.callback();
  assert.equal(f.calls.length,2);
  assert.equal(f.active(60000),undefined);
  assert.match(f.e.message.textContent,/30 секунд/);
  f.run('rpc("operatorSnapshot")');f.calls[2].success({});
  assert.ok(f.active(60000));
});
