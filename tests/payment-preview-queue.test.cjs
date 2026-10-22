const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=name=>fs.readFileSync(__dirname+'/../'+name,'utf8');
function load(extra={},withConsole=false){
  const s={...extra};vm.createContext(s);
  if(withConsole)vm.runInContext(source('OperatorConsoleServer.gs'),s);
  vm.runInContext(source('PaymentReconciliation.gs'),s);return s;
}
const plain=value=>JSON.parse(JSON.stringify(value));
const payment=(x={})=>({Payment_ID:'synthetic-payment',Payment_Reference:'123',Amount_CZK:120,Verification_Status:'PENDING',...x});
const transfer=(x={})=>({Bank_Transaction_ID:'1001',VS:'123',Amount_CZK:120,Currency:'CZK',...x});
const reviewStatuses=['REVIEW','CURRENCY_REVIEW','INVALID_AMOUNT','AMBIGUOUS_REFERENCE','EXISTING_STATUS_REVIEW','INVALID_EXPECTED','PARTIAL_REVIEW','OVERPAYMENT_REVIEW','MULTIPLE_TRANSFERS_REVIEW'];
test('preview queue counts every known status and preserves source order within each priority',()=>{
  const statuses=['DEBIT_OR_ZERO','UNMATCHED',...reviewStatuses,'CANDIDATE_ONLY','UNMATCHED','CANDIDATE_ONLY','DEBIT_OR_ZERO'];
  const rows=Object.freeze(statuses.map((status,index)=>Object.freeze({transaction:String(index+1),status})));
  const result=load().rcPreviewQueue_(rows);
  assert.deepEqual(plain(result.queue),{total:15,candidates:2,review:9,unmatched:2,excluded:2,shown:15,limit:100,truncated:false});
  const expected=['CANDIDATE_ONLY','CANDIDATE_ONLY',...reviewStatuses,'UNMATCHED','UNMATCHED','DEBIT_OR_ZERO','DEBIT_OR_ZERO'];
  assert.deepEqual(plain(result.rows.map(row=>row.status)),expected);
  assert.deepEqual(plain(result.rows.map(row=>row.transaction)),['12','14','3','4','5','6','7','8','9','10','11','2','13','1','15']);
  assert.equal(rows[0].status,'DEBIT_OR_ZERO');
  assert.equal(result.rows[0],rows[11]);
});
test('preview prioritizes candidate at row 101 and computes counts before truncating',()=>{
  const s=load(),transfers=Array.from({length:100},(_,i)=>transfer({Bank_Transaction_ID:String(i+1),Amount_CZK:-1}));
  transfers.push(transfer({Bank_Transaction_ID:'101'}),transfer({Bank_Transaction_ID:'102',VS:'999'}),transfer({Bank_Transaction_ID:'103',Amount_CZK:'1e2'}));
  const plan=s.rcPlan_([payment()],transfers),before=JSON.stringify(plan),result=s.rcPreviewQueue_(plan.rows);
  assert.equal(plan.rows.length,103);assert.equal(plan.rows[100].status,'CANDIDATE_ONLY');
  assert.deepEqual(plain(result.rows.slice(0,3).map(row=>row.transaction)),['101','103','102']);
  assert.deepEqual(plain(result.queue),{total:103,candidates:1,review:1,unmatched:1,excluded:100,shown:100,limit:100,truncated:true});
  assert.equal(result.rows.length,100);assert.equal(JSON.stringify(plan),before);
});
test('preview counts all candidates when more than 100 are ready for review',()=>{
  const rows=Array.from({length:101},(_,i)=>({transaction:String(i+1),status:'CANDIDATE_ONLY'}));
  const result=load().rcPreviewQueue_(rows);
  assert.deepEqual(plain(result.queue),{total:101,candidates:101,review:0,unmatched:0,excluded:0,shown:100,limit:100,truncated:true});
  assert.equal(result.rows.at(-1).transaction,'100');
});
test('empty and exactly 100-row queues have honest nontruncated totals',()=>{
  const s=load();
  assert.deepEqual(plain(s.rcPreviewQueue_([])),{rows:[],queue:{total:0,candidates:0,review:0,unmatched:0,excluded:0,shown:0,limit:100,truncated:false}});
  const result=s.rcPreviewQueue_(Array.from({length:100},()=>({status:'UNMATCHED'})));
  assert.equal(result.queue.total,100);assert.equal(result.queue.shown,100);assert.equal(result.queue.truncated,false);
});
test('unknown status cannot silently disappear from the queue counts',()=>{
  const s=load();for(const value of [[{status:'PAID'}],[{status:'toString'}],[null],null])assert.throws(()=>s.rcPreviewQueue_(value),/preview/);
});

