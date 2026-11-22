'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const edge=fs.readFileSync('supabase/functions/imperion-register/index.ts','utf8');
const ui=fs.readFileSync('register/training-payment.js','utf8');
const crm=fs.readFileSync('imperion-intake-sync.gs','utf8');
const bridge=fs.readFileSync('supabase/functions/imperion-intake-bridge/index.ts','utf8');
const sql=fs.readFileSync('supabase/migrations/20261119_unified_osvc_paid_events.sql','utf8');
const fio=fs.readFileSync('supabase/functions/imperion-druzina-fio-reconcile/index.ts','utf8');
test('OSVC tour receives a separate quote and evidence workflow, NOT NGO bank config',()=>{
 for(const s of ["data_controller!=='Aliaksei Chareshneu (OSVČ)'",
   "Deno.env.get('OSVC_APPROVED_IBAN')",
   "nonprofit_checkout_disabled",
   "Deno.env.get('OSVC_APPROVED_PAYEE')",
   "isOsVc?OSVC_PROOF_BUCKET:PROOF_BUCKET",
   "publicTrainingQuote(e)||publicOsVcQuote(e)",
   "paymentEvidenceStatus:'PROOF_RECEIVED',bankVerified:false",
   "osvc_authorized_at","!isOsVc&&savedTier==='STARTER4'"])
   assert.ok(edge.includes(s),s);
 assert.match(edge,/if\(proof&&\(!resumeToken\|\|!payment\)\)/);
 assert.ok(sql.includes('osvc_payment_open boolean NOT NULL DEFAULT false'));
 assert.ok(!sql.includes('fio_bank_credit')&&!sql.includes('auto-confirm'));
});
test('PDF status from an independent bank is never inferred from document text',()=>{
 assert.ok(edge.includes('inspectPaymentPdf(bytes'));
 assert.ok(edge.includes('MATCHED_UNVERIFIED')===false);
 assert.ok(!edge.includes("payment_evidence_status:'BANK_VERIFIED'"));
 assert.ok(edge.includes("payment_evidence_status:'PROOF_RECEIVED'"));
 const statusBranch=edge.slice(edge.indexOf("if(body.action==='status')"),edge.indexOf("if (body.intent==='DRUZINA_ENQUIRY')"));
 assert.match(statusBranch,/bankVerified:!!data\.bank_verified_at,\s*confirmed:false\},200,origin\)/);
});
test('same-row CRM receives review type and owner check without rewriting bank as paid',()=>{
 for(const s of ['payment_pdf_review_status','impUpdateExistingRsvpProof_',
   "PDF_Review_Status:r.payment_pdf_review_status",
   "Owner_Bank_Check:verified?'BANK_VERIFIED':'CHECK_BANK_CREDIT'",
   "Proof_Alert_Status","Proof_Alert_Sent_At",
   "Payment_Evidence_Status:verified?'BANK_VERIFIED':'PROOF_RECEIVED'"])
   assert.ok((bridge+crm).includes(s),s);
 assert.ok(crm.includes("var proofAlerts=impSendProofReviewAlerts_(ss,cfg)"));
 assert.ok(crm.includes("MailApp.sendEmail({to:cfg.email"));
 assert.ok(crm.includes("sh.getRange(i+2,m.Proof_Alert_Status+1).setValue('DISPATCH_STARTED')"));
 assert.ok(crm.includes("'DELIVERY_UNCERTAIN'"));
 assert.ok(crm.includes("...(verified?{Bank_Verified_At:impDate_(r.bank_verified_at),Payment_Status:'VERIFIED'}:{})")); // only separately bank-verified rows
});
test('four public forms share the same private PDF check and no bank-paid promises',()=>{
 assert.doesNotThrow(()=>new Function(ui));
 for(const lang of ['','en/','ru/','uk/']){
  const html=fs.readFileSync('register/'+lang+'index.html','utf8');
  assert.ok(html.includes('id="paymentProof"'),lang);
  assert.ok(html.includes('id="paymentStatusButton"'),lang);
  assert.ok(html.includes('training-payment.js'),lang);
 }
});
test('existing NGO Fio worker does not depend on OSVC routes, owner email or PDF alerts',()=>{
 assert.ok(fio.includes("Družina Moravy, z. s."));
 assert.ok(!fio.includes('osvc_apply_fio_bank_credit'));
 assert.ok(!fio.includes('impSendProofReviewAlerts_'));
});
test('QR payment identifiers remain seller-distinct for manual bank verification',async()=>{
 const qr=await import(pathToFileURL(path.resolve('supabase/functions/imperion-register/training-qr.mjs')).href);
 const iban='CZ6508000000192000145399',ref='11111111-1111-4111-8111-111111111111';
 const osvc=qr.createTrainingSpd(iban,190,ref,'1234567890','BW');
 const ngo=qr.createTrainingSpd(iban,240,ref,'1234567891');
 assert.match(osvc,/\*MSG:BW /);assert.match(ngo,/\*MSG:DM /);
 assert.match(osvc,/\*X-VS:1234567890/);
 assert.equal(qr.createTrainingSpd(iban,190,ref,'1234567890','INVALID'),null);
});
