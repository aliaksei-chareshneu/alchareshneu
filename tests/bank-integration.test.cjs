const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function load(extra={}){const s={...extra};vm.createContext(s);for(const f of ['FioOSVC.gs','FioDruzinaConsole.gs','PaymentReconciliation.gs'])vm.runInContext(fs.readFileSync(__dirname+'/../'+f,'utf8'),s);return s;}
test('NGO owner guard runs before reading configuration',()=>{let accessed=false;const s=load({ocOwner_:()=>{throw Error('owner');},PropertiesService:{getScriptProperties:()=>{accessed=true;}}});assert.throws(()=>s.fioSyncDruzinaReadOnly(),/owner/);assert.equal(accessed,false);});
function configured(values){return load({ocOwner_:()=>{},SPREADSHEET_ID:'fixture',PropertiesService:{getScriptProperties:()=>({getProperty:k=>values[k]||null})}});}
const base={FIO_DRUZINA_READ_TOKEN:'a'.repeat(64),FIO_DRUZINA_EXPECTED_ACCOUNT_ID:'12345678',FIO_DRUZINA_ENTITY_CONFIRMED:'true'};
test('NGO rejects OSVC account and token reuse',()=>{for(const other of [{FIO_OSVC_EXPECTED_ACCOUNT_ID:'12345678'},{FIO_OSVC_READ_TOKEN:'a'.repeat(64)}])assert.throws(()=>configured({...base,...other}).fioSyncDruzinaReadOnly(),/distinct/);});
test('NGO requires explicit entity confirmation',()=>assert.throws(()=>configured({...base,FIO_DRUZINA_ENTITY_CONFIRMED:'false'}).fioSyncDruzinaReadOnly(),/confirm/));
test('blank bank balance remains unknown for both entities',()=>{const s=load();for(const fn of [s.fioOsNormalizeStatement_,s.fioNgNormalizeStatement_])for(const b of ['', ' ',null,undefined])assert.equal(fn({accountStatement:{info:{bankId:'2010',accountId:'12345678',currency:'CZK',closingBalance:b},transactionList:{transaction:[]}}},'12345678').balance,null);});
test('amount outside safe integer precision is rejected',()=>{const s=load();for(const fn of [s.fioOsCents_,s.fioNgCents_])assert.throws(()=>fn('999999999999999'),/sub-cent/);});
test('NGO imports only to its own worksheet and uses no timers',()=>{const s=fs.readFileSync(__dirname+'/../FioDruzinaConsole.gs','utf8');assert.match(s,/Druzina_Fio_Transactions/);assert.doesNotMatch(s,/OSVC_Fio_Transactions|newTrigger|method: 'post'/);assert.match(s,/SpreadsheetApp.flush\(\)/);});
test('empty or duplicate payment headers cannot look like successful reconciliation',()=>{const s=load();assert.throws(()=>s.rcRequireHeaders_([],['Payment_ID']),/column/);assert.throws(()=>s.rcRequireHeaders_(['Payment_ID','Payment_ID'],['Payment_ID']),/column/);s.rcRequireHeaders_(['Payment_ID'],['Payment_ID']);});

function paymentRow({id='synthetic-payment',amount=120,expected='',status='PENDING',reference='00123'}={}){
  const row=Array(14).fill('');row[0]=id;row[3]=amount;row[7]=status;row[9]=reference;row[13]=expected;return row;
}
for(const [label,name] of [['OSVC','fioOsMatchCandidate_'],['DRUZINA','fioNgMatchCandidate_']]){
  test(label+': reused reference remains ambiguous even when only one amount matches',()=>{
    const match=load()[name]({cents:12000,vs:'123'},[paymentRow({id:'old',amount:240}),paymentRow({id:'new',amount:120})]);
    assert.equal(match.status,'AMBIGUOUS_REVIEW');assert.equal(match.paymentId,'');
  });
  test(label+': closed historical payment cannot hide a reused reference',()=>{
    const match=load()[name]({cents:12000,vs:'123'},[paymentRow({id:'old',status:' cancelled '}),paymentRow({id:'new'})]);
    assert.equal(match.status,'AMBIGUOUS_REVIEW');assert.equal(match.paymentId,'');
  });
  test(label+': closed statuses never become fresh candidates',()=>{
    const match=load()[name];
    for(const status of ['VERIFIED',' paid ',' settled ','cancelled','CANCELED','rejected','VOID']){
      const result=match({cents:12000,vs:'123'},[paymentRow({status})]);
      assert.equal(result.status,'EXISTING_STATUS_REVIEW',status);assert.equal(result.paymentId,'');
    }
  });
  test(label+': unique reference still requires an exact positive expected amount',()=>{
    const match=load()[name],tx={cents:12000,vs:'123'};
    for(const [expected,status] of [[240,'PARTIAL_REVIEW'],[60,'OVERPAYMENT_REVIEW'],[0,'INVALID_EXPECTED'],['1.2e2','INVALID_EXPECTED']]){
      const result=match(tx,[paymentRow({expected})]);assert.equal(result.status,status);assert.equal(result.paymentId,'');
    }
    const result=match(tx,[paymentRow({expected:'120,00'})]);assert.equal(result.status,'CANDIDATE_ONLY');assert.equal(result.paymentId,'synthetic-payment');
  });
  test(label+': references allow leading zeros but never more than ten digits',()=>{
    const match=load()[name],tx={cents:12000,vs:' 000123 '};
    assert.equal(match(tx,[paymentRow()]).status,'CANDIDATE_ONLY');
    for(const reference of ['00000000123','1.23e2',''])assert.equal(match({cents:12000,vs:reference},[paymentRow({reference})]).status,'UNMATCHED');
    assert.equal(match(tx,[paymentRow({reference:'00000000123'})]).status,'UNMATCHED');
  });
}
