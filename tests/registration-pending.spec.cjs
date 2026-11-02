const {test, expect} = require('@playwright/test');
const endpoint = 'https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
const event = {
  event_id:'SYNTHETIC-PENDING', title:'Synthetic registration test',
  begins_at:new Date(Date.now()+14*86400000).toISOString(),
  ends_at:new Date(Date.now()+14*86400000+3600000).toISOString(),
  venue:'Test venue', community:'BrnoWalkers', category:'Hike', price_czk:0,
  is_open:true, registration_mode:'FORM', price_verified:true, end_time_verified:true,
  contact_activity:false
};

for (const lang of ['cs','en','ru','uk']) {
  test(`pending registration stays locked across language changes: ${lang}`, async ({page}) => {
    let posts = 0;
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    await page.route(endpoint, async route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({json:{events:[event]}});
      }
      posts++;
      await pending;
      return route.fulfill({status:503, json:{error:'synthetic-unavailable'}});
    });
    await page.goto('/register/'+(lang==='cs'?'':lang+'/'));
    await page.locator('#firstName').fill('Synthetic');
    await page.locator('#lastName').fill('Example');
    await page.locator('#email').fill('synthetic@example.test');
    await page.locator('#phone').fill('+420 777 111 222');
    await page.locator('#safety').check();
    try {
      await page.locator('#submit').click();
      await expect.poll(() => posts).toBe(1);
      await page.locator(`[data-lang="${lang==='ru'?'en':'ru'}"]`).click();
      await expect(page.locator('#submit')).toBeDisabled();
      await page.evaluate(() => document.querySelector('#rsvpForm').requestSubmit());
    } finally {
      release();
    }
    await expect(page.locator('#result')).toBeVisible();
    await expect(page.locator('#submit')).toBeEnabled();
    await expect(page.locator('#email')).toHaveValue('synthetic@example.test');
    expect(posts).toBe(1);
    await page.locator('#submit').click();
    await expect.poll(() => posts).toBe(2);
    await expect(page.locator('#submit')).toBeEnabled();
  });
}
