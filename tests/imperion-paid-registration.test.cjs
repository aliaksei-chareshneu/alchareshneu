'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=path=>fs.readFileSync(path,'utf8');
const front=read('register/index.html');
const gate=read('register/payment-gate.js');
const server=read('supabase/functions/imperion-register/index.ts');
const proof=read('supabase/functions/imperion-payment-proof/index.ts');
const db=read('supabase/migrations/20261103_imperion_payment_proofs_and_packages.sql');
const gallery=read('academy/courses/visual.js');
const courses=read('academy/courses/index.html');

test('31 courses retain original content behind a visual-first accessible layout',()=>{
 const cards=[...courses.matchAll(/<article class="course"/g)].length;
 assert.equal(cards,31,'All courses must be preserved');
 assert.ok(courses.includes('./visual.css')&&courses.includes('./visual.js'));
 assert.ok(gallery.includes('document.querySelectorAll(\'#catalog article.course\')'));
 assert.ok(gallery.includes("document.createElement('details')"));
 assert.ok(gallery.includes("document.createElement('img')"));
 assert.ok(gallery.includes("galleryPhotos"));
 new vm.Script(gallery);
 new vm.Script(gate);
 assert.ok(read('academy/courses/visual.css').includes('-webkit-line-clamp'));
});
test('the same localized client enforces proof before paid RSVP',()=>{
 const pages=['register/index.html','register/en/index.html','register/ru/index.html','register/uk/index.html'];
 const scripts=pages.map(page=>{
  const html=read(page);
  assert.ok(html.includes('payment-gate.css')&&html.includes('payment-gate.js'));
  assert.ok(html.includes('ImperionPayment?.update(e,mode,lang)'));
  assert.ok(html.includes('ImperionPayment?.prepare(body,events.find'));
  assert.ok(html.includes('ImperionPayment?.receipt(payload,lang)'));
  assert.ok(!html.includes('SUPABASE_SERVICE_ROLE_KEY'));
  const match=html.match(/<script>\s*('use strict';[\s\S]*?)\s*<\/script>/);
  assert.ok(match,'inline client script exists');
  new vm.Script(match[1]);
  return match[1];
 });
 for(const s of scripts)assert.equal(s,scripts[0],'shared registration JS cannot drift');
 assert.ok(gate.includes("event.payment_gate_mode==='PROOF_OR_PACKAGE'"));
 assert.ok(gate.includes("await fetch(ENDPOINT"));
 assert.ok(gate.includes("body.paymentEvidenceId=data.evidenceId"));
 assert.ok(gate.includes("body.packageCode=code"));
 assert.ok(gate.includes("!['application/pdf','image/png','image/jpeg','image/webp']"));
});
test('server never accepts payment claims from a forged direct POST',()=>{
 assert.ok(server.includes("event.payment_gate_mode==='PROOF_OR_PACKAGE'"));
 assert.ok(server.includes("error:'payment_proof_required'"));
 assert.ok(server.includes("imperion_reserve_package_registration"));
 assert.ok(server.includes("payment_gate:'PROOF_PENDING'"));
 assert.ok(server.includes("status:'PAYMENT_PENDING_VERIFICATION'"));
 assert.ok(server.includes("payment_gate:price>0?'INQUIRY_NO_PAYMENT':'FREE'"));
 assert.ok(server.includes(".eq('data_controller',event.data_controller)"));
 assert.ok(server.includes("!['PENDING_BANK_REVIEW','VERIFIED'].includes(proof.review_status)"));
 assert.ok(proof.includes(".eq('payment_gate_mode','PROOF_OR_PACKAGE')"));
 assert.ok(proof.includes("review_status:'PENDING_BANK_REVIEW'"));
 assert.ok(proof.includes("bank_transaction_matched:false"));
 assert.ok(proof.includes("MIME[file.type].check(bytes)"));
 assert.ok(proof.includes("file_sha256"));
 assert.ok(proof.includes("imperion_rsvp_allow_request"));
 assert.ok(!proof.includes("storage.from(BUCKET).getPublicUrl"));
});
test('ledger and private file storage require bank evidence and attendance readback',()=>{
 assert.ok(db.includes("payment_gate_mode text not null default 'NONE'"));
 assert.ok(db.includes("public.imperion_paid_packages"));
 assert.ok(db.includes("public.imperion_payment_evidence"));
 assert.ok(db.includes("public.imperion_package_visits"));
 assert.ok(db.includes("imperion_reserve_package_registration"));
 assert.ok(db.includes("for update"));
 assert.ok(db.includes("public.imperion_set_package_visit_state"));
 assert.ok(db.includes("v_visit.state<>'RESERVED'"));
 assert.ok(db.includes("consumed_at=now()"));
 assert.ok(db.includes("public.imperion_package_balances"));
 assert.ok(db.includes("review_status <> 'VERIFIED'"));
 assert.ok(db.includes("bank_transaction_reference is not null"));
 assert.ok(db.includes("imperion-payment-private','imperion-payment-private',false"));
 assert.ok(db.includes("enable row level security"));
 assert.ok(db.includes("from PUBLIC,anon,authenticated"));
 assert.ok(!db.includes("to anon;"));
});
test('privacy disclosure for payments is present in all four languages',()=>{
 const page=read('register/privacy/index.html');
 for(const lang of ['cs','en','ru','uk']){
  const section=page.split('<section id="'+lang+'"')[1]?.split('</section>')[0]||'';
  assert.ok(section.includes('90'),'event evidence retention '+lang);
  assert.ok(section.includes('OSVČ')||section.includes('OSVČ'),'organiser separation '+lang);
 }
});
