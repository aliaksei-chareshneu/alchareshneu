const {test,expect}=require('@playwright/test');

const languages=['cs','en','ru','uk'];
function cors(){return {'access-control-allow-origin':'http://127.0.0.1:8000','access-control-allow-headers':'content-type','access-control-allow-methods':'POST, OPTIONS'};}

const labels={
 cs:{headline:'Vyzkoušej historický šerm v Brně.',cta:'Požádat o první trénink'},
 en:{headline:'Try historical fencing in Brno.',cta:'Ask for a first training'},
 ru:{headline:'Попробуй историческое фехтование в Брно.',cta:'Запросить первую тренировку'},
 uk:{headline:'Спробуй історичне фехтування в Брно.',cta:'Запитати про перше тренування'}
};

for(const lang of languages){
 test('Druzina one-screen funnel and actual locale: '+lang,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/druzina/?lang='+lang);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('#druzina h1')).toHaveText(labels[lang].headline);
  await expect(page.locator('#druzina .dm-v2-primary')).toContainText(labels[lang].cta);
  await expect(page.locator('#druzina .dm-v2-primary')).toHaveAttribute('href','prihlaska/?lang='+lang);
  await expect(page.locator('#druzina .dm-v2-secondary')).toHaveAttribute('href','prihlaska/?lang='+lang+'&type=returning');
  await expect(page.locator('.dm-v2-announcements')).not.toHaveAttribute('open','');
  await expect(page.locator('.dm-v2-status')).toBeVisible();
  const measured=await page.locator('#druzina .dm-v2-primary').evaluate(el=>{
   const x=getComputedStyle(el);
   const rect=el.getBoundingClientRect();
   return {bg:x.backgroundColor,fg:x.color,width:rect.width,height:rect.height};
  });
  expect(measured.bg).toBe('rgb(230, 191, 128)');
  expect(measured.fg).toBe('rgb(16, 27, 45)');
  expect(measured.height).toBeGreaterThanOrEqual(54);
  expect(measured.width).toBeGreaterThanOrEqual(250);
  await page.locator('.dm-v2-announcements>summary').click();
  await expect(page.locator('.dm-v2-announcements')).toHaveAttribute('open','');
  await expect(page.locator('#dm-2026-11-07-cancellation-notice [data-dm-v2-locale]:visible')).toHaveCount(1);
  await expect(page.locator('#dm-2026-11-07-cancellation-notice [data-dm-v2-locale="'+lang+'"]')).toBeVisible();
  await expect(page.locator('.dm-permanentky-offer [data-dm-v2-locale]:visible')).toHaveCount(1);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
 });
}

for(const lang of languages){
 test('One-minute Druzina enquiry: safety, actual payload, truthful confirmation '+lang,async({page})=>{
  let calls=0,body;
  await page.route('**/functions/v1/imperion-register',async route=>{
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:cors()});
   calls++;body=JSON.parse(route.request().postData());
   await route.fulfill({status:200,contentType:'application/json',headers:cors(),
    body:JSON.stringify({ok:true,status:'RECEIVED_UNCONFIRMED',confirmed:false,reference:'synthetic-confirmation-qa'})});
  });
  await page.setViewportSize({width:375,height:812});
  await page.goto('/druzina/prihlaska/?lang='+lang);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('#interestForm')).toBeVisible();
  await expect(page.locator('#adult')).not.toBeChecked();
  await expect(page.locator('#safety')).not.toBeChecked();
  await page.locator('#send').click();
  expect(calls).toBe(0);
  await page.locator('#firstName').fill('Test');
  await page.locator('#lastName').fill('Visitor');
  await page.locator('#contact').fill('example@example.invalid');
  await page.locator('#adult').check();
  await page.locator('#safety').check();
  await page.locator('#send').click();
  await expect(page.locator('#successPanel')).toBeVisible();
  await expect(page.locator('#interestForm')).toBeHidden();
  await expect(page.locator('#requestId')).toHaveText('synthetic-confirmation-qa');
  expect(calls).toBe(1);
  expect(body).toMatchObject({
   intent:'DRUZINA_ENQUIRY',visitType:'FIRST',preferredDay:'NEXT',
   firstName:'Test',lastName:'Visitor',contact:'example@example.invalid',
   adultConfirmed:true,safety:true,language:lang
  });
  expect(body).not.toHaveProperty('price');
  expect(body).not.toHaveProperty('payment');
 });
}

test('Returning visitor and preferred date do not bypass booking confirmation',async({page})=>{
 await page.route('**/functions/v1/imperion-register',async route=>{
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:cors()});
  const body=JSON.parse(route.request().postData());
  expect(body.visitType).toBe('RETURNING');
  expect(body.preferredDay).toBe('DATE');
  expect(body.preferredDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await route.fulfill({status:200,contentType:'application/json',headers:cors(),
   body:JSON.stringify({ok:true,status:'RECEIVED_UNCONFIRMED',confirmed:false,reference:'test-date'})});
 });
 await page.goto('/druzina/prihlaska/?lang=ru&type=returning');
 await expect(page.locator('input[name="visitType"][value="RETURNING"]')).toBeChecked();
 await page.locator('input[name="preferredDay"][value="DATE"]+span').click();
 await expect(page.locator('input[name="preferredDay"][value="DATE"]')).toBeChecked();
 await expect(page.locator('#dateWrap')).toBeVisible();
 const date=await page.locator('#preferredDate').getAttribute('max');
 await page.locator('#preferredDate').fill(date);
 await page.locator('#firstName').fill('Test');
 await page.locator('#lastName').fill('Member');
 await page.locator('#contact').fill('+420 702 000 000');
 await page.locator('#adult').check();
 await page.locator('#safety').check();
 await page.locator('#send').click();
 await expect(page.locator('#successPanel')).toBeVisible();
});
test('Homepage exposes a direct one-click enquiry in the selected language',async({page})=>{
 for(const lang of languages){
  await page.goto('/?lang='+lang);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('.dm-root-fast-entry a:visible')).toHaveCount(1);
  await expect(page.locator('.dm-root-fast-entry a:visible')).toHaveAttribute('href','druzina/prihlaska/?lang='+lang);
 }
});
