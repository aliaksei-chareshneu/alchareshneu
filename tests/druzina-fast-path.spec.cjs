const {test,expect}=require('@playwright/test');
const languages=['cs','en','ru','uk'];
const labels={
 cs:{headline:'Hledáš dobrodružství a nové přátele v Brně?',value:'Dobrodružství, pohyb, přátelé, historie a kostýmy',cta:'Požádat o první trénink'},
 en:{headline:'Looking for adventures and friends in Brno?',value:'Adventure, movement, friends, history and costumes',cta:'Ask for a first training'},
 ru:{headline:'Ищешь приключения и друзей в Брно?',value:'Приключения, движение, друзья, история и костюмы',cta:'Запросить первую тренировку'},
 uk:{headline:'Шукаєш пригод і друзів у Брно?',value:'Пригоди, рух, друзі, історія та костюми',cta:'Запитати про перше тренування'}
};
const ID='PUB-HEMA-20300101';
function mockEvent(payment=null){
 return {event_id:ID,title:'Družina test training',community:'Družina Moravy',
  category:'HEMA Training',begins_at:'2030-01-01T17:00:00Z',
  ends_at:'2030-01-01T19:00:00Z',venue:'Brno — pending confirmation',
  price_czk:240,is_open:true,source_active:true,price_verified:true,
  end_time_verified:true,registration_mode:'FORM',public_listing:true,
  data_controller:'Družina Moravy, z. s.',contact_activity:true,
  rules_url:'https://aliaksei-chareshneu.github.io/alchareshneu/druzina/safety/',
  trainingPayment:payment||{status:'AWAITING_ORGANIZER_GO',proofRequired:false,sessionPaymentOpen:false,tiers:[
    {tier:'STANDARD',baseCzk:240,surchargeCzk:0,totalCzk:240},
    {tier:'SENIOR',baseCzk:120,surchargeCzk:0,totalCzk:120},
    {tier:'STARTER4',baseCzk:800,surchargeCzk:0,totalCzk:800}
  ]}
 };
}
function mockFree(){
 return {...mockEvent(null),event_id:'PUB-OREL-20301114',title:'FREE workshop',
  price_czk:0,trainingPayment:null};
}
async function mockApi(page,eventData=mockEvent(),onPost=()=>({
 ok:true,status:'RECEIVED',confirmed:false,resumeToken:'A'.repeat(43)
})){
 let sent=[];
 await page.route('**/functions/v1/imperion-register',async route=>{
  const request=route.request();
  if(request.method()==='GET'){
    return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({events:[eventData],version:'test-catalog',bookingConfirmed:false})});
  }
  sent.push(request);
  const response=await onPost(request);
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
 });
 return sent;
}
for(const lang of languages){
 test('Druzina one-screen CTA leads to the actual single form: '+lang,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/druzina/?lang='+lang);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('#druzina h1')).toHaveText(labels[lang].headline);
  await expect(page.locator('#druzina .dm-hero-deck')).toContainText(labels[lang].value);
  await expect(page.locator('#druzina .dm-v2-primary')).toContainText(labels[lang].cta);
  await expect(page.locator('#druzina .dm-v2-primary')).toHaveAttribute('href','../register/?lang='+lang);
  await expect(page.locator('#druzina .dm-v2-secondary')).toHaveAttribute('href','../register/?lang='+lang);
  await expect(page.locator('.dm-v2-announcements')).not.toHaveAttribute('open','');
  await expect(page.locator('.dm-v2-status')).toBeVisible();
  const measured=await page.locator('#druzina .dm-v2-primary').evaluate(el=>{
   const x=getComputedStyle(el),r=el.getBoundingClientRect();
   return {bg:x.backgroundColor,fg:x.color,width:r.width,height:r.height};
  });
  expect(measured.bg).toBe('rgb(230, 191, 128)');
  expect(measured.fg).toBe('rgb(16, 27, 45)');
  expect(measured.height).toBeGreaterThanOrEqual(54);
  expect(measured.width).toBeGreaterThanOrEqual(250);
  await page.locator('.dm-v2-announcements>summary').click();
  await expect(page.locator('.dm-v2-announcements')).toHaveAttribute('open','');
  await expect(page.locator('#dm-2026-11-07-cancellation-notice [data-dm-v2-locale="'+lang+'"]')).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
 });
 test('Legacy URL redirects into canonical form without retaining a second form: '+lang,async({page})=>{
  await mockApi(page);
  await page.goto('/druzina/prihlaska/?lang='+lang+'&event='+ID);
  await expect(page).toHaveURL(new RegExp('/register/(?:'+(lang==='cs'?'':lang+'/')+')?\\?'));
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('#rsvpForm')).toBeVisible();
  await expect(page.locator('#eventId')).toHaveValue(ID);
  await expect(page.locator('#trainingPayment')).toBeVisible();
  await expect(page.locator('#paymentProofField')).toBeHidden();
  await expect(page.locator('#interestForm')).toHaveCount(0);
 });
 test('Only canonical form accepts new preliminary RSVP; code is not a paid seat: '+lang,async({page})=>{
  const submitted=await mockApi(page);
  await page.goto('/register/?lang='+lang+'&event='+ID);
  await expect(page.locator('#rsvpForm')).toBeVisible();
  await expect(page.locator('#paymentProofField')).toBeHidden();
  await page.locator('#submit').click();
  expect(submitted).toHaveLength(0);
  await page.locator('#firstName').fill('Test');
  await page.locator('#lastName').fill('Visitor');
  await page.locator('#email').fill('example@example.invalid');
  await page.locator('#phone').fill('+420702000000');
  await page.locator('#safety').check();
  await page.locator('#submit').click();
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#rsvpForm')).toBeHidden();
  await expect(page.locator('#result')).toContainText('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  expect(submitted).toHaveLength(1);
  const body=JSON.parse(submitted[0].postData());
  expect(body).toMatchObject({eventId:ID,firstName:'Test',lastName:'Visitor',
    email:'example@example.invalid',rsvp:'YES',ageGroup:'adult',safety:true,language:lang});
  expect(body).not.toHaveProperty('payment');
  expect(body).not.toHaveProperty('quotedTotalCzk');
 });
}
test('Only an individually approved private quote enables a PDF; upload cannot verify the bank',async({page})=>{
 const q={status:'AWAITING_PERSONAL_APPROVAL',late48h:true,proofRequired:false,
   sessionPaymentOpen:true,tiers:[
    {tier:'STANDARD',baseCzk:240,surchargeCzk:60,totalCzk:300},
    {tier:'SENIOR',baseCzk:120,surchargeCzk:30,totalCzk:150},
    {tier:'STARTER4',baseCzk:800,surchargeCzk:200,totalCzk:1000}
   ]};
 let ctype='',pdfBody='',quoteCalls=0,pdfCalls=0;
 await mockApi(page,mockEvent(q),async request=>{
  const contentType=request.headers()['content-type']||'';
  if(contentType.startsWith('application/json')){
    const body=JSON.parse(request.postData()||'{}');
    expect(body).toMatchObject({action:'quote',trainingTier:'STANDARD'});
    quoteCalls++;
    return {ok:true,confirmed:false,trainingPayment:{
      tier:'STANDARD',baseCzk:240,surchargeCzk:60,totalCzk:300,
      late48h:true,quoteLockedAt:'2026-11-09T08:00:00Z',
      recipient:'Verified association (fixture only)',account:'test-account-0000',
      proofRequired:true,bankVerified:false
    }};
  }
  pdfCalls++;ctype=contentType;pdfBody=request.postData()||'';
  return {ok:true,status:'RECEIVED',confirmed:false,paymentEvidenceStatus:'PROOF_RECEIVED',
    bankVerified:false,quotedTotalCzk:300,quotedTier:'STANDARD'};
 });
 await page.goto('/register/?lang=en&event='+ID);
 await expect(page.locator('#trainingPaymentAmount')).toContainText('300');
 await expect(page.locator('#paymentProofField')).toBeHidden();
 await page.locator('#firstName').fill('Test');
 await page.locator('#lastName').fill('Visitor');
 await page.locator('#email').fill('example@example.invalid');
 await page.locator('#phone').fill('+420702000000');
 await page.locator('#safety').check();
 await page.locator('#paymentResumeToken').fill('A'.repeat(43));
 await expect(page.locator('#paymentQuoteButton')).toBeVisible();
 await expect(page.locator('#paymentProofField')).toBeHidden();
 await page.locator('#paymentQuoteButton').click();
 await expect(page.locator('#paymentProofField')).toBeVisible();
 await expect(page.locator('#trainingPaymentPrivate')).toContainText('300');
 await page.locator('#paymentProof').setInputFiles({name:'transfer.pdf',mimeType:'application/pdf',
    buffer:Buffer.from('%PDF-1.4\n'+'.'.repeat(300))});
 await page.locator('#submit').click();
 await expect(page.locator('#result')).toBeVisible();
 expect(quoteCalls).toBe(1);expect(pdfCalls).toBe(1);
 expect(ctype).toMatch(/^multipart\/form-data; boundary=/i);
 expect(pdfBody).toContain('quotedTotalCzk');
 expect(pdfBody).toContain('transfer.pdf');
 await expect(page.locator('#result')).toContainText('PDF');
});
test('Free Orel HEMA-classified workshop never displays payment PDF',async({page})=>{
 const event=mockFree();
 await mockApi(page,event);
 await page.goto('/register/?lang=en&event='+event.event_id);
 await expect(page.locator('#rsvpForm')).toBeVisible();
 await expect(page.locator('#eventInfo')).toContainText('Free');
 await expect(page.locator('#trainingPayment')).toBeHidden();
 await expect(page.locator('#paymentProofField')).toBeHidden();
});
test('Homepage exposes the direct canonical link in all four languages',async({page})=>{
 for(const lang of languages){
  await page.goto('/?lang='+lang);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('.dm-root-fast-entry a:visible')).toHaveCount(1);
  await expect(page.locator('.dm-root-fast-entry a:visible')).toHaveAttribute('href','register/?lang='+lang);
 }
});
