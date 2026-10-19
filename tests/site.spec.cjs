const {test,expect}=require('@playwright/test');
const pages=['','academy/','druzina/','walkers/','calendar/'];
const languages=['en','ru','cs','uk'];
const widths=[360,390,430,768,1440];
async function mockEvents(page, events=[]) {
 await page.route('https://script.google.com/**',route=>{const cb=new URL(route.request().url()).searchParams.get('callback');return route.fulfill({contentType:'application/javascript',body:`${cb}(${JSON.stringify({events})})`});});
 await page.route('https://calendar.google.com/**',r=>r.fulfill({contentType:'text/html',body:'Calendar embed test fixture'}));
}
for(const path of pages)for(const language of languages)for(const width of widths) {
 test(`${path||'home'} ${language} ${width}`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width,height:900});await mockEvents(page);
  await page.goto('/'+path+'?lang='+language);await expect(page.locator('html')).toHaveAttribute('data-enhanced','true');
  await expect(page.locator('html')).toHaveAttribute('lang',language);await expect(page.locator('h1')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const bad=await page.evaluate(()=>{
   const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);
   const duplicates=ids.filter((v,i)=>ids.indexOf(v)!==i);
   const broken=[...document.querySelectorAll('main a[href^="#"]')].filter(a=>a.hash.length>1&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash);
   return {duplicates,broken};
  });expect(bad.duplicates).toEqual([]);expect(bad.broken).toEqual([]);
  if(path==='druzina/') {
   await expect(page.locator('#registration-notice')).toBeVisible();
   await expect(page.locator('#registration-notice [data-notice-lang="'+language+'"]')).toBeVisible();
   await expect(page.locator('#tariff')).toBeHidden();
   await expect(page.locator('#druzina-payment')).toBeHidden();
   await expect(page.locator('#navBookBtn')).toHaveAttribute('href', language==='ru' ? /^https:\/\/t\.me\/Chareshneu/ : /^https:\/\/wa\.me\/420702914842\?/);
   const message=await page.locator('#registration-notice [data-notice-lang="'+language+'"]').innerText();
   expect(message.length).toBeGreaterThan(80);
  }
  if(path==='academy/') {await page.locator('#service-search').fill('zzzznomatch');await expect(page.locator('.search-status')).not.toBeEmpty();await expect(page.locator('.price-cat:visible')).toHaveCount(0);await page.locator('#service-search').fill('');await expect(page.locator('.price-cat:visible')).toHaveCount(9);}
  if(path)await expect(page.locator('.tabs-bar a.active')).toHaveCount(1);
  await page.screenshot({path:`test-results/${path.replace('/','')||'home'}-${language}-${width}.png`,fullPage:false});
  expect(errors).toEqual([]);
 });
}
test('language persistence, catalog anchors, keyboard and back navigation',async({page})=>{
 await mockEvents(page);await page.goto('/?lang=en');await expect(page.locator('html')).toHaveAttribute('data-enhanced','true');
 await page.getByRole('button',{name:'Русский',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('lang','ru');
 await page.locator('.venture-card[href="academy/"]').click();await expect(page.locator('html')).toHaveAttribute('lang','ru');
 await page.locator('[data-service="price-fit"]').first().click();await expect(page).toHaveURL(/#price-fit$/);await expect(page.locator('#price-fit')).toBeInViewport();
 await page.goBack();await page.goBack();await expect(page.locator('h1')).toContainText('Учись');
 await page.keyboard.press('Control+Home');await page.keyboard.press('Tab');
});
test('event content is escaped, malformed entries ignored and failures actionable',async({page})=>{
 const valid={title:'<img src=x onerror=alert(1)>',description:'<script>bad()</script>',startISO:'2099-10-01T16:00:00Z',priceCzk:'<img>',registerUrl:'javascript:alert(1)',locationName:'Brno',category:'Hike',community:'Brnowalkers'};
 await mockEvents(page,[null,{},valid]);await page.goto('/calendar/?lang=en');await expect(page.locator('.eu-title')).toHaveText(valid.title);await expect(page.locator('.eu-title img')).toHaveCount(0);await expect(page.locator('.eu-ctas a').first()).toHaveAttribute('href',await page.locator('#navBookBtn').getAttribute('href'));await expect(page.locator('.eu-date')).toContainText('18:00');
 await page.unroute('https://script.google.com/**');await page.route('https://script.google.com/**',r=>r.abort());await page.reload();await expect(page.locator('#calEventsBody')).toHaveAttribute('data-event-status','error');await expect(page.locator('.events-empty-message')).toContainText('temporarily unavailable');await expect(page.locator('.events-empty-message a')).toHaveCount(3);
});
test('empty and cold-start timeout keep calendar and announcements available',async({page})=>{
 await mockEvents(page);await page.goto('/calendar/?lang=cs');await expect(page.locator('#calEventsBody')).toHaveAttribute('data-event-status','ready');await expect(page.locator('.events-empty-message')).toContainText('Naplánuj');
 await page.unroute('https://script.google.com/**');await page.route('https://script.google.com/**',()=>{});await page.reload({waitUntil:'commit'});await expect(page.locator('#calEventsBody')).toHaveAttribute('data-event-status','error',{timeout:16000});await expect(page.locator('.calendar-cta-btn')).toBeVisible();
});


test('calendar stays available with populated API and deduplicates stable Event_IDs', async ({page}) => {
 const event={id:'EVT-20261019-A',title:'Public event',description:'Please confirm attendance',startISO:'2099-11-01T11:00:00Z',isFree:true,priceCzk:0,category:'Hike',community:'Brnowalkers',registerUrl:'https://t.me/Chareshneu',locationName:'Brno'};
 await mockEvents(page,[event,{...event,title:'Duplicate event'}]);
 await page.goto('/calendar/?lang=en');
 await expect(page.locator('#public-calendar-frame')).toBeVisible();
 await expect(page.locator('#public-calendar-frame')).toHaveAttribute('src',/calendar\\.google\\.com\\/calendar\\/embed\\?/);
 await expect(page.locator('.event-upcoming-card')).toHaveCount(1);
 await expect(page.locator('.eu-title')).toHaveText('Public event');
 await expect(page.locator('.eu-ctas a')).toHaveCount(1);
 await expect(page.locator('.eu-ctas a')).toHaveAttribute('href','https://t.me/Chareshneu');
 await expect(page.locator('.eu-ctas')).toContainText('Ask the organiser');
 await expect(page.locator('.calendar-booking-note')).toContainText('does not confirm a place');
 await expect(page.locator('.hero-ctas a')).toHaveAttribute('href',/calendar\\.google\\.com\\/calendar\\/u\\/0\\/r\\?cid=/);
});
test('public calendar survives API failure in four languages and paid HEMA never opens checkout', async ({page}) => {
 const paid={id:'HEMA-PAID',title:'Training',description:'Details in contact',startISO:'2099-11-02T17:00:00Z',isFree:false,priceCzk:240,category:'HEMA Training',community:'Družina Moravy',registerUrl:'https://docs.google.com/forms/d/fake-paid-form',locationName:'Brno'};
 await mockEvents(page,[paid]);
 for(const lang of ['en','cs','ru','uk']) {
  await page.goto('/calendar/?lang='+lang);
  await expect(page.locator('#public-calendar-frame')).toBeVisible();
  await expect(page.locator('.calendar-booking-note')).not.toBeEmpty();
  await expect(page.locator('.event-upcoming-card')).toHaveCount(1);
  await expect(page.locator('.eu-price-note')).not.toBeEmpty();
  const cardHref=await page.locator('.eu-ctas a').getAttribute('href');
  expect(cardHref).toEqual(await page.locator('#navBookBtn').getAttribute('href'));
  expect(cardHref).not.toContain('fake-paid-form');
 }
 await page.unroute('https://script.google.com/**');
 await page.route('https://script.google.com/**',r=>r.abort());
 await page.reload();
 await expect(page.locator('#calEventsBody')).toHaveAttribute('data-event-status','error');
 await expect(page.locator('#public-calendar-frame')).toBeVisible();
 await expect(page.locator('#public-calendar-frame')).toHaveCount(1);
});

test('portrait event photos stay bounded at the mobile breakpoint', async ({page})=>{
 const events=['portrait','landscape'].map(shape=>({title:'Layout fixture',description:'Short fixture description.',startISO:'2099-10-01T16:00:00Z',priceCzk:100,registerUrl:'https://docs.google.com/forms/',locationName:'Brno',category:'Hike',community:'Brnowalkers',imageOverride:'calendar-test-'+shape+'.svg'}));
 await mockEvents(page,events);
 await page.route('**/images/calendar-test-*.svg',route=>{
  const portrait=route.request().url().includes('portrait');
  return route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${portrait?600:4000}" height="${portrait?3000:1200}"><rect width="100%" height="100%" fill="#456"/></svg>`});
 });
 for(const width of [360,560,561,768,1440]){
  await page.setViewportSize({width,height:900});
  await page.goto('/calendar/?lang=en');
  await expect(page.locator('.event-upcoming-card')).toHaveCount(2);
  await page.locator('.eu-img').first().scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll('.eu-img img')].every(i=>i.complete && i.naturalWidth>0));
  const sizes=await page.locator('.event-upcoming-card').evaluateAll(cards=>cards.map(c=>({card:c.getBoundingClientRect().height,image:c.querySelector('.eu-img').getBoundingClientRect().height})));
  for(const s of sizes){expect(s.card).toBeLessThan(750);if(width<=560)expect(s.image).toBe(140);}
  expect(Math.abs(sizes[0].card-sizes[1].card)).toBeLessThan(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
});
test('direct enquiries respect language after repeated switches',async({page})=>{
 await mockEvents(page);await page.goto('/academy/?lang=en');
 await expect(page.locator('html')).toHaveAttribute('data-enhanced','true');
 for(const language of ['ru','cs','en','ru','uk','en']){
  await page.locator(`#langSwitch [data-lang="${language}"]`).click();
  const expected=language==='ru'?'https://t.me/Chareshneu':'https://wa.me/420702914842';
  await expect(page.locator('.service-action')).toHaveCount(9);
  for(const a of await page.locator('.service-action').all())expect(await a.getAttribute('href')).toContain(expected);
  await expect(page.locator('.mobile-cta-icon')).toHaveAttribute('aria-label',language==='ru'?'Telegram':'WhatsApp');
 }
});
