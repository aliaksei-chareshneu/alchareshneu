'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');
const RAIF='7804336003/5500', RAIF_IBAN='CZ9755000000007804336003';
function validIban(iban){
 const rearranged=iban.slice(4)+iban.slice(0,4);
 let n=0;
 for(const c of rearranged){
   const digits=/[0-9]/.test(c)?c:String(c.charCodeAt(0)-55);
   for(const digit of digits)n=(n*10+Number(digit))%97;
 }
 return n===1;
}
test('verified Raiffeisen account is consistent across personal commercial checkout surfaces',()=>{
 const main=read('walkers/index.html');
 const dialog=read('conversion-frontdoor.js');
 const server=read('supabase/functions/imperion-register/index.ts');
 const academy=read('supabase/functions/imperion-academy-checkout/index.ts');
 assert.ok(validIban(RAIF_IBAN));
 assert.equal(main.split(RAIF).length-1,5,'five four-language walkers FAQs use the bank');
 for(const locale of ['cs','en','ru','uk']) assert.ok(dialog.includes(locale+":'OSVČ Aliaksei Chareshneu"),locale);
 assert.ok(dialog.includes("['Aliaksei Chareshneu (OSVČ)','Aliaksei Chareshneu (OSVČ, IČO 23041625)'].includes(e.data_controller)"),'both legal sole-trader spellings receive Raiffeisen');
 assert.ok(dialog.includes(RAIF)&&dialog.includes(RAIF_IBAN));
 assert.ok(server.includes("Deno.env.get('OSVC_APPROVED_IBAN') || '"+RAIF_IBAN+"'"));
 assert.ok(server.includes("Deno.env.get('OSVC_APPROVED_PAYEE') || 'Aliaksei Chareshneu'"));
 assert.ok(!server.includes('DRUZINA_APPROVED_IBAN'),'NGO account must never enter client-facing quote code');
 assert.ok(server.includes("nonprofit_checkout_disabled"),'legacy association checkout blocked');
 assert.ok(server.includes("sessionPaymentOpen:false"),'nonprofit catalogue cannot solicit a transfer');
 assert.ok(server.includes('verifiedBankIban(verifiedQuote.account,verifiedQuote.recipient'));
 assert.ok(server.includes("if(!approved)return reply({error:'personal_confirmation_pending'"));
 assert.ok(academy.includes('quote_account'),'academy displays individually approved account, not a guessed default');
 assert.doesNotMatch(main,/revolut\.me\/aliaksj5pq/);
});
test('announcement generator sends personal Raiffeisen only for BrnoWalkers, never nonprofit',()=>{
 const code=read('Code.gs');
 const personalStart=code.indexOf("var IMP_OSVC_RAIF_ACCOUNT");
 const personalEnd=code.indexOf('// Роутинг канала по клубу',personalStart);
 const localStart=code.indexOf('function paymentPhraseLocalized(');
 const localEnd=code.indexOf('function socialLabels(lang)',localStart);
 assert.ok(personalStart>0&&personalEnd>personalStart&&localEnd>localStart);
 const evalSource=code.slice(personalStart,personalEnd)+'\n'+code.slice(localStart,localEnd);
 const functions=Function(evalSource+'\nreturn {paymentPhrase,paymentPhraseLocalized};')();
 assert.doesNotMatch(code,/revolut\.me\/aliaksj5pq/);
 assert.ok(code.includes('buildWhatsAppCopy(community, category'));
 assert.ok(code.includes("paymentPhraseLocalized(category, isFree, price, 'en', community)"));
 for(const lang of ['cs','en','ru','uk']){
   const osvc=functions.paymentPhraseLocalized('Guided Walk',false,190,lang,'Brnowalkers');
   const ngo=functions.paymentPhraseLocalized('HEMA Training',false,240,lang,'Družina Moravy');
   const free=functions.paymentPhraseLocalized('Board Games',true,0,lang,'Brnowalkers');
   assert.ok(osvc.includes(RAIF),lang);
   assert.ok(!ngo.includes(RAIF),lang+' nonprofit must not use personal account');
   assert.ok(!free.includes(RAIF),lang+' free event does not solicit payment');
 }
 assert.match(functions.paymentPhrase('Guided Walk',false,190,'Brnowalkers'),/7804336003\/5500/);
 assert.doesNotMatch(functions.paymentPhrase('HEMA Training',false,240,'Družina Moravy'),/7804336003/);
});

test('Academy never publishes an approved quotation for the wrong bank or legal recipient',()=>{
 const edge=read('supabase/functions/imperion-academy-checkout/index.ts');
 const start=edge.indexOf('const OSVC_APPROVED_ACCOUNT=');
 const end=edge.indexOf('const MAX_PDF_BYTES=',start);
 const approve=edge.indexOf('function approvedQuote(');
 const approveEnd=edge.indexOf('async function quote(',approve);
 assert.ok(start>0&&end>start&&approve>0&&approveEnd>approve);
 const source=(edge.slice(start,end)+'\n'+edge.slice(approve,approveEnd))
  .replace('function osvcBankMatches(x:Record<string,unknown>)','function osvcBankMatches(x)')
  .replace('function approvedQuote(x:Record<string,unknown>)','function approvedQuote(x)');
 const {approvedQuote}=Function(source+'\nreturn {approvedQuote};')();
 const quote={payment_quote_status:'APPROVED',payment_evidence_status:'AWAITING_PROOF',
   quote_locked_at:'2026-11-22T00:00:00Z',quote_expires_at:'2100-01-01T00:00:00Z',
   quoted_amount_czk:400,quote_recipient:'Aliaksei Chareshneu',
   quote_account:'7804336003/5500'};
 assert.equal(approvedQuote(quote),true);
 assert.equal(approvedQuote({...quote,quote_account:RAIF_IBAN}),true);
 assert.equal(approvedQuote({...quote,quote_account:'19-2000145399/0800'}),false);
 assert.equal(approvedQuote({...quote,quote_recipient:'Družina Moravy, z. s.'}),false);
 assert.equal(approvedQuote({...quote,payment_quote_status:'NOT_QUOTED'}),false);
 assert.equal(approvedQuote({...quote,payment_evidence_status:'BANK_VERIFIED'}),true);
});

test('approved QR encodes Raiffeisenbank and rejects association/personal bank mixup',async()=>{
 const {pathToFileURL}=require('node:url'),path=require('node:path');
 const qr=await import(pathToFileURL(path.resolve('supabase/functions/imperion-register/training-qr.mjs')).href);
 assert.equal(qr.verifiedBankIban(RAIF,'Aliaksei Chareshneu',RAIF_IBAN,'Aliaksei Chareshneu'),RAIF_IBAN);
 assert.equal(qr.verifiedBankIban(RAIF,'Družina Moravy, z. s.',RAIF_IBAN,'Aliaksei Chareshneu'),null);
 assert.equal(qr.verifiedBankIban('2703598853/2010','Aliaksei Chareshneu',RAIF_IBAN,'Aliaksei Chareshneu'),null);
 const spd=qr.createTrainingSpd(RAIF_IBAN,190,'11111111-1111-4111-8111-111111111111','1234567890','BW');
 assert.ok(spd.includes('ACC:'+RAIF_IBAN));
 assert.ok(spd.includes('*AM:190.00'));
 assert.ok(spd.includes('*X-VS:1234567890'));
});
