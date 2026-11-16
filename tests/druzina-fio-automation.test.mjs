import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {moneyHalers,variableSymbol,parseFioStatement,planExactCredits}
 from '../supabase/functions/imperion-druzina-fio-reconcile/fio-matcher.mjs';
import {createTrainingSpd}
 from '../supabase/functions/imperion-register/training-qr.mjs';
import {inspectPaymentPdf}
 from '../supabase/functions/imperion-register/payment-pdf-review.mjs';

const bank={iban:'CZ0520100000002400222222',accountId:'2400222222',bankId:'2010'};
const now=new Date(),created=new Date(now.getTime()-86400000).toISOString();
const quote={id:'11111111-1111-4111-8111-111111111111',
  created_at:created,payment_variable_symbol:'7123456789',quoted_total_czk:240};
function tx({id='115028074',amount=240,vs=quote.payment_variable_symbol,currency='CZK',kind='Příchozí platba',at=Date.now()}={}){
 return {column22:{value:id},column0:{value:at},column1:{value:amount},
   column14:{value:currency},column5:{value:vs},column8:{value:kind}};
}
function fio(txs=[tx()],b=bank){
 return {accountStatement:{info:{iban:b.iban,accountId:b.accountId,bankId:b.bankId,
  currency:'CZK'},transactionList:{transaction:txs}}};
}
test('official Fio JSON shape matches exactly one settled CZK transfer with VS',()=>{
 const movements=parseFioStatement(fio(),bank);
 const p=planExactCredits(movements,[quote]);
 assert.equal(p.matches.length,1);assert.equal(p.manual.length,0);
 assert.equal(p.matches[0].movementId,'115028074');
 assert.equal(p.matches[0].amountCzk,240);
 assert.equal(p.matches[0].variableSymbol,'7123456789');
});
test('reject wrong receiving account, bankId, currency, missing body',()=>{
 for(const wrong of [{...bank,iban:'CZ0020100000002400222222'},
                     {...bank,accountId:'999999999'},
                     {...bank,bankId:'0800'}]){
  assert.throws(()=>parseFioStatement(fio(),wrong),/FIO_WRONG_RECEIVER/);
 }
 assert.throws(()=>parseFioStatement({},bank),/FIO_BAD_FORMAT/);
});
test('money is exact two-decimal CZK; no silent floating point correction',()=>{
 for(const [n,hal] of [['240',24000],['240.00',24000],['240.1',24010],['0.01',1],['-240.00',-24000]]){
  assert.equal(moneyHalers(n),hal);
 }
 for(const n of ['240.001','2.4e2','0xF0','NaN','1,00','9999999999'])
  assert.equal(moneyHalers(n),null);
});
test('partial, overpayment, debit, reversal and wrong-currency are manual',()=>{
 const cases=[
  {amount:239,reason:'AMOUNT_MISMATCH'},
  {amount:241,reason:'AMOUNT_MISMATCH'},
  {amount:-240,reason:'INVALID_CREDIT'},
  {amount:240,currency:'EUR',reason:'INVALID_CREDIT'},
  {amount:240,kind:'Storno převodu',reason:'INVALID_CREDIT'}
 ];
 for(const v of cases){
  const p=planExactCredits(parseFioStatement(fio([tx(v)]),bank),[quote]);
  assert.equal(p.matches.length,0,JSON.stringify(v));
  assert.equal(p.manual[0].reason,v.reason);
 }
});
test('two Fio movements on one VS must never auto-mark either as settled',()=>{
 const p=planExactCredits(parseFioStatement(fio([
  tx({id:'115028074'}),tx({id:'115028075',amount:240})]),bank),[quote]);
 assert.equal(p.matches.length,0);
 assert.equal(p.manual[0].reason,'AMBIGUOUS_VS');
});
test('conflicting reuse of one bank movement ID invalidates entire statement',()=>{
 assert.throws(()=>parseFioStatement(fio([
  tx({id:'115028074',amount:240}),tx({id:'115028074',amount:300})]),bank),
  /FIO_CONFLICTING_MOVEMENT/);
 const p=planExactCredits(parseFioStatement(fio([tx(),tx()]),bank),[quote]);
 assert.equal(p.matches.length,1); // duplicate identical row is one bank credit
});
test('wrong/missing VS and old movement dates never settle',()=>{
 const bad=planExactCredits(parseFioStatement(fio([tx({vs:'1010101010'})]),bank),[quote]);
 assert.equal(bad.matches.length,0);assert.equal(bad.unmatched,1);
 const old=planExactCredits(parseFioStatement(fio([tx({at:Date.now()-10*86400000})]),bank),[quote]);
 assert.equal(old.matches.length,0);
 assert.equal(old.manual[0].reason,'CREDIT_DATE_MISMATCH');
 assert.equal(variableSymbol('0000123'),'123');
 assert.equal(variableSymbol('DRU-123'),null);
});
test('new QR descriptor encodes bank-standard X-VS and preserves distinct UUID',()=>{
 const spd=createTrainingSpd(bank.iban,240,quote.id,quote.payment_variable_symbol);
 assert.match(spd,/^SPD\*1\.0\*ACC:CZ0520100000002400222222\*AM:240\.00\*CC:CZK\*MSG:DM /);
 assert.ok(spd.endsWith('*X-VS:7123456789'));
 assert.ok(spd.includes(quote.id.replace(/-/g,'').toUpperCase()));
 assert.equal(createTrainingSpd(bank.iban,240,quote.id,'not-digits'),null);
 assert.equal(createTrainingSpd(bank.iban,240,quote.id,'0123456789'),null);
});
test('all matching PDF text stays MATCHED_UNVERIFIED: never bankVerified',async()=>{
 const text='BT (Payment 240.00 CZK Druzina Moravy z. s. IBAN '+bank.iban+
   ' Variabilni symbol: '+quote.payment_variable_symbol+') Tj ET';
 const pdf=new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<< /Length '+text.length+' >>\nstream\n'+
  text+'\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
 const v=await inspectPaymentPdf(pdf,{amountCzk:240,iban:bank.iban,
  recipient:'Druzina Moravy z. s.',reference:quote.id,
  variableSymbol:quote.payment_variable_symbol});
 assert.equal(v.status,'MATCHED_UNVERIFIED');
 assert.equal(v.bankVerified,false);assert.equal(v.confirmed,false);
});
test('source protects same RSVP, one VS and bank movement with no automatic seat',()=>{
 const reg=fs.readFileSync('supabase/functions/imperion-register/index.ts','utf8'),
  bridge=fs.readFileSync('supabase/functions/imperion-intake-bridge/index.ts','utf8'),
  sync=fs.readFileSync('imperion-intake-sync.gs','utf8'),
  worker=fs.readFileSync('supabase/functions/imperion-druzina-fio-reconcile/index.ts','utf8'),
  mig=fs.readFileSync('supabase/migrations/20261116_druzina_fio_auto_reconcile.sql','utf8'),
  auth=fs.readFileSync('supabase/migrations/20261116_druzina_fio_due_cron.sql','utf8'),
  ui=fs.readFileSync('register/training-payment.js','utf8');
 assert.ok(reg.includes('payment_variable_symbol:generateVariableSymbol()'));
 assert.ok(reg.includes('variableSymbol:vs,spd'));
 assert.ok(reg.includes('payment_bank_check_after:new Date(Math.max('));
 assert.ok(ui.includes("'VS '+p.variableSymbol"));
 assert.ok(bridge.includes('payment_evidence_status.in.(PROOF_RECEIVED,BANK_VERIFIED)'));
 assert.ok(sync.includes("var verified=r.payment_evidence_status==='BANK_VERIFIED'"));
 assert.ok(sync.includes("Payment_Status:'VERIFIED'"));
 assert.ok(mig.includes('CREATE UNIQUE INDEX IF NOT EXISTS imperion_rsvp_fio_movement_id_uq'));
 assert.ok(mig.includes('CREATE UNIQUE INDEX IF NOT EXISTS imperion_rsvp_payment_variable_symbol_uq'));
 assert.ok(mig.includes('REVOKE ALL ON FUNCTION public.druzina_apply_fio_bank_credit'));
 assert.ok(worker.includes("Deno.env.get('DRUZINA_FIO_AUTOMATION_ENABLED')!=='YES'"));
 assert.ok(worker.includes("Deno.env.get('DRUZINA_FIO_READONLY_CONFIRMED')!=='YES'"));
 assert.ok(worker.includes("api.rpc('druzina_apply_fio_bank_credit'"));
 assert.ok(!worker.includes("method:'POST',headers:{Authorization:'Bearer '+token"));
 assert.ok(auth.includes("WHERE EXISTS("));
 assert.ok(auth.includes("payment_bank_check_after <= now()"));
 assert.doesNotThrow(()=>new Function(ui)); // browser syntax only
});
