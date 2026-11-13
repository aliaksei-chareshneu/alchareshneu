'use strict';
const {test,expect}=require('@playwright/test');
const ENDPOINT='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
const CHECKOUT='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-academy-checkout';
test('home: 55 Google reviews appear outside the hero; nearest verified event has first CTA; list only 30 days',async({page})=>{
 await page.clock.install({time:new Date('2026-11-13T13:00:00+01:00')});
 const base={category:'Hike',community:'Brnowalkers',price_czk:100,price_verified:true,end_time_verified:true,
 source_active:true,is_open:true,registration_mode:'FORM',venue:'Brno',data_controller:'Aliaksei Chareshneu (OSVČ, IČO 23041625)'};
 const events=[
 {...base,event_id:'PUB-WALK-20261118-ONE',title:'First upcoming walk',begins_at:'2026-11-18T17:30:00Z'},
 {...base,event_id:'PUB-WALK-20261201-TWO',title:'Walk in December',begins_at:'2026-12-01T14:00:00Z'},
 {...base,event_id:'PUB-WALK-20270109-FAR',title:'Too far ahead',begins_at:'2027-01-09T14:00:00Z'}];
 await page.route(ENDPOINT,r=>r.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({events})}));
 await page.goto('/?lang=ru');
 await expect(page.locator('#imp-google-review-badge')).toContainText('55');
 await expect(page.locator('#imp-google-review-badge')).toContainText('13.11.2026');
 const placement=await page.evaluate(()=>{
  const hero=document.querySelector('#imperion-frontdoor .fd-hero').getBoundingClientRect();
  const badge=document.querySelector('#imp-google-review-badge').getBoundingClientRect();
  return {below:badge.top>=hero.bottom-2,badgeWidth:badge.width,viewport:innerWidth};
 });
 expect(placement.below).toBe(true);expect(placement.badgeWidth).toBeLessThan(placement.viewport);
 await expect(page.locator('#fdNearestEvent')).toBeVisible();
 await expect(page.locator('#fdNearestTitle')).toContainText('First upcoming walk');
 await expect(page.locator('#fdNearestBook')).toHaveAttribute('href',/event=PUB-WALK-20261118-ONE/);
 await expect(page.locator('#fdAllList .fd-all-item')).toHaveCount(2);
 await page.locator('#fdNearestMore').click();
 await expect(page.locator('#fdDetails')).toBeVisible();
 await expect(page.locator('#fdEventTitle')).toContainText('First upcoming walk');
 await page.locator('#fdClose').click();
});
for(const [language,title] of [
 ['cs','IMPERION · Zážitky, výuka a akce v Brně'],
 ['en','IMPERION · Experiences, lessons and events in Brno'],
 ['ru','IMPERION · События, занятия и приключения в Брно'],
 ['uk','IMPERION · Події, заняття та пригоди в Брно']
]){
 test('Homepage browser tab title is localized: '+language,async({page})=>{
  await page.route(ENDPOINT,r=>r.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'{"events":[]}'}));
  await page.goto('/?lang='+language);
  await expect(page).toHaveTitle(title);
 });
}
for(const lang of ['cs','en','ru','uk']){
 test('Academy specific three prices route into a first-party Order, not WhatsApp: '+lang,async({page})=>{
  await page.goto('/academy/?lang='+lang);
  const picker=page.locator('#academy-service-search');
  await picker.fill('Chem');
  await page.locator('#academy-service-options [role="option"]').first().click();
  await expect(page.locator('#academy-selected-service .academy-service-option')).toHaveCount(3);
  await expect(page.locator('#academy-selected-service .academy-option-price')).toHaveCount(3);
  for(let i=0;i<3;i++){
   const href=await page.locator('#academy-selected-service .academy-service-option a').nth(i).getAttribute('href');
   expect(href).toBe('order/?lang='+lang+'&service=chemistry&variant=v'+(i+1));
  }
  await expect(page.locator('#academy-selected-service .academy-custom')).toHaveAttribute('href',/^https:\/\/wa\.me\//);
  await page.locator('#academy-selected-service .academy-service-option a').first().click();
  await expect(page).toHaveURL(new RegExp('/academy/order/\\?lang='+lang));
  await expect(page.locator('#aoService')).toHaveValue('chemistry');
  await expect(page.locator('#aoVariant')).toHaveValue('v1');
  await expect(page.locator('#aoPrice')).toContainText('690 Kč');
  await expect(page.locator('#aoQuote')).toBeHidden();
  await expect(page.locator('#aoService option')).toHaveCount(17);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
 });
}
test('Academy order: safe status split and native private payment evidence interaction',async({page})=>{
 const posts=[];
 await page.route(CHECKOUT,route=>{
  if(route.request().method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"service":"academy_checkout_v1","accepting":true}'});
  const data=route.request().postData()||'';posts.push(data);
  if(route.request().headers()['content-type']?.startsWith('multipart/form-data'))
   return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({ok:true,status:'PROOF_RECEIVED',bankVerified:false,bookingConfirmed:false})});
  let body={};try{body=JSON.parse(data)}catch(e){}
  if(body.action==='order')return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({ok:true,reference:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',continuationCode:'A'.repeat(43),status:'RECEIVED_UNCONFIRMED',bankVerified:false,bookingConfirmed:false})});
  if(body.action==='status')return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({ok:true,quoteApproved:true,proofRequired:true,amountCzk:690,payee:'Verified Example OSVC',bankAccount:'TEST-ACCOUNT-NOT-REAL',paymentMessage:'ACADEMY AAAAAAAA',status:'QUOTE_APPROVED',bankVerified:false,bookingConfirmed:false})});
  return route.fulfill({status:400,contentType:'application/json',body:'{"error":"invalid_action"}'});
 });
 await page.goto('/academy/order/?lang=ru&service=math&variant=v2');
 const date=await page.locator('#aoDate').getAttribute('min');
 const later=new Date(Date.parse(date+'T12:00:00Z')+2*86400000).toISOString().slice(0,10);
 await page.locator('#aoDate').fill(later);await page.locator('#aoTime').selectOption('13:00');
 await page.locator('#aoName').fill('Testing Person');
 await page.locator('#aoEmail').fill('test-user@example.org');
 await page.locator('#aoGoal').fill('Подготовка к университетскому экзамену, конкретная тема и решение задач.');
 await page.locator('#aoAdult').check();await page.locator('#aoPrivacy').check();
 await page.locator('#aoSubmit').click();
 await expect(page.locator('#aoResult')).toContainText('Сохраните номер');
 await expect(page.locator('#aoResult')).toContainText('aaaaaaaa-aaaa');
 expect(posts.some(x=>x.includes('"bookingConfirmed":true'))).toBe(false);
 await page.locator('#aoStatusButton').click();
 await expect(page.locator('#aoQuote')).toBeVisible();
 await expect(page.locator('#aoAmount')).toContainText('690 Kč');
 await expect(page.locator('#aoPayee')).toContainText('Verified Example OSVC');
 await expect(page.locator('#aoProofForm')).toBeVisible();
 await page.locator('#aoProof').setInputFiles({name:'proof.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n'+('abc'.repeat(50)))});
 await page.locator('#aoProofButton').click();
 await expect(page.locator('#aoStatusResult')).toContainText('Подтверждение получено');
 await expect(page.locator('#aoProofForm')).toBeHidden();
});
for(const lang of ['cs','en','ru','uk']){
 test('Dedicated About and Partners pages show correct locale, not root redirect: '+lang,async({page})=>{
  await page.goto('/about/?lang='+lang);
  await expect(page.locator('.imp-about-profile')).toBeVisible();
  await expect(page.locator('.imp-about-profile-grid article')).toHaveCount(4);
  await expect(page.locator('.imp-about-partners-cta')).toHaveAttribute('href','../partners/?lang='+lang);
  await page.locator('.imp-about-partners-cta').click();
  await expect(page).toHaveURL(new RegExp('/partners/\\?lang='+lang));
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('.partner-locale:visible')).toHaveCount(1);
  await expect(page.locator('.partner-card:visible')).toHaveCount(6);
  await expect(page.locator('#imp-shell-links [data-imp-link="partners"]')).toHaveAttribute('aria-current','page');
 });
}
test('All first-party pages fit a 390px mobile viewport without body horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 for(const link of ['/academy/order/?lang=ru','/about/?lang=ru','/partners/?lang=ru']){
  await page.goto(link);
  await expect(page.locator('main')).toBeVisible();
  const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
  expect(sizes.scroll,link).toBeLessThanOrEqual(sizes.viewport+1);
 }
});
