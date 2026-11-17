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
 {path:'/partners/?lang=ru',section:'partners'},
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
  await expect(h.locator('nav.imp-shell-links a')).toHaveCount(7);
  await expect(h.locator('nav.imp-shell-links a[aria-current="page"]')).toHaveCount(target.section?1:0);
  if(target.section)await expect(h.locator('nav.imp-shell-links a[aria-current="page"]')).toHaveAttribute('data-imp-link',target.section);
  await expect(page.locator('[data-imp-retired-nav="1"]:visible')).toHaveCount(0);
  for(const item of await h.locator('nav.imp-shell-links a').all()){
   const dest=await item.getAttribute('href');
   expect(new URL(dest,page.url()).pathname).toMatch(/^(?:\/|\/(?:about|academy|druzina|walkers|partners)\/)$/);
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
 await expect(page).toHaveURL(/\/academy\/\?lang=ru/);
 await expect(page.locator('#imp-shell-top')).toBeVisible();
 await page.locator('#imp-shell-links [data-imp-link="club"]').click();
 await expect(page).toHaveURL(/\/druzina\/\?lang=ru/);
 await expect(page.locator('.tabs-bar:visible')).toHaveCount(0);
 await page.locator('#imp-shell-links [data-imp-link="walkers"]').click();
 await expect(page).toHaveURL(/\/walkers\/\?lang=ru/);
 await page.locator('#imp-shell-links [data-imp-link="about"]').click();
 await expect(page).toHaveURL(/\/about\/\?lang=ru/);
 await expect(page.locator('main h1')).toContainText('За проектами');
 await expect(page.locator('.imp-about-actions a')).toHaveCount(3);
 await expect(page.locator('.imp-about-partners-cta')).toHaveAttribute('href','../partners/?lang=ru');
});
test('About from frontdoor opens current page, never the hidden legacy home',async({page})=>{
 await mockPublicEvents(page);
 await page.goto('/?lang=en');
 await expect(page.locator('#fdNavAbout')).toHaveAttribute('href','about/?lang=en');
 await page.locator('#fdNavAbout').click();
 await expect(page).toHaveURL(/\/about\/\?lang=en$/);
 await expect(page.locator('main h1')).toContainText('One person');
 await expect(page.locator('a.imp-about-primary')).toHaveAttribute('href',/\/academy\/\?lang=en$/);
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
for(const code of ['cs','en','ru','uk']){
 test('Academy offers four problem-first directions in '+code,async({page})=>{
  await page.goto('/academy/?lang='+code);
  await expect(page.locator('html')).toHaveAttribute('lang',code);
  await expect(page.locator('#academy-choose .goal-jump')).toHaveCount(4);
  await expect(page.locator('#academy-choose .goal-detail')).toHaveCount(4);
  await expect(page.locator('#academy-choose .goal-option')).toHaveCount(12);
  const heading=await page.locator('#academy-choose h2').textContent();
  expect(heading).toMatch(code==='ru'?/проблему/:code==='uk'?/проблему/:code==='en'?/problem/:/pomoci/);
  for(const selector of ['.hero .hero-ctas a[data-i18n="academy.ctaRegister"]','#navBookBtn','#mobileCta .mobile-cta-btn']){
   await expect(page.locator(selector)).toHaveAttribute('href','#academy-choose');
   await expect(page.locator(selector)).not.toHaveAttribute('target','_blank');
  }
  await page.locator('#academy-choose .goal-jump').first().click();
  await expect(page).toHaveURL(/#goal-languages$/);
  await expect(page.locator('#goal-languages .goal-option')).toHaveCount(3);
  await expect(page.locator('#goal-languages .goal-option a')).toHaveCount(3);
  const link=await page.locator('#goal-languages .goal-option a').first().getAttribute('href');
  expect(link).toBe('#academy-service-picker');
  await expect(page.locator('#academy-selected-service .academy-service-option')).toHaveCount(0);
  await page.locator('#goal-languages .goal-option a').first().click();
  await expect(page.locator('#academy-selected-service .academy-service-option')).toHaveCount(3);
  await expect(page.locator('.hero-photo--scholar').first()).toHaveCount(1);
  await page.goto('/academy/courses/?lang='+code);
  await expect(page.locator('html')).toHaveAttribute('lang',code);
  await expect(page.locator('#imp-shell-top [data-imp-lang="uk"]')).toHaveCount(1);
  await expect(page.locator('article.course')).toHaveCount(31);
  if(code==='uk'){
   await expect(page.locator('article.course#CZ01 h3 [data-locale="uk"]')).toContainText('Чеська');
   await expect(page.locator('article.course#CZ01 h3 [data-locale="ru"]:visible')).toHaveCount(0);
  }
 });
}
for(const code of ['cs','en','ru','uk']){
 test('Alex z Brna uses shared navigation and a localized story in '+code,async({page})=>{
  await page.goto('/brno-stories/?lang='+code);
  await expect(page.locator('#imp-shell-top')).toBeVisible();
  await expect(page.locator('#imp-shell-top [data-imp-lang="uk"]')).toHaveCount(1);
  await expect(page.locator('#imp-shell-top nav.imp-shell-links a')).toHaveCount(7);
  await expect(page.locator('html')).toHaveAttribute('lang',code);
  await expect(page.locator('main [data-story="firstTitle"]')).not.toBeEmpty();
  if(code==='uk')await expect(page.locator('main h1')).toContainText('У Брно більше історій');
  if(code==='ru')await expect(page.locator('main h1')).toContainText('В Брно больше историй');
  await expect(page.locator('header[data-imp-retired-nav="1"]:visible')).toHaveCount(0);
 });
}
for(const code of ['cs','en','ru','uk']){
 test('Digital shop preserves all four site languages and disabled checkout '+code,async({page})=>{
  await page.route('**/imperion-digital-store/health',route=>route.fulfill({
   status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},
   body:'{"products":[]}'
  }));
  await page.goto('/shop/?lang='+code);
  await expect(page.locator('#imp-shell-top')).toBeVisible();
  await expect(page.locator('#imp-shell-top [data-imp-lang="uk"]')).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('lang',code);
  await expect(page.locator('main article.card')).toHaveCount(2);
  await expect(page.locator('main article.card .price').first()).toHaveText('490 Kč');
  await expect(page.locator('main article.card .price').last()).toHaveText('690 Kč');
  await expect(page.locator('[data-digital-product]:not([disabled])')).toHaveCount(0);
  await expect(page.locator('#checkout-consent .check a[href="./legal/"]')).toHaveCount(1);
  if(code==='uk'){
   await expect(page.locator('.hero h1')).toContainText('Корисні інструменти');
   await expect(page.locator('#shop-status')).toContainText('Оплату тимчасово закрито');
  }
 });
}
test('Walkers historic cancelled hike is a collapsed archival refund notice below hero',async({page})=>{
 await page.goto('/walkers/?lang=cs');
 const archives=page.locator('#imp-walkers-archives');
 await expect(archives).toBeVisible();
 await archives.locator(':scope > summary').click();
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

test('Shared navigation follows in-page locale switches and saved locale',async({page})=>{
 await mockPublicEvents(page);
 await page.goto('/druzina/?lang=cs');
 await expect(page.locator('#imp-shell-links [data-imp-link="home"]')).toHaveText('Úvod');
 // The legacy page selector is visually retired by the unified shell, but still
 // dispatches the original local rendering logic.
 await page.evaluate(()=>document.querySelector('#langSwitch button[data-lang="ru"]').click());
 await expect(page.locator('html')).toHaveAttribute('lang','ru');
 await expect(page.locator('#imp-shell-links [data-imp-link="home"]')).toHaveText('Главная');
 await expect(page.locator('#imp-shell-top [data-imp-lang="ru"]')).toHaveAttribute('aria-current','true');
 await expect(page.locator('#imp-shell-links [data-imp-link="academy"]')).toHaveAttribute('href',/lang=ru/);
 await expect(page.locator('#imp-shell-top .imp-shell-logo-copy small')).toContainText('ИСТОРИЯ');
 await page.goto('/academy/');
 await expect(page.locator('html')).toHaveAttribute('lang','ru');
 await expect(page.locator('#imp-shell-links [data-imp-link="home"]')).toHaveText('Главная');
});

const localeIntegrity={
 cs:{home:'Úvod',corporate:'Poptat nabídku →',skip:'Přejít k obsahu'},
 en:{home:'Home',corporate:'Request a proposal →',skip:'Skip to content'},
 ru:{home:'Главная',corporate:'Запросить предложение →',skip:'Перейти к содержанию'},
 uk:{home:'Головна',corporate:'Запросити пропозицію →',skip:'Перейти до вмісту'}
};
for(const [code,expected] of Object.entries(localeIntegrity)){
 test('No mixed-language public labels in '+code,async({page})=>{
  await mockPublicEvents(page);
  await page.goto('/druzina/?lang='+code);
  await expect(page.locator('html')).toHaveAttribute('lang',code);
  await expect(page.locator('#imp-shell-links [data-imp-link="home"]')).toHaveText(expected.home);
  // This legacy registration block is intentionally hidden by the current
  // conversion-first design. Verify child locale gating via computed style,
  // not Playwright :visible, which also counts hidden ancestors.
  const regLanguages=await page.locator('#new-training-enquiry [data-reg-lang]').evaluateAll(nodes=>
   nodes.filter(x=>getComputedStyle(x).display!=='none').map(x=>x.dataset.regLang));
  expect(regLanguages).toEqual([code,code,code]);
  const hubLanguages=await page.locator('#november-events-hub [data-november-lang]').evaluateAll(nodes=>
   nodes.filter(x=>getComputedStyle(x).display!=='none').map(x=>x.dataset.novemberLang));
  expect(hubLanguages).toEqual([code]);

  await page.goto('/academy/?lang='+code);
  const shown=await page.locator('.tab-btn [data-courses-nav-lang]').evaluateAll(nodes=>
   nodes.filter(x=>getComputedStyle(x).display!=='none').map(x=>x.dataset.coursesNavLang));
  expect(shown).toEqual([code]);

  await page.goto('/corporate/?lang='+code);
  const corporate=page.locator('.revenue-row a.btn.solid[href^="mailto:"][data-locale]:visible');
  await expect(corporate).toHaveCount(1);
  await expect(corporate).toHaveText(expected.corporate);

  await page.goto('/register/?lang='+code);
  // The historical 28 October cancellation notice expires on 4 November 2026.
  // Do not assert its translations: the live script intentionally removes it.
  await expect(page.locator('#bw-cancel-20261028')).toHaveCount(0);

  await page.goto('/druzina/novinky/?lang='+code);
  await expect(page.locator('a.skip-link')).toHaveText(expected.skip);
 });
}

for(const [code,expected] of Object.entries({
 cs:'Ceník tréninků Družina Moravy',
 en:'Družina Moravy training prices',
 ru:'Цены на тренировки Družina Moravy',
 uk:'Ціни на тренування Družina Moravy'
})){
 test('Training price page uses '+code+' throughout visible copy and correct registration URLs',async({page})=>{
  await page.goto('/druzina/permanentky/?lang='+code);
  await expect(page.locator('html')).toHaveAttribute('lang',code);
  await expect(page.locator('body > header:not(#imp-shell-top) h1')).toHaveText(expected);
  await expect(page.locator('#current-training-prices .notice p[lang]:visible')).toHaveCount(1);
  await expect(page.locator('#current-training-prices .notice p[lang="'+code+'"]')).toBeVisible();
  await expect(page.locator('section[aria-labelledby="languages-pricing"] details:visible')).toHaveCount(1);
  await expect(page.locator('.price-grid .price')).toHaveCount(3);
  await expect(page.locator('.price-grid .price .big')).toHaveText(['240 Kč','120 Kč','800 Kč']);
  for(const link of await page.locator('.price-grid .act').all()){
   await expect(link).toHaveAttribute('href','../../register/?lang='+code);
  }
  await expect(page.locator('#imp-shell-links [data-imp-link="home"]')).toHaveText(localeIntegrity[code].home);
 });
}

for(const code of ['cs','en','ru','uk']){
 test('Druzina training paths do not mix languages in '+code,async({page})=>{
  await page.goto('/druzina/cesty/?lang='+code);
  await expect(page.locator('html')).toHaveAttribute('lang',code);
  await expect(page.locator('#spolecne-temy h2 [data-shared-lang]:visible')).toHaveCount(1);
  await expect(page.locator('#spolecne-temy h2 [data-shared-lang="'+code+'"]')).toBeVisible();
  await expect(page.locator('#spolecne-temy > div[data-shared-lang]:visible')).toHaveCount(1);
  await expect(page.locator('#training-programme-archive [data-status-lang]:visible')).toHaveCount(1);
  await expect(page.locator('#training-programme-archive [data-status-lang="'+code+'"]')).toBeVisible();
  await expect(page.locator('#spolecne-temy div[data-shared-lang="'+code+'"] a').first()).toHaveAttribute('href','../rules/?lang='+code);
 });
}

for(const code of ['cs','en','ru','uk']){
 test('Safety briefing shows only chosen language '+code,async({page})=>{
  await page.goto('/druzina/safety/?lang='+code);
  await expect(page.locator('html')).toHaveAttribute('lang',code);
  await expect(page.locator('main h1 [data-safety-ui]:visible')).toHaveCount(1);
  await expect(page.locator('main > section[lang]:visible')).toHaveCount(1);
  await expect(page.locator('main > section[lang="'+code+'"]')).toBeVisible();
  await expect(page.locator('#safety-contact [data-safety-ui]:visible')).toHaveCount(1);
  await expect(page.locator('#safety-contact [data-safety-ui="'+code+'"]')).toBeVisible();
  await expect(page.locator('main > .notice:first-of-type [data-safety-ui]:visible')).toHaveCount(1);
  await expect(page.locator('main #ru h3').last()).toContainText('Страховка');
  if(code!=='ru')await expect(page.locator('main #ru h3:visible')).toHaveCount(0);
 });
}

for(const code of ['cs','en','ru','uk']){
 test('Registration privacy notice remains one language in '+code,async({page})=>{
  await page.goto('/register/privacy/?lang='+code);
  await expect(page.locator('html')).toHaveAttribute('lang',code);
  await expect(page.locator('main h1 [data-privacy-ui]:visible')).toHaveCount(1);
  await expect(page.locator('main h1 [data-privacy-ui="'+code+'"]')).toBeVisible();
  await expect(page.locator('main > section[lang]:visible')).toHaveCount(1);
  await expect(page.locator('main > section[lang="'+code+'"]')).toBeVisible();
  await expect(page.locator('#privacy-back')).toHaveAttribute('href','../?lang='+code);
 });
}
