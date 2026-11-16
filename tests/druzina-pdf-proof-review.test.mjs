import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {deflateSync} from 'node:zlib';
import {inspectPaymentPdf} from '../supabase/functions/imperion-register/payment-pdf-review.mjs';
const quote={amountCzk:240,iban:'CZ6508000000192000145399',
  recipient:'Družina Moravy z. s.',reference:'11111111-1111-4111-8111-111111111111'};
function pdf(text,{compressed=false,active=false,encrypt=false}={}){
 const stream=Buffer.from('BT ('+text+') Tj ET');
 const inner=compressed?deflateSync(stream):stream;
 const prefix=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Page /Length '+inner.length+
  (compressed?' /Filter /FlateDecode':'')+(active?' /OpenAction 2 0 R':'')+
  (encrypt?' /Encrypt 2 0 R':'')+' >>\nstream\n');
 return new Uint8Array(Buffer.concat([prefix,inner,
  Buffer.from('\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n')]));
}
const info='Payment 240.00 CZK to Druzina Moravy z. s. IBAN CZ6508000000192000145399 Reference DM 11111111111141118111111111111111';
test('text PDF can match quote but never verify bank credit or booking',async()=>{
 const v=await inspectPaymentPdf(pdf(info),quote);
 assert.equal(v.status,'MATCHED_UNVERIFIED');
 assert.equal(v.bankVerified,false);assert.equal(v.confirmed,false);
 assert.deepEqual(v.flags,[]);
});
test('bounded extraction supports compressed FlateDecode',async()=>{
 const v=await inspectPaymentPdf(pdf(info,{compressed:true}),quote);
 assert.equal(v.status,'MATCHED_UNVERIFIED',JSON.stringify(v));
});
test('wrong or missing reference and amount stay in manual review',async()=>{
 const v=await inspectPaymentPdf(pdf('Transfer 240.00 CZK to Druzina Moravy z. s. CZ6508000000192000145399'),quote);
 assert.equal(v.status,'NEEDS_MANUAL_REVIEW');
 assert.ok(v.flags.includes('REFERENCE_NOT_FOUND'));
 const w=await inspectPaymentPdf(pdf(info.replace('240.00','2400.00')),quote);
 assert.equal(w.status,'NEEDS_MANUAL_REVIEW');
 assert.ok(w.flags.includes('AMOUNT_NOT_FOUND'));
});
test('image-only, encoded text and malformed streams fall back to manual review',async()=>{
 const v=await inspectPaymentPdf(pdf(''),quote);
 assert.equal(v.status,'NEEDS_MANUAL_REVIEW');
 assert.ok(v.flags.includes('TEXT_UNAVAILABLE'));
});
test('reject truncated, active and encrypted documents',async()=>{
 await assert.rejects(()=>inspectPaymentPdf(pdf(info).slice(0,-9),quote),/INVALID_PDF_STRUCTURE/);
 await assert.rejects(()=>inspectPaymentPdf(pdf(info,{active:true}),quote),/UNSAFE_PDF_FEATURE/);
 await assert.rejects(()=>inspectPaymentPdf(pdf(info,{encrypt:true}),quote),/UNSAFE_PDF_FEATURE/);
});
test('reject invalid amount, invalid quote identity and bad input',async()=>{
 await assert.rejects(()=>inspectPaymentPdf(pdf(info),{...quote,amountCzk:0}),/INVALID_APPROVED_QUOTE/);
 await assert.rejects(()=>inspectPaymentPdf(pdf(info),{...quote,reference:'0'}),/INVALID_APPROVED_QUOTE/);
 await assert.rejects(()=>inspectPaymentPdf(new Uint8Array(150),quote),/INVALID_PDF_STRUCTURE/);
});
test('decompression expansion exceeding cap cannot match or auto approve',async()=>{
 const v=await inspectPaymentPdf(pdf(info+' '.repeat(300000),{compressed:true}),quote);
 assert.equal(v.status,'NEEDS_MANUAL_REVIEW');
 assert.ok(v.flags.includes('TEXT_UNAVAILABLE'));
});
test('backend retains proof-only state and duplicate-hash guard',async()=>{
 const {readFileSync}=await import('node:fs');
 const edge=readFileSync('supabase/functions/imperion-register/index.ts','utf8');
 for(const needle of ['inspectPaymentPdf','payment_pdf_review_status:review.status',
  'payment_pdf_review_flags:review.flags','duplicate_payment_pdf',
  'payment_evidence_status:\'PROOF_RECEIVED\'','bankVerified:false']){
   assert.ok(edge.includes(needle),needle);
 }
 assert.ok(!edge.includes('bank_verified_at:new Date()'));
});