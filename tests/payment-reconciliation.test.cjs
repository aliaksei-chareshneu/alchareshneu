const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s={};vm.createContext(s);vm.runInContext(fs.readFileSync(__dirname+'/../PaymentReconciliation.gs','utf8'),s);
const p=(x={})=>({Payment_ID:'p1',Payment_Reference:'00123',Amount_CZK:120,Verification_Status:'PENDING',...x});
const t=(x={})=>({Bank_Transaction_ID:'1001',VS:'123',Amount_CZK:120,Currency:'CZK',...x});
const status=(ps=[p()],ts=[t()])=>s.rcPlan_(ps,ts).rows[0].status;
test('exact amount/reference is candidate, never settled',()=>{let r=s.rcPlan_([p()],[t()]);assert.equal(r.rows[0].status,'CANDIDATE_ONLY');assert.equal(r.settled,0);});
test('reused reference across closed and pending orders is ambiguous',()=>assert.equal(status([p(),p({Payment_ID:'p2',Verification_Status:'PAID'})]),'AMBIGUOUS_REFERENCE'));
test('two transfers cannot silently pay one order twice',()=>assert.ok(s.rcPlan_([p()],[t(),t({Bank_Transaction_ID:'1002'})]).rows.every(r=>r.status==='MULTIPLE_TRANSFERS_REVIEW')));
test('partial and excess payments need review',()=>{assert.equal(status([p()],[t({Amount_CZK:60})]),'PARTIAL_REVIEW');assert.equal(status([p()],[t({Amount_CZK:140})]),'OVERPAYMENT_REVIEW');});
test('duplicate imported bank ID fails',()=>assert.throws(()=>s.rcPlan_([p()],[t(),t()]),/duplicate/));
test('duplicate payment ID fails',()=>assert.throws(()=>s.rcPlan_([p(),p()],[t()]),/duplicate/));
test('missing expected amount cannot become zero',()=>assert.equal(status([p({Amount_CZK:''})]),'INVALID_EXPECTED'));
test('already verified record not reused',()=>assert.equal(status([p({Verification_Status:'VERIFIED'})]),'EXISTING_STATUS_REVIEW'));
test('UNVERIFIED does not match VERIFIED substring',()=>assert.equal(status([p({Verification_Status:'UNVERIFIED'})]),'CANDIDATE_ONLY'));
test('currency and debit are never income matches',()=>{assert.equal(status([p()],[t({Currency:'EUR'})]),'CURRENCY_REVIEW');assert.equal(status([p()],[t({Amount_CZK:-120})]),'DEBIT_OR_ZERO');});
test('no reference means no guessed matching by amount',()=>assert.equal(status([p()],[t({VS:''})]),'UNMATCHED'));
test('planning is deterministic and does not mutate input',()=>{let ps=[p()],ts=[t()],before=JSON.stringify([ps,ts]);assert.equal(JSON.stringify(s.rcPlan_(ps,ts)),JSON.stringify(s.rcPlan_(ps,ts)));assert.equal(JSON.stringify([ps,ts]),before);});
test('closed statuses retain protection with surrounding whitespace and mixed case',()=>{
  for(const value of [' PAID ','VERIFIED\n','\tSettled ',' cancelled ','CANCELED\r\n',' REJECTED ',' void '])
    assert.equal(status([p({Verification_Status:value})]),'EXISTING_STATUS_REVIEW',value);
  assert.equal(status([p({Verification_Status:' UNVERIFIED\n'})]),'CANDIDATE_ONLY');
});
test('strict amount parsing supports signed decimal text, comma fractions and numbers',()=>{
  for(const [input,cents] of [[0,0],[120,12000],[1.15,115],[-12.34,-1234],[' +00120,50 ',12050],['-0,01',-1],['120.5',12050],['00120',12000]])
    assert.equal(s.rcCents_(input),cents,String(input));
  assert.equal(status([p({Amount_CZK:'120,50'})],[t({Amount_CZK:120.5})]),'CANDIDATE_ONLY');
});
test('amounts reject coercible objects, alternate bases, exponent text and sub-cent values',()=>{
  const invalid=[true,false,[],[120],{},new Number(120),{toString(){throw Error('must not coerce');}},NaN,Infinity,-Infinity,
    '0x78','0b1111000','0o170','1.2e2','120E0','120.','120,','1,200.00','1 200','120.000','120.001','120.00000001',120.00000001,0.001];
  for(const value of invalid)assert.throws(()=>s.rcCents_(value),/Invalid amount/);
  for(const value of [null,undefined,'',' \t\n'])assert.throws(()=>s.rcCents_(value),/Missing amount/);
});
test('invalid imported and expected amounts cannot become payment candidates',()=>{
  for(const amount of ['0x78','1.2e2','120.000',120.00000001,true]){
    assert.equal(status([p()],[t({Amount_CZK:amount})]),'INVALID_AMOUNT');
    assert.equal(status([p({Expected_Amount_CZK:amount})]),'INVALID_EXPECTED');
  }
});
test('amounts require safe cents and an unchanged numeric report round-trip',()=>{
  for(const value of ['90071992547409.91','-90071992547409.91','90071992547409.92','90071992547410',Number.MAX_SAFE_INTEGER])
    assert.throws(()=>s.rcCents_(value),/Invalid amount/);
  for(const value of ['90071992547409.90','-90071992547409.90','90071992547409.89',90071992547409.9]){
    const cents=s.rcCents_(value);
    assert.ok(Number.isSafeInteger(cents));
    assert.equal(s.rcCents_(cents/100),cents);
  }
  assert.equal(status([p()],[t({Amount_CZK:'90071992547409.91'})]),'INVALID_AMOUNT');
  assert.equal(status([p({Expected_Amount_CZK:'90071992547409.91'})]),'INVALID_EXPECTED');
});
