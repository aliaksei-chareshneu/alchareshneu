
const {test,expect}=require('@playwright/test');
const ENDPOINT='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
const base={
 community:'BrnoWalkers / OSVČ',category:'Hike',price_czk:100,price_verified:true,end_time_verified:true,
 source_active:true,is_open:true,registration_mode:'CONTACT',data_controller:'Aliaksei Chareshneu (OSVČ)',
 public_note:'Illustrative fixture, not a live booking'
};
const fixtures=[
 {...base,event_id:'PUB-TEST-BRNO-1',title:'Brno group walk',begins_at:'2026-11-18T17:00:00Z',venue:'Brno hlavní nádraží'},
 {...base,event_id:'PUB-TEST-BRNO-2',title:'Board games Brno',category:'Board Game',begins_at:'2026-11-18T18:30:00Z',venue:'Brno-střed'},
 {...base,event_id:'PUB-TEST-PRAHA-1',title:'Praha guided walk',begins_at:'2026-11-18T19:00:00Z',venue:'Praha 1, Old Town'},
 {...base,event_id:'PUB-TEST-OTHER-1',title:'Olomouc walk',begins_at:'2026-11-18T19:30:00Z',venue:'Olomouc center'},
 {...base,event_id:'PUB-TEST-HEMABRNO',title:'Club session',category:'HEMA Training',community:'Družina Moravy',begins_at:'2026-11-16T17:00:00Z',venue:'Nová Zbrojovka, Brno',price_czk:240,data_controller:'Družina Moravy z.s.'}
];
async function prepare(page,events=fixtures){
 await page.clock.install({time:new Date('2026-11-11T20:30:00+01:00')});
 let mutations=0;
 await page.route(ENDPOINT,r=>{
   if(r.request().method()!=='GET'){mutations++;return r.fulfill({status:405,contentType:'application/json',body:'{}'});}
   return r.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({events})});
 });
 await page.route('https://script.google.com/**',r=>r.fulfill({contentType:'application/javascript',body:'/* fixture */'}));
 return ()=>mutations;
}
for(const width of [320,390,1440]){
 test('two hero paths, photo shadows, compact nav and no overflow '+width,async({page})=>{
  await page.setViewportSize({width,height:860});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const mutations=await prepare(page);
  await page.goto('/?lang=ru');
  await expect(page.locator('html')).toHaveAttribute('data-imperion-frontdoor','ready');
  await expect(page.locator('#fdHeroLabel')).toHaveText('Выбрать событие');
  await expect(page.locator('#fdHeroSub')).toContainText('BrnoWalkers');
  await expect(page.locator('#fdAcademyLabel')).toHaveText('Записаться на урок в Академии');
  await expect(page.locator('#fdHeroCta')).toHaveAttribute('href','#impr-calendar');
  const academyHref=await page.locator('#fdAcademyCta').getAttribute('href');
  const academyWhatsApp=new URL(academyHref);
  expect(academyWhatsApp.origin+academyWhatsApp.pathname).toBe('https://wa.me/420702914842');
  expect(academyWhatsApp.searchParams.get('text')).toContain('[ACADEMY:FRONTDOOR]');
  await expect(page.locator('#fdAcademyCta')).toHaveAttribute('rel',/noopener/);
  await expect(page.locator('#fdAcademyNote')).toContainText('согласуем лично');
  await expect(page.locator('#fdNavAcademy')).toHaveAttribute('href','academy/?lang=ru');
  await expect(page.locator('#fdNavClub')).toHaveAttribute('href','druzina/?lang=ru');
  await expect(page.locator('#fdNavWalkers')).toHaveAttribute('href','walkers/?lang=ru');
  await expect(page.locator('#fdNavAbout')).toHaveAttribute('href','?lang=ru&view=details');
  await expect(page.locator('.fd-fighters')).toHaveCount(0);
  await expect(page.locator('.fd-photo-shadows span')).toHaveCount(0);
  await expect(page.locator('.fd-photo-shadows')).toHaveCSS('background-image',/imperion-hero-cinematic-20261112\.webp/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  if(width<=390){
   await expect(page.locator('#fdHeroCta')).toBeInViewport();
   await expect(page.locator('#fdAcademyCta')).toBeInViewport();
  }
  await page.locator('.fd-hero').screenshot({path:'test-results/frontdoor-v4-'+width+'-hero.png'});
  await page.locator('#fdHeroCta').click();
  await expect(page).toHaveURL(/#impr-calendar$/);
  await expect(page.locator('#fdDays button[aria-label^="2026-11-18"]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
  expect(mutations()).toBe(0);
 });
}
for(const [lang,calendar,academy] of [
 ['cs','Vybrat akci','Přihlásit se na lekci Akademie'],
 ['en','Choose an event','Book an Academy lesson'],
 ['ru','Выбрать событие','Записаться на урок в Академии'],
 ['uk','Обрати подію','Записатися на урок Академії']
]){
 test('two CTAs and usable header links '+lang,async({page})=>{
  await prepare(page);
  await page.goto('/?lang='+lang);
  await expect(page.locator('#fdHeroLabel')).toHaveText(calendar);
  await expect(page.locator('#fdAcademyLabel')).toHaveText(academy);
  await expect(page.locator('#fdNavAcademy')).toHaveAttribute('href','academy/?lang='+lang);
  const academyLink=new URL(await page.locator('#fdAcademyCta').getAttribute('href'));
  expect(academyLink.origin+academyLink.pathname).toBe('https://wa.me/420702914842');
  expect(academyLink.searchParams.get('text')).toContain('[ACADEMY:FRONTDOOR]');
  await expect(page.locator('#fdNavEvents')).toHaveAttribute('href','#impr-calendar');
  await page.locator('[data-fd-language="en"]').click();
  const academyEnglish=new URL(await page.locator('#fdAcademyCta').getAttribute('href'));
  expect(academyEnglish.searchParams.get('text')).toContain('Hello');
  expect(academyEnglish.searchParams.get('text')).toContain('[ACADEMY:FRONTDOOR]');
  await expect(page.locator('#fdNavAbout')).toHaveAttribute('href','?lang=en&view=details');
 });
}
test('calendar shows a separate symbol and Prague local start time for each listed activity',async({page})=>{
 await prepare(page);
 await page.goto('/?lang=cs');
 const day=page.locator('#fdDays button[aria-label^="2026-11-18"]');
 await expect(day).toBeVisible();
 await expect(day.locator('.fd-day-activity')).toHaveCount(3);
 await expect(day.locator('.fd-day-time')).toHaveText(['18:00','19:30','20:00']);
 await expect(day.locator('.fd-more-desktop')).toHaveText('+1');
 await expect(day.locator('.fd-more-mobile')).toHaveText('+2');
 await day.click();
 await expect(page.locator('#fdDetails')).toBeVisible();
 await expect(page.locator('#fdVariants button')).toHaveCount(4);
 await page.locator('#fdClose').click();
 await page.locator('[data-fd-city="prague"]').click();
 await expect(page.locator('[data-fd-city="prague"]')).toHaveAttribute('aria-pressed','true');
 await expect(day.locator('.fd-day-time')).toHaveText(['20:00']);
 await day.click();
 await expect(page.locator('#fdEventTitle')).toContainText('Praha guided walk');
 await page.locator('#fdClose').click();
 await page.locator('[data-fd-city="brno"]').click();
 await expect(day.locator('.fd-day-time')).toHaveText(['18:00','19:30']);
 await page.locator('[data-fd-city="other"]').click();
 await expect(day.locator('.fd-day-time')).toHaveText(['20:30']);
 await page.locator('[data-fd-filter="club"]').click();
 await expect(page.locator('#fdFallback')).toBeVisible();
 await expect(page.locator('#fdFallbackHint')).toContainText('zvolené místo');
 await page.locator('[data-fd-city="all"]').click();
 await expect(page.locator('#fdDays button[aria-label^="2026-11-16"]')).toBeVisible();
});
test('Prague filter remains honest when catalog contains only Brno events',async({page})=>{
 const mutations=await prepare(page,fixtures.filter(e=>!e.venue.includes('Praha')));
 await page.goto('/?lang=ru');
 await page.locator('[data-fd-city="prague"]').click();
 await expect(page.locator('#fdFallback')).toBeVisible();
 await expect(page.locator('#fdFallbackHint')).toContainText('нет проверенных');
 await expect(page.locator('#fdDays button')).toHaveCount(0);
 await expect(page.locator('#fdFallbackLink')).toHaveAttribute('href','calendar/');
 expect(mutations()).toBe(0);
});
