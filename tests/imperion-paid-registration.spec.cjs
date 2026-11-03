const {test,expect}=require('@playwright/test');
const registrar='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
const proof='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-payment-proof';
const start=new Date(Date.now()+20*86400000).toISOString();
const end=new Date(Date.now()+20*86400000+5400000).toISOString();
const base={event_id:'PUB-HEMA-20991201',title:'Synthetic verified-price HEMA',
 community:'Družina Moravy',category:'HEMA Training',begins_at:start,ends_at:end,
 venue:'Synthetic studio, Brno',data_controller:'Družina Moravy, z. s.',
 rules_url:'https://aliaksei-chareshneu.github.io/alchareshneu/druzina/safety/',
 price_verified:true,end_time_verified:true,public_listing:true,source_active:true,
 is_open:true,registration_mode:'FORM',contact_activity:true};
const paid={...base,price_czk:240,payment_gate_mode:'PROOF_OR_PACKAGE'};
const free={...base,event_id:'PUB-HIKE-20991201',title:'Synthetic free hike',
 category:'Hike',contact_activity:false,price_czk:0,payment_gate_mode:'NONE'};
function json(body){return {status:200,contentType:'application/json',body:JSON.stringify(body)};}
async function fill(page){
 await page.locator('#firstName').fill('Synthetic');
 await page.locator('#lastName').fill('Person');
 await page.locator('#email').fill('synthetic@example.test');
 await page.locator('#phone').fill('+420777000123');
 await page.locator('#safety').check();
}
test('visual Academy shows a large photo gallery, 31 illustrated course cards and openable syllabi',async({page})=>{
 await page.goto('/academy/courses/?lang=ru');
 await expect(page.locator('.course-gallery figure')).toHaveCount(5);
 await expect(page.locator('#catalog .course')).toHaveCount(31);
 await expect(page.locator('#catalog .course-visual img')).toHaveCount(31);
 await expect(page.locator('#catalog .course-extra details')).toHaveCount(0);
 const syllabus=page.locator('#catalog .course-extra').first();
 await expect(syllabus).toHaveJSProperty('open',false);
 await syllabus.locator('summary').click();
 await expect(syllabus).toHaveJSProperty('open',true);
 await expect(page.locator('#catalog .course-visual img').first()).toBeVisible();
 await page.locator('[data-filter="ai"]').click();
 await expect(page.locator('#catalog .course:visible')).toHaveCount(6);
});
test('paid registration demands uploaded document and never marks bank pending as paid',async({page})=>{
 let posts=0,uploads=0,payload=null;
 await page.route(registrar,route=>{
  if(route.request().method()==='GET')return route.fulfill(json({events:[paid]}));
  posts++;payload=JSON.parse(route.request().postData());
  return route.fulfill(json({ok:true,status:'PAYMENT_PENDING_VERIFICATION',
   paymentGate:'PROOF_PENDING',confirmed:false,reference:'test-ref'}));
 });
 await page.route(proof,route=>{
  uploads++;
  return route.fulfill(json({ok:true,status:'PENDING_BANK_REVIEW',
   evidenceId:'00000000-0000-4000-8000-000000000001'}));
 });
 await page.goto('/register/?lang=en');
 await expect(page.locator('#rsvpDetails')).toBeVisible();
 await expect(page.locator('#paymentGate')).toBeVisible();
 await expect(page.locator('#paymentProof')).toHaveAttribute('required','');
 await expect(page.locator('#paymentAmount')).toHaveValue('240');
 await expect(page.locator('input[name=rsvp][value=YES]')).toBeChecked();
 await expect(page.locator('input[name=rsvp][value=MAYBE]')).toBeDisabled();
 await fill(page);
 await page.locator('#submit').click();
 expect(uploads).toBe(0);
 expect(posts).toBe(0);
 await page.locator('#paymentProof').setInputFiles({
  name:'synthetic.png',mimeType:'image/png',buffer:Buffer.alloc(2048,42)
 });
 await page.locator('#submit').click();
 await expect(page.locator('#rsvpForm')).toBeHidden();
 await expect(page.locator('#result')).toContainText('not bank-verified');
 expect(uploads).toBe(1);
 expect(posts).toBe(1);
 expect(payload.paymentEvidenceId).toBe('00000000-0000-4000-8000-000000000001');
 expect(payload.packageCode).toBeUndefined();
});
test('a bank-verified pass uses server-side count: consumed, reserved, available',async({page})=>{
 let payload=null,uploads=0;
 await page.route(registrar,route=>{
  if(route.request().method()==='GET')return route.fulfill(json({events:[paid]}));
  payload=JSON.parse(route.request().postData());
  return route.fulfill(json({ok:true,status:'RECEIVED',confirmed:false,
   paymentGate:'PACKAGE_VERIFIED',packageBalance:{consumed:2,reserved:1,available:1}}));
 });
 await page.route(proof,route=>{uploads++;return route.fulfill(json({error:'unexpected_upload'}));});
 await page.goto('/register/en/');
 await expect(page.locator('#paymentGate')).toBeVisible();
 await page.locator('#paymentModePackage').check();
 await expect(page.locator('#paymentProof')).not.toHaveAttribute('required','');
 await expect(page.locator('#packageCode')).toHaveAttribute('required','');
 await page.locator('#packageCode').fill('ABCDE12345ABCDE67890');
 await fill(page);
 await page.locator('#submit').click();
 await expect(page.locator('#result')).toContainText('consumed 2');
 await expect(page.locator('#result')).toContainText('reserved 1');
 await expect(page.locator('#result')).toContainText('available 1');
 expect(payload.packageCode).toBe('ABCDE12345ABCDE67890');
 expect(payload.paymentEvidenceId).toBeUndefined();
 expect(uploads).toBe(0);
});
test('a free event does not request payment or accept a paid package claim',async({page})=>{
 let payload=null;
 await page.route(registrar,route=>{
  if(route.request().method()==='GET')return route.fulfill(json({events:[free]}));
  payload=JSON.parse(route.request().postData());return route.fulfill(json({ok:true,status:'RECEIVED',confirmed:false}));
 });
 await page.goto('/register/?lang=cs');
 await expect(page.locator('#paymentGate')).toBeHidden();
 await fill(page);await page.locator('#submit').click();
 await expect(page.locator('#result')).toBeVisible();
 expect(payload.paymentEvidenceId).toBeUndefined();
 expect(payload.packageCode).toBeUndefined();
});
test('priced event without separate payment approval stays an interest-only form',async({page})=>{
 await page.route(registrar,route=>route.fulfill(json({events:[{...paid,payment_gate_mode:'NONE'}]})));
 await page.goto('/register/ru/');
 await expect(page.locator('#rsvpDetails')).toBeVisible();
 await expect(page.locator('#paymentGate')).toBeHidden();
});
