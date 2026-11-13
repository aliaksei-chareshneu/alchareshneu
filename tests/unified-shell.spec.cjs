'use strict';
const {test,expect}=require('@playwright/test');
const api='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
async function mockPublicEvents(page){
 await page.route(api,r=>r.fulfill({status:200,contentType:'application/json',
  headers:{'Access-Control-Allow-Origin':'*'},body:'{"events":[]}'}));
}
const sections=[
 {path:'/academy/?lang=ru',section:'academy',hero:true},
 {path:'/druzina/?lang=ru',section:'club',hero:true},
 {path:'/walkers/?lang=ru',section:'walkers',hero:true},
 {path:'/calendar/?lang=ru',section:'events'},
 {path:'/about/?lang=ru',section:'about'},
 {path:'/academy/courses/?lang=ru',section:'academy'},
 {path:'/academy/programmes/?lang=ru',section:'academy'},
 {path:'/druzina/cesty/?lang=ru',section:'club'},
 {path:'/druzina/novinky/?lang=ru',section:'club'},
 {path:'/corporate/?lang=ru',section:null},
 {path:'/start/?lang=ru',section:null},
 {path:'/register/ru/?lang=ru',section:null},
 {path:'/shop/?lang=cs',section:null}
];
for(const target of sections){
 test('one permanent site navigation: '+target.path,async({page})=>{
  await mockPublicEvents(page);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1270,height:900});
  await page.goto(target.path);
  const h=page.locator('#imp-shell-top');
  await expect(h).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-imp-nav-ready','yes');
  await expect(h.locator('nav.imp-shell-links a')).toHaveCount(6);
  await expect(h.locator('nav.imp-shell-links a[aria-current="page"]')).toHaveCount(target.section?1:0);
  if(target.section)await expect(h.locator('nav.imp-shell-links a[aria-current="page"]')).toHaveAttribute('data-imp-link',target.section);
  await expect(page.locator('[data-imp-retired-nav="1"]:visible')).toHaveCount(0);
  for(const item of await h.locator('nav.imp-shell-links a').all()){
   const dest=await item.getAttribute('href');
   expect(new URL(dest,page.url()).pathname).toMatch(/^(?:\/|\/(?:about|academy\/courses|druzina|walkers)\/)$/);
  }
  if(target.hero)await expect(page.locator('main .hero .hero-ctas > a:visible')).toHaveCount(2);
  const wide=await h.evaluate(el=>el.getBoundingClientRect().width);
  expect(wide).toBeLessThanOrEqual(1271);
  expect(errors).toEqual([]);
 });
}
test('Main -> Academy -> Druzina -> BrnoWalkers -> About retains language and one menu',async({page})=>{
 await mockPublicEvents(page);
 await page.goto('/?lang=ru');
 await expect(page.locator('html')).toHaveAttribute('data-imperion-frontdoor','ready');
 await page.locator('#fdNavAcademy').click();
 await expect(page).toHaveURL(/\/academy\/courses\/\?lang=ru/);
 await expect(page.locator('#imp-shell-top')).toBeVisible();
 await page.locator('#imp-shell-links [data-imp-link="club"]').click();
 await expect(page).toHaveURL(/\/druzina\/\?lang=ru/);
 await expect(page.locator('.tabs-bar:visible')).toHaveCount(0);
 await page.locator('#imp-shell-links [data-imp-link="walkers"]').click();
 await expect(page).toHaveURL(/\/walkers\/\?lang=ru/);
 await page.locator('#imp-shell-links [data-imp-link="about"]').click();
 await expect(page).toHaveURL(/\/about\/\?lang=ru/);
 await expect(page.locator('main h1')).toContainText('За проектами');
 await expect(page.locator('.imp-about-actions a')).toHaveCount(2);
});
test('About from frontdoor opens current page, never the hidden legacy home',async({page})=>{
 await mockPublicEvents(page);
 await page.goto('/?lang=en');
 await expect(page.locator('#fdNavAbout')).toHaveAttribute('href','about/?lang=en');
 await page.locator('#fdNavAbout').click();
 await expect(page).toHaveURL(/\/about\/\?lang=en$/);
 await expect(page.locator('main h1')).toContainText('One person');
 await expect(page.locator('a.imp-about-primary')).toHaveAttribute('href',/\/academy\/courses\/\?lang=en$/);
});
test('Language switching in localized form retains selected event and attribution',async({page})=>{
 await mockPublicEvents(page);
 await page.goto('/register/ru/?lang=ru&event=PUB-TEST-20991231&src=manual');
 await expect(page.locator('#imp-shell-top')).toBeVisible();
 const dest=await page.locator('#imp-shell-top [data-imp-lang="en"]').getAttribute('href');
 const u=new URL(dest);
 expect(u.pathname).toBe('/register/en/');
 expect(u.searchParams.get('event')).toBe('PUB-TEST-20991231');
 expect(u.searchParams.get('src')).toBe('manual');
 await page.locator('#imp-shell-top [data-imp-lang="en"]').click();
 await expect(page).toHaveURL(/\/register\/en\//);
 await expect(page.locator('html')).toHaveAttribute('lang','en');
});
for(const width of [320,390,768,1440]){
 test('unified header fits viewport '+width,async({page})=>{
  await mockPublicEvents(page);
  await page.setViewportSize({width,height:820});
  await page.goto('/walkers/?lang=cs');
  const nav=page.locator('#imp-shell-top');
  await expect(nav).toBeVisible();
  const dims=await nav.evaluate(el=>{
   const r=el.getBoundingClientRect(),inner=el.querySelector('.imp-shell-inner');
   const n=inner.getBoundingClientRect();
   return {left:r.left,right:r.right,innerLeft:n.left,innerRight:n.right};
  });
  expect(dims.left).toBeGreaterThanOrEqual(-1);
  expect(dims.right).toBeLessThanOrEqual(width+1);
  expect(dims.innerLeft).toBeGreaterThanOrEqual(0);
  expect(dims.innerRight).toBeLessThanOrEqual(width+1);
  await expect(page.locator('main .hero .hero-ctas > a:visible')).toHaveCount(2);
 });
}
for(const code of ['cs','ru','uk']){
 test('Academy entrypoints are catalogue-first ('+code+')',async({page})=>{
  await page.goto('/academy/?lang='+code);
  const expected='courses/?lang='+(code==='uk'?'cs':code);
  for(const selector of ['.hero .hero-ctas a[data-i18n="academy.ctaRegister"]','#navBookBtn','#mobileCta .mobile-cta-btn']){
   const href=await page.locator(selector).getAttribute('href');
   const url=new URL(href,page.url());
   expect(url.pathname).toBe('/academy/courses/');
   expect(url.searchParams.get('lang')).toBe(code==='uk'?'cs':code);
  }
  const label=await page.locator('.hero .hero-ctas a[data-i18n="academy.ctaRegister"]').textContent();
  expect(label).toMatch(code==='ru'?/Выбрать курс/:code==='uk'?/Обрати курс/:/Vybrat kurz/);
  await expect(page.locator('.hero .hero-ctas a[data-i18n="academy.ctaRegister"]')).not.toHaveAttribute('target','_blank');
  await page.locator('.hero .hero-ctas a[data-i18n="academy.ctaRegister"]').click();
  await expect(page).toHaveURL(new RegExp('/academy/courses/\\?lang='+(code==='uk'?'cs':code)+'$'));
  expect(await page.locator('article.course').count()).toBeGreaterThan(3);
  await expect(page.locator('article.course a.cta[href^="https://wa.me/420702914842"]')).not.toHaveCount(0);
 });
}
test('Walkers historic cancelled hike is a collapsed archival refund notice below hero',async({page})=>{
 await page.goto('/walkers/?lang=cs');
 const notice=page.locator('#bw-cancel-20261028');
 await expect(notice).toBeVisible();
 await expect(notice).toHaveJSProperty('open',false);
 await expect(page.locator('#bw-cancel-20261028 > summary')).toContainText('28. 10. 2026');
 const positioned=await page.evaluate(()=>{
  const hero=document.querySelector('main .hero'),note=document.querySelector('#bw-cancel-20261028');
  return hero&&note&&note.compareDocumentPosition(hero)&Node.DOCUMENT_POSITION_PRECEDING;
 });
 expect(Boolean(positioned)).toBe(true);
 await notice.locator('summary').click();
 await expect(notice.locator('a[href^="mailto:"]')).toBeVisible();
});
