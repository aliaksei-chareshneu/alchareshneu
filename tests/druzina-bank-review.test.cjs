'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../DruzinaFioBridge.gs'),'utf8'),ctx);
const expected={accountId:'123456789',bankId:'2010'};
const order={Quote_ID:'SYNTHETIC-Q1',Payment_Reference:'1234567890',Expected_Amount_CZK:240,
 Status:'OPEN',Expires_At:'2099-01-01T00:00:00Z'};
function tx(change={}){return {column22:{value:'1000000009'},column1:{value:'240.00'},
 column5:{value:'1234567890'},column14:{value:'CZK'},column8:{value:'Příjem převodem'},
 column10:{value:'PRIVATE PAYER MUST NOT LEAK'},...change};}
function statement(rows){return {accountStatement:{info:{...expected,currency:'CZK'},transactionList:{transaction:rows}}};}
const plan=(rows,orders=[order],used=[])=>ctx.drufPlanStatementReview(statement(rows),expected,orders,used);
test('exact synthetic readback produces a candidate, zero settlement and no private payer fields',()=>{
 const r=plan([tx()]);assert.equal(r.candidateCount,1);assert.equal(r.settlements,0);
 assert.equal(r.previewOnly,true);assert.doesNotMatch(JSON.stringify(r),/PRIVATE PAYER|123456789\/2010/);
});
test('partial, excess, invalid VS, refund and bad currency always require manual review',()=>{
 for(const [change,reason] of [
  [{column1:{value:120}},'PARTIAL_PAYMENT'],[{column1:{value:241}},'OVERPAYMENT'],
  [{column5:{value:'wrong'}},'INVALID_VS'],[{column5:{value:'1111111111'}},'UNMATCHED_VS'],
  [{column1:{value:-240}},'DEBIT_OR_REFUND'],[{column8:{value:'Storno'}},'DEBIT_OR_REFUND'],
  [{column14:{value:'EUR'}},'INVALID_AMOUNT_OR_CURRENCY'],
  [{column1:{value:'240.001'}},'INVALID_AMOUNT_OR_CURRENCY']
 ]){const r=plan([tx(change)]);assert.equal(r.rows[0].reason,reason);assert.equal(r.candidateCount,0);}
});
test('duplicate bank payloads deduplicate but conflicting same-ID records block',()=>{
 assert.equal(plan([tx(),tx()]).rows.length,1);
 const r=plan([tx(),tx({column1:{value:241}})]);
 assert.equal(r.code,'CONFLICTING_BANK_TRANSACTION');assert.equal(r.settlements,0);
});
test('two credits for one order, duplicate VS orders, expired and cancelled orders never auto-match',()=>{
 const two=plan([tx(),tx({column22:{value:'1000000010'}})]);
 assert.equal(two.reviewCount,2);assert.equal(two.candidateCount,0);
 assert.equal(plan([tx()],[order,{...order,Quote_ID:'Q2'}]).rows[0].reason,'AMBIGUOUS_VS');
 for(const change of [{Expires_At:'invalid'},{Expires_At:'2020-01-01'},{Status:'CANCELLED'}]){
  assert.equal(plan([tx()],[{...order,...change}]).rows[0].reason,'ORDER_NOT_OPEN_OR_EXPIRED');
 }
});
test('repeated synchronization records replay and wrong recipient blocks the entire statement',()=>{
 assert.equal(plan([tx()],[order],['1000000009']).rows[0].classification,'ALREADY_RECORDED');
 const s=statement([tx()]);s.accountStatement.info.accountId='999';
 assert.equal(ctx.drufPlanStatementReview(s,expected,[order],[]).code,'WRONG_FIO_SETTLEMENT_ACCOUNT');
});
test('malformed expiration is rejected for exact matching and QR instructions',()=>{
 const q={...order,Expires_At:'invalid'};
 assert.equal(ctx.drufBankMatch({accountKey:'123456789/2010',variableSymbol:'1234567890',
 currency:'CZK',direction:'CREDIT',transactionId:'1000000009',amountCZK:240,amountHalers:24000},q,'123456789/2010',[]).code,'QUOTE_EXPIRED');
 // Pure test of a future reviewed release only. Real production constant stays false.
 vm.runInContext('const DRUS_PAID_BANK_ADAPTER_LIVE=true;',ctx);ctx.drusPaidRelease_=()=>({ok:true});
 assert.equal(ctx.drufBankInstructions(q,{iban:'CZ6508000000192000145399',verifiedLegalPayee:true,
 verifiedReadOnlyBankAccount:true,paidBookingLiveApproved:true}).code,'QUOTE_EXPIRED_OR_NOT_OPEN');
});
test('provider failure never exposes its token-bearing URL in a returned error',()=>{
 const values={DRU_FIO_READONLY_TOKEN:'Q'.repeat(64),DRU_FIO_ACCOUNT_ID:'123456789',
  DRU_FIO_BANK_ID:'2010',DRU_FIO_READONLY_CONFIRMED:'YES'};
 ctx.requireOwner_=()=>{};
 ctx.PropertiesService={getScriptProperties:()=>({getProperty:k=>values[k]||''})};
 ctx.Utilities={formatDate:()=> '2026-11-02'};
 ctx.UrlFetchApp={fetch:url=>{throw Error('Network failure '+url)}};
 const result=ctx.drufReadOnlyPreview();
 assert.equal(result.code,'FIO_API_TEMPORARILY_UNAVAILABLE');
 assert.ok(!JSON.stringify(result).includes(values.DRU_FIO_READONLY_TOKEN));
});