const paymentHeaders=['Payment_ID','Payment_Reference','Amount_CZK','Verification_Status','Expected_Amount_CZK','Private_Note'];
const bankHeaders=['Bank_Transaction_ID','VS','Amount_CZK','Currency','Private_Note'];
function fixture(options={}){
  const calls=[],start=Date.parse('2026-10-22T10:00:00.000Z');let clock=start;
  class FixtureDate extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
  const tables={Druzina_Payments:{headers:options.paymentHeaders||paymentHeaders,rows:options.payments||[payment()]},
    Druzina_Fio_Transactions:{headers:options.bankHeaders||bankHeaders,rows:options.transfers||[transfer()]}};
  const props={getProperty(key){calls.push('property:'+key);clock+=1000;return options.properties?.[key]??null;}};
  const ss={getUrl(){return 'https://example.test/synthetic-hub';},getSheetByName(name){
    calls.push('sheet:'+name);if(options.missing===name)return null;
    const table=tables[name];assert.ok(table,'unexpected sheet');
    return {getLastRow(){return table.rows.length+1;},getSheetId(){return 7;},getDataRange(){return {getValues(){calls.push('read:'+name);return [table.headers.slice(),...table.rows.map(row=>table.headers.map(key=>row[key]??''))];}};}};
  }};
  const s=load({Date:FixtureDate,SPREADSHEET_ID:'synthetic-hub',
    DriveApp:{Access:{PRIVATE:'private'},getFileById(id){assert.equal(id,'synthetic-hub');calls.push('owner');return {
      getOwner(){return {getEmail(){return 'owner@example.test';}};},getSharingAccess(){return options.shared?'public':'private';},getEditors(){return [];},getViewers(){return [];}
    };}},Session:{getActiveUser(){return {getEmail(){return options.notOwner?'other@example.test':'owner@example.test';}};}},
    SpreadsheetApp:{openById(id){assert.equal(id,'synthetic-hub');calls.push('open');return ss;}},
    PropertiesService:{getScriptProperties(){calls.push('properties');return props;}}
  },true);
  return {s,calls,clock:()=>clock,tables};
}
test('actual preview reads existing sheets, prioritizes rows and returns minimal read-only metadata',()=>{
  const transfers=Array.from({length:100},(_,i)=>transfer({Bank_Transaction_ID:String(i+1),Amount_CZK:-1,Private_Note:'synthetic-only'}));
  transfers.push(transfer({Bank_Transaction_ID:'101',Private_Note:'synthetic-only'}),{});
  const f=fixture({transfers,payments:[payment({Private_Note:'synthetic-only'}),{}]}),result=f.s.paymentReconciliationPreview();
  assert.equal(result.mode,'READ_ONLY');assert.equal(result.entity,'DRUZINA');assert.equal(result.settled,0);
  assert.equal(result.total,101);assert.equal(result.truncated,true);assert.equal(result.rows.length,100);
  assert.equal(result.rows[0].transaction,'101');assert.equal(result.rows[0].status,'CANDIDATE_ONLY');
  assert.deepEqual(plain(result.queue),{total:101,candidates:1,review:0,unmatched:0,excluded:100,shown:100,limit:100,truncated:true});
  assert.deepEqual(plain(result.bank),{configured:false,lastSuccess:'',fresh:false,balance:null});
  assert.equal(result.checkedAt,new Date(f.clock()).toISOString());
  assert.deepEqual(Object.keys(result).sort(),['bank','checkedAt','entity','mode','queue','rows','settled','total','truncated']);
  for(const row of result.rows)assert.deepEqual(Object.keys(row).sort(),['amount','payment','status','transaction']);
  assert.deepEqual(f.calls,['owner','open','sheet:Druzina_Payments','read:Druzina_Payments','sheet:Druzina_Fio_Transactions','read:Druzina_Fio_Transactions','properties','property:FIO_DRUZINA_LAST_OK_AT','property:FIO_DRUZINA_LAST_BANK_BALANCE','property:FIO_DRUZINA_READ_TOKEN']);
});
test('actual preview of header-only sheets reports an empty queue',()=>{
  const result=fixture({payments:[],transfers:[]}).s.paymentReconciliationPreview();
  assert.equal(result.total,0);assert.equal(result.truncated,false);assert.equal(result.rows.length,0);assert.equal(result.queue.shown,0);
});
test('actual preview preserves the existing bank importer offset timestamp format',()=>{
  const lastSuccess='2026-10-22T11:30:00+02:00';
  const result=fixture({properties:{FIO_DRUZINA_LAST_OK_AT:lastSuccess,FIO_DRUZINA_LAST_BANK_BALANCE:'120.50'}}).s.paymentReconciliationPreview();
  assert.deepEqual(plain(result.bank),{configured:false,lastSuccess,fresh:true,balance:120.5});
  assert.equal(result.checkedAt,'2026-10-22T10:00:03.000Z');
});
test('actual preview refuses non-owner or shared Hub before opening sheets',()=>{
  for(const options of [{notOwner:true},{shared:true}]){
    const f=fixture(options);assert.throws(()=>f.s.paymentReconciliationPreview(),/Owner/);assert.deepEqual(f.calls,['owner']);
  }
});
test('actual preview preserves missing and duplicate schema checks before reading bank state',()=>{
  for(const options of [{missing:'Druzina_Payments'},{missing:'Druzina_Fio_Transactions'},{paymentHeaders:paymentHeaders.filter(key=>key!=='Payment_ID')},{bankHeaders:[...bankHeaders,'VS']}]){
    const f=fixture(options);assert.throws(()=>f.s.paymentReconciliationPreview(),/missing|column/);assert.ok(!f.calls.includes('properties'));
  }
});
