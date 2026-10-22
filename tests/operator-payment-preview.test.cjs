const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const client=fs.readFileSync(__dirname+'/../OperatorConsole.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("\ndocument.querySelectorAll('[data-tab]')")[0];
const backend=fs.readFileSync(__dirname+'/../PaymentReconciliation.gs','utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function load(){
 const elements={},s={Date,document:{getElementById:id=>elements[id]||(elements[id]={textContent:'',style:{}})}};
 vm.createContext(s);vm.runInContext(backend,s);vm.runInContext(client,s);
 s.table=(id,headers,rows)=>{elements[id]={headers:plain(headers),rows:plain(rows)};};
 return {s,e:elements};
}
const row=(transaction='7001',status='CANDIDATE_ONLY',amount=120,payment='TEST-ONLY-PAYMENT')=>({transaction,status,amount,payment});
function report(rows=[row()]){return {mode:'READ_ONLY',entity:'DRUZINA',settled:0,rows,total:rows.length,truncated:false,
 checkedAt:'2026-10-22T08:01:00.000Z',bank:{fresh:true,lastSuccess:'2026-10-22T08:00:00.000Z'},
 queue:{total:rows.length,candidates:rows.length,review:0,unmatched:0,excluded:0,shown:rows.length,limit:100,truncated:false}};}

test('payment contract rejects wrong entity, mutation claims and incomplete or duplicate rows before rendering',()=>{
 const changes=[d=>d.mode='SETTLED',d=>d.entity='OSVC',d=>d.settled=1,d=>delete d.settled,
  d=>d.total=-1,d=>d.total='1',d=>d.total=2,d=>d.truncated=true,d=>delete d.bank,d=>d.bank.fresh='true',
  d=>d.rows[0].transaction='TEST-ONLY',d=>d.rows[0].status='__proto__',d=>d.rows[0].status='UNKNOWN',d=>{d.rows[0].status=['CANDIDATE_ONLY'];d.rows[0].payment='';},d=>d.rows[0].status={},
  d=>d.rows[0].amount='120',d=>d.rows[0].amount=120.001,d=>d.rows[0].amount=null,d=>d.rows[0].amount=NaN,
  d=>d.rows[0].amount=Infinity,d=>d.rows[0].amount=0,d=>d.rows[0].amount=-120,d=>d.rows[0].payment=' ',
  d=>{d.rows.push({...d.rows[0]});d.total=2;d.queue.total=d.queue.candidates=d.queue.shown=2;}];
 for(const change of changes){const {s,e}=load();s.renderPaymentPreview(report());const before=plain(e),d=report();change(d);
  assert.throws(()=>s.renderPaymentPreview(d),/payment/);assert.deepEqual(plain(e),before);
 }
});

test('payment queue rejects inconsistent full counts, skipped priority rows, wrong order and incomplete timestamps',()=>{
 const changes=[d=>d.queue.candidates++,d=>d.queue.total++,d=>d.queue.shown=0,d=>d.queue.limit=40,
  d=>d.queue.truncated=true,d=>d.queue.review=-1,d=>d.queue.candidates=1.5,d=>delete d.queue.excluded,
  d=>d.checkedAt='2026-02-30T08:00:00.000Z',d=>d.checkedAt='2026-10-22T08:00:00Z',d=>delete d.checkedAt,
  d=>delete d.queue,d=>d.bank.lastSuccess='PRIVATE-FIXTURE',d=>d.bank.lastSuccess='2026-10-22T08:02:00.000Z',
  d=>{d.queue.candidates=0;d.queue.review=1;}];
 for(const change of changes){const {s}=load(),d=report();change(d);assert.throws(()=>s.validatePaymentPreview(d),/payment/);}
 const {s}=load(),d=report([row('7001','UNMATCHED',120,''),row('7002')]);
 d.queue.candidates=1;d.queue.unmatched=1;assert.throws(()=>s.validatePaymentPreview(d),/order/);
 const truncated=report(Array.from({length:100},(_,i)=>row(String(8000+i),'UNMATCHED',120,'')));
 Object.assign(truncated,{total:101,truncated:true});Object.assign(truncated.queue,{total:101,candidates:1,unmatched:100,truncated:true});
 assert.throws(()=>s.validatePaymentPreview(truncated),/queue/);
});

test('all server classifications, including null amounts and excluded zero, fit the client contract',()=>{
 const {s}=load(),p=(id,ref,amount=120,status='UNVERIFIED')=>({Payment_ID:id,Payment_Reference:ref,Amount_CZK:amount,Verification_Status:status});
 const payments=[p('TEST-1','1'),p('TEST-2','2'),p('TEST-3','2'),p('TEST-4','3',120,' PAID '),p('TEST-5','4','0x78'),
  p('TEST-6','5',130),p('TEST-7','6',110),p('TEST-8','7')];
 const transactions=[['1',120,'CZK'],['2',120,'CZK'],['3',120,'CZK'],['4',120,'CZK'],['5',120,'CZK'],['6',120,'CZK'],
  ['7',120,'CZK'],['7',120,'CZK'],['8',120,'CZK'],['1',0,'CZK'],['1',120,'EUR'],['1','1.2e2','CZK']]
  .map(([VS,Amount_CZK,Currency],i)=>({VS,Amount_CZK,Currency,Bank_Transaction_ID:String(9000+i)}));
 const plan=s.rcPlan_(payments,transactions),preview=s.rcPreviewQueue_(plan.rows),d={...report(),...plain(plan),...plain(preview),total:preview.queue.total,truncated:preview.queue.truncated};
 assert.doesNotThrow(()=>s.validatePaymentPreview(d));
 assert.equal(d.queue.candidates,1);assert.equal(d.queue.review,9);assert.equal(d.queue.unmatched,1);assert.equal(d.queue.excluded,1);
 s.renderPaymentPreview(d);
});

test('complete backend queue exposes an actionable row beyond one hundred old debits',()=>{
 const {s,e}=load(),rows=Array.from({length:110},(_,i)=>row(String(10000+i),'DEBIT_OR_ZERO',-1,''));rows.push(row('11000'));
 const preview=s.rcPreviewQueue_(rows),d={...report(),...plain(preview),total:111,truncated:true};
 s.renderPaymentPreview(d);assert.equal(e.paymentTable.rows[0][1],'11000');
 assert.match(e.paymentState.textContent,/Показано 100 из 111/);assert.match(e.paymentQueue.textContent,/расходы или ноль: 110/);
});

test('report time and bank evidence are separate, boundary crossing displays unconfirmed freshness',()=>{
 const {s,e}=load(),d=report();s.renderPaymentPreview(d);
 assert.match(e.paymentCheckedAt.textContent,/22\.10\.2026, 10:01/);assert.match(e.paymentBankState.textContent,/менее двух часов/);
 d.checkedAt='2026-10-22T10:00:00.000Z';s.renderPaymentPreview(d);assert.match(e.paymentBankState.textContent,/не подтверждена/);
 d.bank={fresh:false,lastSuccess:'PRIVATE-FIXTURE'};s.renderPaymentPreview(d);
 assert.match(e.paymentBankState.textContent,/нет корректной отметки/);assert.doesNotMatch(JSON.stringify(e),/PRIVATE-FIXTURE/);
});

test('legacy read-only reports clear full counters and report time rather than carrying forward newer metadata',()=>{
 const {s,e}=load();s.renderPaymentPreview(report());const legacy=report();delete legacy.queue;delete legacy.checkedAt;delete legacy.bank.lastSuccess;
 s.renderPaymentPreview(legacy);assert.match(e.paymentCheckedAt.textContent,/недоступно/);assert.match(e.paymentQueue.textContent,/недоступны/);
 assert.match(e.paymentBankState.textContent,/не подтверждена/);assert.equal(e.paymentTable.rows.length,1);
});


test('bank checkpoint parsing accepts adapter offsets and rejects normalized invalid dates or private text',()=>{
 const {s,e}=load();
 for(const lastSuccess of ['2026-10-22T10:00:00+02:00','2026-10-22T08:00:00Z','2026-10-22T08:00:00.000Z']){
  const d=report();d.bank.lastSuccess=lastSuccess;s.renderPaymentPreview(d);
  assert.match(e.paymentBankState.textContent,/менее двух часов/);assert.match(e.paymentBankState.textContent,/22\.10\.2026, 10:00/);
 }
 for(const lastSuccess of ['2026-02-30T08:00:00Z','2026-10-22T24:00:00Z','2026-10-22T08:00:60Z',
  '2026-10-22T08:00:00+14:01','2026-10-22T08:00:00+02:60','2026-10-22T08:00:00','2026-10-22','PRIVATE-FIXTURE']){
  const d=report();d.bank.lastSuccess=lastSuccess;assert.throws(()=>s.renderPaymentPreview(d),/bank timestamp/);
  d.bank.fresh=false;s.renderPaymentPreview(d);assert.match(e.paymentBankState.textContent,/нет корректной отметки/);
 }
 const d=report();d.bank={fresh:false,lastSuccess:'2026-10-23T08:00:00.000Z'};s.renderPaymentPreview(d);
 assert.match(e.paymentBankState.textContent,/нет корректной отметки/);
});
