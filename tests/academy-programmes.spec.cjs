const {test, expect} = require('@playwright/test');

const names = {
  en: 'Important next step?',
  cs: 'Důležitý krok před vámi?',
  ru: 'Важный шаг в жизни?',
  uk: 'Важливий крок у житті?'
};
const codes = ['UNI','MED','A2','CER','CAREER','DEFENSE','EXEC','LIFE'];

for (const [language, heading] of Object.entries(names)) {
  test('Academy milestone programmes: accessible, localized and scroll-safe — ' + language, async ({page}) => {
    const failed = [];
    page.on('pageerror', error => failed.push(error.message));
    await page.setViewportSize({width:375, height:812});
    await page.goto('/academy/programmes/?lang=' + language + '&utm_source=test&utm_medium=smoke&utm_campaign=academy20261105');
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await expect(page.locator('h1:visible')).toContainText(heading);
    await expect(page.locator('.locale:visible')).toHaveCount(1);
    await expect(page.locator('.offer:visible')).toHaveCount(8);
    await expect(page.locator('.conditions:visible')).toContainText('690 Kč');
    await expect(page.locator('a.choose:visible')).toHaveCount(8);
    await expect(page.locator('#programme option')).toHaveCount(13);
    await expect(page.locator('link[href="../../site-design.css?v=20261027"]')).toHaveCount(1);
    for(const width of [360,375,768,1280]) {
      await page.setViewportSize({width,height:812});
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
      expect(overflow,'No horizontal overflow at '+width+'px in '+language).toBeLessThanOrEqual(1);
    }
    const code='A2';
    await page.locator('.locale:visible [data-choose="' + code + '"]').click();
    await expect(page.locator('#programme')).toHaveValue(code);
    await expect(page).toHaveURL(/#enquire$/);
    expect(failed).toEqual([]);
  });
}

test('Academy milestone enquiries preselect A2 from the free quiz and keep verified scope', async ({page}) => {
  await page.goto('/academy/programmes/?lang=cs&programme=A2&utm_source=a2_quiz&utm_medium=site&utm_campaign=life_milestones_20261105#enquire');
  await expect(page.locator('#programme')).toHaveValue('A2');
  await expect(page.locator('.locale:visible')).toContainText('trvalý pobyt');
  await expect(page.locator('.locale:visible')).toContainText('nikoli zkoušku B1 k občanství');
  await expect(page.locator('.offer:visible')).toHaveCount(8);
  await expect(page.locator('#interest-form')).toHaveCount(1);
  expect((await page.locator('#interest-form').getAttribute('action'))).toBeNull();
});

test('Academy legacy paths link to the new page without replacing the existing course catalogue', async ({page}) => {
  for(const route of ['/academy/','/academy/courses/','/academy/a2/']) {
    await page.goto(route);
    const link=page.locator('a[href*="programmes/"]').first();
    await expect(link).toHaveCount(1);
    const href=await link.getAttribute('href');
    expect(href).toContain('utm_campaign=life_milestones_20261105');
  }
});


test('Academy enquiry is stored only after explicit consent and server receipt (mocked)', async ({page}) => {
  await page.addInitScript(() => {
    window.__academyMockRequests=[];
    const original=window.fetch.bind(window);
    window.fetch=(url,options)=>{
      if(String(url).includes('/functions/v1/imperion-academy-intake')){
        window.__academyMockRequests.push(JSON.parse(options.body));
        return Promise.resolve(new Response(JSON.stringify({
          ok:true,status:'RECEIVED_UNCONFIRMED',reference:'qa-mock-uuid',
          confirmed:false,bookingConfirmed:false,paymentCollected:false
        }),{status:200,headers:{'Content-Type':'application/json'}}));
      }
      return original(url,options);
    };
  });
  await page.goto('/academy/programmes/?lang=cs&programme=A2&utm_source=a2_quiz&utm_medium=site&utm_campaign=life_milestones_20261105');
  await expect(page.locator('#programme')).toHaveValue('A2');
  await page.locator('#first-name').fill('Test QA');
  await page.locator('#contact-email').fill('qa-intake@example.invalid');
  await page.locator('#goal').fill('A2 exam practice');
  await page.locator('#deadline').fill('February 2027');
  await expect(page.locator('#adult-confirm')).not.toBeChecked();
  await expect(page.locator('#privacy-confirm')).not.toBeChecked();
  await page.locator('#send-enquiry').click();
  expect(await page.evaluate(()=>window.__academyMockRequests)).toHaveLength(0);
  await page.locator('#adult-confirm').check();
  await page.locator('#privacy-confirm').check();
  await page.locator('#send-enquiry').click();
  await expect(page.locator('#intake-status')).toContainText('Poptávka přijata');
  await expect(page.locator('#send-enquiry')).toBeDisabled();
  const requests=await page.evaluate(()=>window.__academyMockRequests);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    firstName:'Test QA',email:'qa-intake@example.invalid',programme:'A2',
    locale:'cs',utmSource:'a2_quiz',utmMedium:'site',
    utmCampaign:'life_milestones_20261105',adultOrGuardianConfirmed:true,
    privacyAcknowledged:true
  });
});

