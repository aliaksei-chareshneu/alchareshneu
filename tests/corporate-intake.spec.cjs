const {test,expect}=require('@playwright/test');
const ENDPOINT='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-b2b-intake';
const LANGS=['cs','en','ru','uk'];

for (const lang of LANGS){
 test('OSVC quote form '+lang+' presents safe non-binding request, no checkout',async({page})=>{
  await page.goto('/corporate/request/?lang='+lang+'&service=DATA_PILOT&src=qa_'+lang);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('form#request')).toBeVisible();
  await expect(page.locator('#offer')).toHaveValue('DATA_PILOT');
  await expect(page.locator('#privacyAck')).not.toBeChecked();
  await expect(page.locator('form#request input[type="password"]')).toHaveCount(0);
  await expect(page.locator('form#request input[type="credit-card"]')).toHaveCount(0);
  await expect(page.locator('form#request input[type="checkbox"]')).toHaveCount(1);
  await expect(page.locator('link[href*="brand-theme.css"]')).toHaveCount(1);
 });
}

test('accepts a well-scoped valid B2B request in Czech and sends no payment',async({page})=>{
 let calls=[];
 await page.route(ENDPOINT,async route=>{
  const post=route.request();
  calls.push({method:post.method(),body:post.postDataJSON()});
  await route.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify({ok:true,status:'RECEIVED_UNCONFIRMED',confirmed:false,reference:'00000000-0000-0000-0000-000000000002'})});
 });
 await page.goto('/corporate/request/?lang=cs&service=DATA_PILOT&src=corporate_test');
 await page.locator('#company').fill('Výrobní demo s.r.o.');
 await page.locator('#contactName').fill('Test Contact');
 await page.locator('#email').fill('nobody@example.invalid');
 await page.locator('#phone').fill('+420 700 000 000');
 await page.locator('#budgetBand').selectOption('15000-30000');
 await page.locator('#teamSize').fill('12');
 await page.locator('#timeframe').fill('listopad 2026');
 await page.locator('#summary').fill('Potřebujeme automatizovat kvalitní report z výrobních dat.');
 await page.locator('#privacyAck').check();
 await page.locator('#submit').click();
 await expect(page.locator('#result')).toBeVisible();
 await expect(page.locator('#result')).toContainText('přijata');
 await expect(page.locator('#receiptDetails')).toContainText('Výrobní demo s.r.o.');
 await expect(page.locator('#receiptDetails')).toContainText('00000000-0000-0000-0000-000000000002');
 await expect(page.locator('#receiptDetails .receipt-button')).toBeVisible();
 expect(calls).toHaveLength(1);
 expect(calls[0].method).toBe('POST');
 expect(calls[0].body.offer).toBe('DATA_PILOT');
 expect(calls[0].body.budgetBand).toBe('15000-30000');
 expect(calls[0].body.teamSize).toBe(12);
 expect(calls[0].body.privacyAcknowledged).toBe(true);
 expect(calls[0].body.source).toBe('corporate_test');
 expect(calls[0].body.email).toBe('nobody@example.invalid');
});

test('privacy consent is mandatory and no API POST without it',async({page})=>{
 let calls=0;
 await page.route(ENDPOINT,async route=>{calls++;await route.abort();});
 await page.goto('/corporate/request/?lang=en');
 await page.locator('#company').fill('Example LLC');
 await page.locator('#contactName').fill('John Example');
 await page.locator('#email').fill('nobody@example.invalid');
 await page.locator('#offer').selectOption('AI_WORKSHOP');
 await page.locator('#budgetBand').selectOption('unknown');
 await page.locator('#timeframe').fill('next month');
 await page.locator('#summary').fill('Practical Python workshop with reusable examples.');
 await page.locator('#submit').click();
 await expect(page.locator('#result')).toHaveClass(/err/);
 await expect(page.locator('#result')).toContainText('Complete the required fields');
 expect(calls).toBe(0);
});
test('network failure does not present a successful order or charge',async({page})=>{
 await page.route(ENDPOINT,async route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'temporarily_unavailable'})}));
 await page.goto('/corporate/request/?lang=ru&service=AI_WORKSHOP');
 await page.locator('#company').fill('Пример компания');
 await page.locator('#contactName').fill('Тест Контакт');
 await page.locator('#email').fill('noone@example.invalid');
 await page.locator('#budgetBand').selectOption('unknown');
 await page.locator('#timeframe').fill('ноябрь 2026');
 await page.locator('#summary').fill('Хотим научить сотрудников безопасно использовать Python и AI на практике.');
 await page.locator('#privacyAck').check();
 await page.locator('#submit').click();
 await expect(page.locator('#result')).toBeVisible();
 await expect(page.locator('#result')).toHaveClass(/err/);
 await expect(page.locator('#result')).toContainText('Не получилось');
 await expect(page.locator('#submit')).toBeEnabled();
});

