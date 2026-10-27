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
 await expect(page.locator('#heroCta')).toHaveAttribute('href',/corporate\/request\//);
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
