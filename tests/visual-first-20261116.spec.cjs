'use strict';
const {test,expect}=require('@playwright/test');
const endpoint='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
async function mock(page){
 await page.route(endpoint,route=>route.fulfill({
  status:200,contentType:'application/json',
  headers:{'Access-Control-Allow-Origin':'*'},body:'{"events":[]}'
 }));
 await page.route('https://script.google.com/**',route=>route.fulfill({
  contentType:'application/javascript',body:'/* test: no private writes */'
 }));
}
const destinations=[
 ['Academy','academy/','icon-academy.svg'],
 ['Druzina','druzina/','icon-druzina.svg'],
 ['Walkers','walkers/','icon-walkers.svg']
];
for(const lang of ['cs','en','ru','uk']){
 test('live homepage exposes localized visual destinations and keeps original actions '+lang,async({page})=>{
  await mock(page);
  await page.setViewportSize({width:390,height:844});
  const jsErrors=[];page.on('pageerror',e=>jsErrors.push(e.message));
  await page.goto('/?lang='+lang);
  await expect(page.locator('html')).toHaveAttribute('data-imperion-frontdoor','ready');
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('#fdVisualGrid a.fd-visual-tile')).toHaveCount(3);
  for(const [id,dest,icon] of destinations){
   const item=page.locator('#fdVisual'+id);
   await expect(item).toHaveAttribute('href',dest+'?lang='+lang);
   await expect(item).toBeVisible();
   const bounds=await item.boundingBox();
   expect(bounds.width).toBeGreaterThan(275);
   expect(bounds.height).toBeGreaterThanOrEqual(120); // Compact cards fit three directions on mobile
   const image=item.locator('img');
   expect(await image.evaluate(el=>el.complete&&el.naturalWidth>0)).toBeTruthy();
   const bg=await item.locator('.fd-visual-icon').evaluate(el=>getComputedStyle(el).backgroundImage);
   expect(bg).toContain(icon);
   await expect(item.locator('strong')).not.toBeEmpty();
   await expect(item.locator('em')).not.toBeEmpty();
  }
  await expect(page.locator('#fdHeroCta')).toHaveAttribute('href','#impr-calendar');
  await expect(page.locator('#fdAcademyCta')).toHaveAttribute('href','academy/?lang='+lang);
  await expect(page.locator('#fdValueNow')).toContainText(/./);
  await expect(page.locator('#fdValueThen')).toContainText(/./);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  expect(jsErrors).toEqual([]);
 });
}
for(const width of [320,768,1440]){
 test('visual cards fit without horizontal scrolling at '+width,async({page})=>{
  await mock(page);
  await page.setViewportSize({width,height:900});
  await page.goto('/?lang=cs');
  await expect(page.locator('#fdVisualGrid a')).toHaveCount(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  const sizes=await page.locator('.fd-visual-tile').evaluateAll(els=>els.map(el=>({
   w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height
  })));
  expect(sizes.every(x=>x.w>=width*.26&&x.h>=120)).toBeTruthy();
 });
}
test('no-JS detail fallback remains photo-led with verified existing CTA paths',async({page})=>{
 await mock(page);
 await page.goto('/?view=details&lang=en');
 await expect(page.locator('#imperion-frontdoor')).toHaveCount(0);
 await expect(page.locator('#goal-paths .intent-card')).toHaveCount(3);
 await expect(page.locator('#heroCta')).toHaveAttribute('href',/academy\/programmes\//);
 await expect(page.locator('#intentDruzinaCta')).toHaveAttribute('href',/register\//);
 const photo=page.locator('#goal-paths .intent-card').first().locator('img');
 await expect(photo).toHaveAttribute('src','images/hero-scholar.webp');
});
test('BrnoWalkers opens with image hero before preserved dated notices',async({page})=>{
 await page.goto('/walkers/?lang=cs');
 const order=await page.locator('main#page-content').evaluate(el=>{
  const children=[...el.children].map(c=>c.id||c.className);
  return {hero:children.indexOf('walkers'),announcement:children.indexOf('bw-december-proposals')};
 });
 expect(order.hero).toBeGreaterThanOrEqual(0);
 expect(order.announcement).toBeGreaterThan(order.hero);
 await expect(page.locator('#bw-december-proposals')).toContainText('NOT confirmed bookings');
 await expect(page.locator('#walkers .hero-ctas a.btn.solid')).toHaveAttribute('href',/\.\.\/calendar\//);
 // The 18 Nov walk was cancelled for insufficient confirmed attendees.
 // Keep the cancellation notice visible; no registration must reopen for this event.
 await expect(page.locator('#bw-walktalk-nov-2026')).toContainText('Registration is closed');
 await expect(page.locator('#bw-walktalk-nov-2026 a[href*="register/"]')).toHaveCount(0);
 // The legacy cancellation panel itself is hidden by the current visual design,
 // so assert the four non-registration archive links without forcing it open.
 await expect(page.locator('#bw-walktalk-nov-2026 a[href*="walktalk-november-2026.html"]')).toHaveCount(4);
});

for(const lang of ['cs','en','ru','uk']){
 test('BrnoWalkers cancellation and registration labels follow '+lang,async({page})=>{
  await page.goto('/walkers/?lang='+lang);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  // The dated cancellation panel is intentionally hidden by the new hero layout.
  // Check its own locale CSS independently of any hidden ancestor.
  const shown=await page.locator('#bw-walktalk-nov-2026 [data-bw-cancel-lang]').evaluateAll(els=>
   els.filter(el=>getComputedStyle(el).display!=='none').map(el=>el.dataset.bwCancelLang));
  expect(shown).toEqual([lang]);
  await expect(page.locator('#bw-walktalk-nov-2026 a[href*="register/"]')).toHaveCount(0);
  const reg=await page.locator('#new-website-registration [data-bw-register-lang]').evaluateAll(els=>
   els.filter(el=>getComputedStyle(el).display!=='none').map(el=>el.dataset.bwRegisterLang));
  expect(reg).toEqual([lang,lang,lang]);
 });
}