test('business landing pages link to direct quote form',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#heroCta')).toHaveAttribute('href',/corporate\/request\/\?lang=en&service=EVENT_HOST/);
 await page.goto('/corporate/');
 await expect(page.locator('a[href*="request/?lang=en"]')).not.toHaveCount(0);
 await page.goto('/start/?lang=cs');
 await expect(page.locator('a[href*="request/"][href*="start_company"]')).not.toHaveCount(0);
 await page.goto('/academy/courses/');
 await expect(page.locator('a[href*="request/"][href*="academy_ai01"]')).not.toHaveCount(0);
 await page.goto('/corporate/technical-answers/');
 await expect(page.locator('a[href*="request/"][href*="technical_answers"]')).toHaveCount(1);
 await page.goto('/corporate/travel-audit/');
 await expect(page.locator('a[href*="request/"][href*="travel_audit"]')).toHaveCount(1);
});


test('existing B2B lead source includes allowed organic channel tags, not personal identifiers',async({page})=>{
 let request=null;
 await page.route(ENDPOINT,async route=>{
  request=route.request().postDataJSON();
  await route.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify({ok:true,status:'RECEIVED_UNCONFIRMED',confirmed:false,reference:'00000000-0000-0000-0000-000000000011'})});
 });
 await page.goto('/corporate/request/?lang=en&service=DATA_PILOT&src=start_company&utm_source=instagram&utm_medium=bio&utm_campaign=nov2026');
 await page.locator('#company').fill('Synthetic company');
 await page.locator('#contactName').fill('Test Contact');
 await page.locator('#email').fill('nobody@example.invalid');
 await page.locator('#budgetBand').selectOption('unknown');
 await page.locator('#timeframe').fill('November 2026');
 await page.locator('#summary').fill('We want an evaluated pilot for answering recurring technical support questions.');
 await page.locator('#privacyAck').check();
 await page.locator('#submit').click();
 await expect(page.locator('#result')).toBeVisible();
 expect(request).not.toBeNull();
 expect(request.source).toBe('start_company__instagram_bio_nov2026');
 expect(request.source).not.toContain('nobody@example.invalid');
});

test('event hosting page names the buyer problem and shows only attributable proof in four languages',async({page})=>{
 for(const language of LANGS){
  await page.goto('/corporate/?lang='+language);
  const title=page.locator('.revenue-head h1:visible');
  await expect(title).toHaveCount(1);
  await expect(title).not.toContainText('14,900');
  await expect(page.locator('#event-solutions [data-locale="'+language+'"]')).toBeVisible();
  await expect(page.locator('#why-trust [data-locale="'+language+'"] a[href="../druzina/"]')).toBeVisible();
  const host=new URL(await page.locator('#corporate-live-quote a:visible').first().getAttribute('href'),page.url());
  expect(host.pathname).toContain('/corporate/request/');
  expect(host.searchParams.get('service')).toBe('EVENT_HOST');
  expect(host.searchParams.get('lang')).toBe(language);
 }
});

test('event enquiry reuses original private API shape and protects consent',async({page})=>{
 let posts=[];
 await page.route(ENDPOINT,async route=>{
  posts.push(route.request().postDataJSON());
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,status:'RECEIVED_UNCONFIRMED',confirmed:false,reference:'00000000-0000-0000-0000-000000000099'})});
 });
 await page.goto('/corporate/request/?lang=cs&service=EVENT_HOST&src=event_hero');
 await expect(page.locator('#offer')).toHaveValue('EVENT_HOST');
 await expect(page.locator('#headline')).toContainText('akci');
 // Specialist prices are still available, but appear after the actual enquiry.
 const top=await page.locator('.panel').boundingBox();
 const prices=await page.locator('.cards').boundingBox();
 expect(top&&prices&&prices.y>top.y).toBeTruthy();
 await page.locator('#company').fill('Testovací instituce');
 await page.locator('#contactName').fill('Test Contact');
 await page.locator('#email').fill('example@example.invalid');
 await page.locator('#budgetBand').selectOption('unknown');
 await page.locator('#timeframe').fill('prosinec 2026');
 await page.locator('#summary').fill('Potřebujeme moderátora a předem definované přechody mezi částmi programu.');
 await page.locator('#submit').click();
 expect(posts).toHaveLength(0);
 await page.locator('#privacyAck').check();
 await page.locator('#submit').click();
 await expect(page.locator('#result')).toContainText('přijata');
 expect(posts).toHaveLength(1);
 expect(posts[0].offer).toBe('EVENT_HOST');
 expect(posts[0].source).toBe('event_hero');
 expect(posts[0].budgetBand).toBe('unknown');
 expect(posts[0].privacyAcknowledged).toBe(true);
});