test('Academy enquiry on backend error clearly asks for WhatsApp/email fallback', async ({page}) => {
  await page.route('**/functions/v1/imperion-academy-intake', async route=>{
    await route.fulfill({status:503,headers:{'Access-Control-Allow-Origin':'*','Content-Type':'application/json'},
      body:JSON.stringify({error:'temporarily_unavailable'})});
  });
  await page.goto('/academy/programmes/?lang=en');
  await page.locator('#first-name').fill('Test QA');
  await page.locator('#contact-email').fill('qa-intake@example.invalid');
  await page.locator('#adult-confirm').check();
  await page.locator('#privacy-confirm').check();
  await page.locator('#send-enquiry').click();
  await expect(page.locator('#intake-status')).toContainText('did not confirm delivery');
  await expect(page.locator('#send-enquiry')).toBeEnabled();
  await expect(page.locator('#whatsapp-compose')).toBeVisible();
  await expect(page.locator('#email-compose')).toBeVisible();
});

test('Academy single lesson requests preferred Prague time without claiming a calendar booking',async({page})=>{
 await page.addInitScript(()=>{
  window.__academyTestRequests=[];
  const previous=window.fetch.bind(window);
  window.fetch=(url,opts)=>{
    if(String(url).includes('/functions/v1/imperion-academy-intake')){
      window.__academyTestRequests.push(JSON.parse(opts.body));
      return Promise.resolve(new Response(JSON.stringify({ok:true,status:'RECEIVED_UNCONFIRMED',reference:'qa-lesson-test',confirmed:false,bookingConfirmed:false,paymentCollected:false}),{status:200,headers:{'Content-Type':'application/json'}}));
    }
    return previous(url,opts);
  };
 });
 await page.setViewportSize({width:390,height:844});
 await page.goto('/academy/programmes/?lang=ru&programme=LESSON#enquire');
 await expect(page.locator('#programme')).toHaveValue('LESSON');
 await expect(page.locator('#academy-preference-note')).toContainText('НЕ проверенная');
 const later=new Date(Date.now()+10*86400000).toISOString().slice(0,10);
 await page.locator('#academy-request-day').fill(later);
 await page.locator('#academy-request-time').fill('10:30');
 await page.locator('#first-name').fill('Quality Check');
 await page.locator('#contact-email').fill('qa-test@example.invalid');
 await page.locator('#adult-confirm').check();
 await page.locator('#privacy-confirm').check();
 await page.locator('#send-enquiry').click();
 await expect(page.locator('#intake-status')).toContainText('Запрос принят');
 const sent=await page.evaluate(()=>window.__academyTestRequests);
 expect(sent).toHaveLength(1);
 expect(sent[0]).toMatchObject({programme:'LESSON',locale:'ru',privacyAcknowledged:true,adultOrGuardianConfirmed:true});
 expect(sent[0].deadline).toContain(later+' 10:30 Europe/Prague (not a reservation)');
});
