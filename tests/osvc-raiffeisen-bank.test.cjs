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
 assert.match(dialog,/e\.data_controller==='Aliaksei Chareshneu \(OSVČ\)'/);
 assert.ok(dialog.includes(RAIF)&&dialog.includes(RAIF_IBAN));
 assert.ok(server.includes("Deno.env.get('OSVC_APPROVED_IBAN') || '"+RAIF_IBAN+"'"));
 assert.ok(server.includes("Deno.env.get('OSVC_APPROVED_PAYEE') || 'Aliaksei Chareshneu'"));
 assert.ok(server.includes("Deno.env.get('DRUZINA_APPROVED_IBAN') || 'CZ4220100000002703598853'"));
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
