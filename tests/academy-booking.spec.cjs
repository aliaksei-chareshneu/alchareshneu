'use strict';
const {test,expect}=require('@playwright/test');
const ENDPOINT='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-academy-book';
const UUID_A='00000000-0000-4000-8000-000000000011';
const UUID_B='00000000-0000-4000-8000-000000000012';
const REF='00000000-0000-4000-8000-000000000020';
const pragueDate=iso=>{
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(iso));
 const get=type=>parts.find(p=>p.type===type).value;
 return get('year')+'-'+get('month')+'-'+get('day');
};
function slots(){
 const now=Date.now();
 return {
  ok:true,server_now:new Date(now).toISOString(),timezone:'Europe/Prague',
  rates_czk:{LESSON:1000,CONSULT:250},late_surcharge_pct:25,bank_payment_verified:false,
  slots:[
   {id:UUID_A,starts_at:new Date(now+24*3600000).toISOString(),ends_at:new Date(now+25*3600000).toISOString(),service_code:'LESSON',delivery_mode:'ONLINE'},
   {id:UUID_B,starts_at:new Date(now+72*3600000).toISOString(),ends_at:new Date(now+73*3600000).toISOString(),service_code:'LESSON',delivery_mode:'BRNO'}
  ]
 };
}
test('own Academy booking is readable in four languages without a Google Calendar login',async({page})=>{
 const data=slots();
 await page.route(ENDPOINT,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)}));
 for(const lang of ['en','cs','ru','uk']){
  await page.goto('/academy/book/?lang='+lang);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('form#booking')).toBeVisible();
  await expect(page.locator('#day')).not.toBeEmpty();
  await expect(page.locator('.slot')).toHaveCount(1);
  await expect(page.locator('#send')).toBeDisabled();
  await expect(page.locator('#receipt')).toHaveAttribute('accept','application/pdf,.pdf');
 }
});
test('selecting slots recalculates +25% under 48 hours and zero outside',async({page})=>{
 const data=slots();
 await page.route(ENDPOINT,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)}));
 await page.goto('/academy/book/?lang=en');
 await page.locator('.slot').first().click();
 await expect(page.locator('#price')).toContainText('1,250');
 await expect(page.locator('#priceBreakdown')).toContainText('250');
 await page.locator('#day').fill(pragueDate(data.slots[1].starts_at));
 await page.locator('.slot').first().click();
 await expect(page.locator('#price')).toContainText('1,000');
 await expect(page.locator('#priceBreakdown')).toContainText('0');
});
test('PDF submission produces a pending request but never a paid or confirmed booking',async({page})=>{
 const data=slots();let posted=null;
 await page.route(ENDPOINT,async route=>{
  if(route.request().method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  posted=route.request().postDataBuffer()?.toString('utf8')||'';
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,reference:REF,status:'PENDING_BANK_CHECK',total_czk:1250,
   payment_verified:false,booking_confirmed:false
  })});
 });
 await page.goto('/academy/book/?lang=ru');
 await page.locator('.slot').first().click();
 await page.locator('#name').fill('Parent QA');
 await page.locator('#email').fill('qa@example.invalid');
 await page.locator('#goal').fill('Czech A2 test');
 await page.locator('#receipt').setInputFiles([{
  name:'synthetic-proof.pdf',mimeType:'application/pdf',
  buffer:Buffer.from('%PDF-1.7\n1 0 obj <</Type /Catalog>> endobj\n%%EOF\nxxxxxxxxxxxxxxxxxxx')
 }]);
 await page.locator('#privacy').check();
 await page.locator('#guardian').check();
 await expect(page.locator('#send')).toBeEnabled();
 await page.locator('#send').click();
 await expect(page.locator('#result')).toContainText(REF);
 await expect(page.locator('#result')).toContainText('НЕ подтверждены');
 await expect(page.locator('#send')).toBeDisabled();
 expect(posted).toContain('synthetic-proof.pdf');
 expect(posted).toContain('%PDF-');
 expect(posted).toContain('CZECH');
});
test('backend error never fabricates an available slot or payment',async({page})=>{
 await page.route(ENDPOINT,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'unavailable'})}));
 await page.goto('/academy/book/?lang=cs');
 await expect(page.locator('#loadError')).toBeVisible();
 await expect(page.locator('#send')).toBeDisabled();
 await expect(page.locator('.slot')).toHaveCount(0);
});