async function fillP0Synthetic(page){
 await page.locator('#offer').selectOption('DATA_PILOT');
 await page.locator('#company').fill('Synthetic QA organisation');
 await page.locator('#contactName').fill('Synthetic Test Contact');
 await page.locator('#email').fill('nobody@example.invalid');
 await page.locator('#budgetBand').selectOption('unknown');
 await page.locator('#timeframe').fill('November 2026');
 await page.locator('#summary').fill('Synthetic QA only: check source UUID before confirming a CRM-bound enquiry.');
 await page.locator('#privacyAck').check();
}
for(const language of LANGS){
 test('source UUID is mandatory for a confirmed on-screen intake '+language,async({page})=>{
  await page.route(ENDPOINT,route=>route.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify({ok:true,status:'RECEIVED_UNCONFIRMED',confirmed:false})}));
  await page.goto('/corporate/request/?lang='+language+'&service=DATA_PILOT');
  await fillP0Synthetic(page);
  await page.locator('#submit').click();
  await expect(page.locator('#result')).toHaveClass(/err/);
  await expect(page.locator('#receiptDetails')).toBeHidden();
  await expect(page.locator('#company')).toHaveValue('Synthetic QA organisation');
 });
}
test('a duplicate acknowledgement never creates a new visual receipt or stale proof',async({page})=>{
 let call=0;
 await page.route(ENDPOINT,route=>route.fulfill({status:200,contentType:'application/json',
  body:JSON.stringify(++call===1?
   {ok:true,status:'RECEIVED_UNCONFIRMED',confirmed:false,reference:'00000000-0000-0000-0000-000000000022'}:
   {ok:true,status:'RECEIVED_UNCONFIRMED',confirmed:false,duplicate:true})}));
 await page.goto('/corporate/request/?lang=en&service=DATA_PILOT');
 await fillP0Synthetic(page);
 await page.locator('#submit').click();
 await expect(page.locator('#receiptDetails')).toBeVisible();
 await fillP0Synthetic(page);
 await page.locator('#submit').click();
 await expect(page.locator('#result')).toHaveClass(/err/);
 await expect(page.locator('#receiptDetails')).toBeHidden();
 expect(call).toBe(2);
});

async function fillP0GuardFixture(page){
 await page.locator('#offer').selectOption('DATA_PILOT');
 await page.locator('#company').fill('Synthetic QA organisation');
 await page.locator('#contactName').fill('Synthetic Test Contact');
 await page.locator('#email').fill('nobody@example.invalid');
 await page.locator('#budgetBand').selectOption('unknown');
 await page.locator('#timeframe').fill('November 2026');
 await page.locator('#summary').fill('Synthetic QA only: ensure a returned valid UUID is required to confirm DB storage.');
 await page.locator('#privacyAck').check();
}
for(const lang of LANGS){
 test('guard rejects HTTP 200 without source UUID in '+lang,async({page})=>{
  let calls=0;
  await page.route(ENDPOINT,route=>{calls++;return route.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify({ok:true,status:'RECEIVED_UNCONFIRMED',confirmed:false})});});
  await page.goto('/corporate/request/?lang='+lang+'&service=DATA_PILOT');
  await fillP0GuardFixture(page);
  await page.locator('#submit').click();
  await expect(page.locator('#result')).toHaveClass(/err/);
  await expect(page.locator('#receiptDetails')).toBeHidden();
  await expect(page.locator('#company')).toHaveValue('Synthetic QA organisation');
  expect(calls).toBe(1);
 });
}
test('duplicate server ACK has no false success and clears previous receipt',async({page})=>{
 let call=0;
 await page.route(ENDPOINT,route=>route.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify(++call===1?
    {ok:true,status:'RECEIVED_UNCONFIRMED',confirmed:false,reference:'00000000-0000-0000-0000-000000000022'}:
    {ok:true,status:'RECEIVED_UNCONFIRMED',confirmed:false,duplicate:true})}));
 await page.goto('/corporate/request/?lang=en&service=DATA_PILOT');
 await fillP0GuardFixture(page);
 await page.locator('#submit').click();
 await expect(page.locator('#receiptDetails')).toBeVisible();
 await fillP0GuardFixture(page);
 await page.locator('#submit').click();
 await expect(page.locator('#result')).toHaveClass(/err/);
 await expect(page.locator('#receiptDetails')).toBeHidden();
 expect(call).toBe(2);
});
