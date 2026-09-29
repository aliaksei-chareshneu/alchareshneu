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
  if(path==='druzina/')for(const price of ['120 Kč','240 Kč','910 Kč','455 Kč'])expect(await page.locator('body').innerText()).toContain(price);
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
 await mockEvents(page,[null,{},valid]);await page.goto('/calendar/?lang=en');await expect(page.locator('.eu-title')).toHaveText(valid.title);await expect(page.locator('.eu-title img')).toHaveCount(0);await expect(page.locator('.eu-ctas a').first()).toHaveAttribute('href',/https:\/\/docs.google.com\/forms/);await expect(page.locator('.eu-date')).toContainText('18:00');
 await page.unroute('https://script.google.com/**');await page.route('https://script.google.com/**',r=>r.abort());await page.reload();await expect(page.locator('#calEventsBody')).toHaveAttribute('data-event-status','error');await expect(page.locator('.events-empty-message')).toContainText('temporarily unavailable');await expect(page.locator('.events-empty-message a')).toHaveCount(3);
});
test('empty and cold-start timeout keep calendar and announcements available',async({page})=>{
 await mockEvents(page);await page.goto('/calendar/?lang=cs');await expect(page.locator('#calEventsBody')).toHaveAttribute('data-event-status','ready');await expect(page.locator('.events-empty-message')).toContainText('Naplánuj');
 await page.unroute('https://script.google.com/**');await page.route('https://script.google.com/**',()=>{});await page.reload();await expect(page.locator('#calEventsBody')).toHaveAttribute('data-event-status','error',{timeout:16000});await expect(page.locator('.calendar-cta-btn')).toBeVisible();
});
