'use strict';
const {test,expect}=require('@playwright/test');
const API='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
async function mockCatalog(page,records=[]){
 await page.route(API,r=>r.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({events:records})}));
}
test('homepage has visible Google review badge and genuine public screenshot gallery below the calendar',async({page})=>{
 await mockCatalog(page);
 await page.goto('/?lang=ru');
 await expect(page.locator('#imp-google-review-badge')).toBeVisible();
 await expect(page.locator('#imp-google-review-badge')).toHaveAttribute('href','https://maps.app.goo.gl/fEbnJHxiVoAx1v498');
 await expect(page.locator('#imp-home-reviews .imp-review-item')).toHaveCount(6);
 const gallery=await page.locator('#imp-home-reviews').evaluate(el=>({
   calendarBefore:document.querySelector('#impr-calendar')?.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING,
   names:Array.from(el.querySelectorAll('img')).map(x=>x.getAttribute('src'))
 }));
 expect(gallery.calendarBefore).toBeTruthy();
 expect(gallery.names.every(x=>x.startsWith('images/reviews/review_'))).toBe(true);
 await expect(page.locator('#imp-home-reviews')).not.toContainText('55');
});
test('home category deep link filters club and shows tentative weekly Mondays without bookable event IDs',async({page})=>{
 await mockCatalog(page);
 await page.goto('/?lang=ru&category=club#impr-calendar');
 await expect(page.locator('[data-fd-filter="club"]')).toHaveAttribute('aria-pressed','true');
 const day=page.locator('#fdDays .fd-day-recurring').first();
 await expect(day).toBeVisible();
 await day.click();
 await expect(page.locator('#fdDetails')).toBeVisible();
 await expect(page.locator('#fdBook')).toHaveAttribute('data-status','tentative');
 const url=await page.locator('#fdBook').getAttribute('href');
 expect(url).toMatch(/^https:\/\/wa\.me\/420702914842/);
 expect(url).not.toContain('PREVIEW-ONLY-');
 await page.locator('#fdClose').click();
 await page.locator('#fdNext').click();
 await expect(page.locator('#fdDays .fd-day-recurring')).not.toHaveCount(0);
});
for(const lang of ['cs','en','ru','uk']){
 test('registration calendar uses the same informational Monday preview, no fake booking: '+lang,async({page})=>{
  await mockCatalog(page);
  let path=lang==='cs'?'/register/':'/register/'+lang+'/';
  await page.goto(path+'?lang='+lang);
  await expect(page.locator('#calendarGrid .calendar-day.has-recurring-preview').first()).toBeVisible();
  await page.locator('#calendarGrid .calendar-day.has-recurring-preview').first().click();
  let anchor=page.locator('#calendarDayEvents .calendar-option-preview');
  await expect(anchor).toHaveCount(1);
  expect(await anchor.first().getAttribute('href')).toMatch(/^https:\/\/wa\.me\/420702914842/);
  expect(await page.locator('#eventId').inputValue()).not.toMatch(/PREVIEW-ONLY/);
 });
}
for(const lang of ['cs','en','ru','uk']){
 test('Academy searchable subjects, three choices and collapsed full price list: '+lang,async({page})=>{
  await page.goto('/academy/?lang='+lang);
  const picker=page.locator('#academy-service-picker');
  await expect(picker).toBeVisible();
  const search=page.locator('#academy-service-search');
  await search.fill('Chem');
  await expect(page.locator('#academy-service-options [role="option"]').first()).toBeVisible();
  await page.locator('#academy-service-options [role="option"]').first().click();
  await expect(page.locator('#academy-selected-service .academy-service-option')).toHaveCount(3);
  await expect(page.locator('#academy-selected-service .academy-custom')).toHaveCount(1);
  for(const a of await page.locator('#academy-selected-service .academy-service-option a').all()){
   expect(await a.getAttribute('href')).toMatch(/^order\/\?lang=/);
  }
  await expect(page.locator('#academy-prices-brief .academy-price-tile')).toHaveCount(4);
  await expect(page.locator('#academy-full-prices')).not.toHaveAttribute('open','');
  await page.locator('#academy-prices-brief .academy-prices-open').click();
  await expect(page.locator('#academy-full-prices')).toHaveAttribute('open','');
  await expect(page.locator('#academy-full-prices .price-cat')).toHaveCount(9);
  await expect(page.locator('#academy-choose .goal-jump')).toHaveCount(4);
 });
}
test('Academy free A2 button is legible at a high contrast ratio',async({page})=>{
 await page.goto('/academy/?lang=cs');
 const sample=await page.locator('main .hero a[href^="a2/"]').evaluate(el=>{
  const css=getComputedStyle(el);
  return {c:css.color,b:css.backgroundColor};
 });
 function luminance(v){
  const nums=(v.match(/\d+(?:\.\d+)?/g)||[]).slice(0,3).map(Number).map(x=>{
   const y=x/255;return y<=.04045?y/12.92:Math.pow((y+.055)/1.055,2.4);
  });
  return nums[0]*.2126+nums[1]*.7152+nums[2]*.0722;
 }
 const a=luminance(sample.c),b=luminance(sample.b);
 const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 expect(ratio).toBeGreaterThan(5.5);
});
test('Družina prominently shows a real upcoming or tentative next activity and first visit basics',async({page})=>{
 await mockCatalog(page);
 await page.goto('/druzina/?lang=ru');
 await expect(page.locator('#imp-club-next')).toBeVisible();
 await expect(page.locator('#imp-club-essentials .imp-facts > *')).toHaveCount(3);
 await expect(page.locator('#imp-club-next .imp-quick-links a')).toHaveCount(2);
 await expect(page.locator('#imp-club-next .imp-quick-links a').nth(1)).toHaveAttribute('href',/\?lang=ru&category=club#impr-calendar/);
 await expect(page.locator('#imp-club-archives')).toHaveCount(1);
 const visual=await page.locator('#druzina .hero-visuals').evaluate(el=>getComputedStyle(el).opacity);
 expect(Number(visual)).toBeGreaterThan(.9);
});
test('BrnoWalkers ranger first, one filtered calendar CTA and old announcements in disclosure',async({page})=>{
 await mockCatalog(page);
 await page.goto('/walkers/?lang=ru');
 const first=await page.locator('main#page-content').evaluate(el=>el.firstElementChild?.id);
 expect(first).toBe('walkers');
 await expect(page.locator('#imp-walkers-essentials')).toBeVisible();
 await expect(page.locator('#imp-walkers-archives > summary')).toBeVisible();
 await expect(page.locator('#imp-walkers-essentials a[href*="category=walkers"]')).toHaveCount(1);
 const visual=await page.locator('#walkers .hero-visuals').evaluate(el=>getComputedStyle(el).opacity);
 expect(Number(visual)).toBeGreaterThan(.9);
});
for(const lang of ['cs','en','ru','uk']){
 test('About stays a distinct page and links to a factual Partners page: '+lang,async({page})=>{
  await page.goto('/about/?lang='+lang);
  await expect(page.locator('main#imp-page-content')).toBeVisible();
  await expect(page.locator('#about-partner-link')).toHaveAttribute('href','../partners/?lang='+lang);
  await page.locator('#about-partner-link').click();
  await expect(page).toHaveURL(new RegExp('/partners/\\?lang='+lang));
  await expect(page.locator('.partner-locale:visible')).toHaveCount(1);
  await expect(page.locator('.partner-card:visible')).toHaveCount(6);
  await expect(page.locator('.partner-locale:visible')).toContainText('Brno iD');
 });
}
test('no unintended x-scroll on Academy prices, 390px mobile',async({page})=>{
 await page.setViewportSize({width:390,height:840});
 await page.goto('/academy/?lang=ru');
 await page.locator('#academy-prices-brief .academy-prices-open').click();
 const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));
 expect(width.scroll).toBeLessThanOrEqual(width.inner+1);
});
