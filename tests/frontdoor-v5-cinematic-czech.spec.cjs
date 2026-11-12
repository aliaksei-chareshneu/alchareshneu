
'use strict';
const {test,expect}=require('@playwright/test');
const ENDPOINT='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
const b={category:'Hike',community:'BrnoWalkers / OSVČ',data_controller:'Aliaksei Chareshneu OSVČ',
 price_czk:100,price_verified:true,end_time_verified:true,source_active:true,is_open:true,registration_mode:'FORM',
 public_note:'Public activity information. Please contact the organiser for confirmation.'};
const events=[
 {...b,event_id:'PUB-OREL-20261114',title:'Free beginner HEMA workshop',category:'HEMA Training',community:'Družina Moravy',
  data_controller:'Družina Moravy, z. s.',price_czk:0,begins_at:'2026-11-14T11:00:00Z',venue:'Orlovna Husovice, Brno'},
 {...b,event_id:'PUB-HEMA-20261116',title:'Club training',category:'HEMA Training',community:'Družina Moravy',
  data_controller:'Družina Moravy, z. s.',price_czk:240,begins_at:'2026-11-16T17:00:00Z',venue:'Brno · to confirm'},
 {...b,event_id:'PUB-WALK-BRNO-20261118',title:'Walk in Brno',begins_at:'2026-11-18T17:30:00Z',venue:'Brno center'},
 {...b,event_id:'PUB-WALK-PRAHA-20261118',title:'Prague city walk',begins_at:'2026-11-18T18:30:00Z',venue:'Praha 1'},
 {...b,event_id:'PUB-WALK-OTHER-20261121',title:'Olomouc walk',begins_at:'2026-11-21T10:30:00Z',venue:'Olomouc'},
 {...b,event_id:'PUB-HIKE-20261128',title:'Future hiking activity',begins_at:'2026-11-28T09:30:00Z',venue:'Brno'}
];
async function prepare(page,data=events){
 await page.clock.install({time:new Date('2026-11-12T06:30:00+01:00')});
 let posts=0;await page.route(ENDPOINT,r=>{
  if(r.request().method()!=='GET'){posts++;return r.fulfill({status:405,body:'{}'});}
  return r.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({events:data})});
 });
 await page.route('https://script.google.com/**',r=>r.fulfill({contentType:'application/javascript',body:'/* safe */'}));
 return ()=>posts;
}
test('bare URL defaults to Czech even after a previous RU choice was cached',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('dm_lang','ru');});
 await prepare(page);
 await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('data-imperion-frontdoor','ready');
 await expect(page.locator('html')).toHaveAttribute('lang','cs');
 await expect(page.locator('#fdHero1')).toHaveText('Vyberte si svůj další');
 await expect(page.locator('#fdHeroLabel')).toHaveText('Vybrat akci');
 await expect(page.locator('[data-fd-language="cs"]')).toHaveAttribute('aria-pressed','true');
 await page.goto('/?lang=ru');
 await expect(page.locator('html')).toHaveAttribute('lang','ru');
 await expect(page.locator('#fdHeroLabel')).toHaveText('Выбрать событие');
 await page.goto('/');
 await expect(page.locator('#fdHero1')).toHaveText('Vyberte si svůj další');
 await expect(page.locator('html')).toHaveAttribute('lang','cs');
 await page.goto('/?view=details');
 await expect(page.locator('#imperion-frontdoor')).toHaveCount(0);
 await expect(page.locator('html')).toHaveAttribute('lang','cs');
});
for(const width of [320,390,1440]){
 test('cinematic hero is live HTML, three panels and an honest event list '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:850});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  const posts=await prepare(page);
  await page.goto('/');
  await expect(page.locator('#fdHeroCta')).toHaveAttribute('href','#impr-calendar');
  await expect(page.locator('#fdAcademyCta')).toHaveAttribute('href',/wa\.me\/420702914842\?text=/);
  await expect(page.locator('.fd-fighters')).toHaveCount(0);
  await expect(page.locator('.fd-photo-shadows span')).toHaveCount(0);
  await expect(page.locator('.fd-photo-shadows')).toHaveCSS('background-image',/imperion-hero-cinematic-20261112\.webp/);
  await expect(page.locator('#fdFacetTitle')).toHaveText('Filtrovat');
  await expect(page.locator('#fdUpcomingTitle')).toHaveText('Akce v tomto měsíci');
  await expect(page.locator('#fdUpcoming .fd-upcoming-event')).toHaveCount(5);
  await expect(page.locator('#fdUpcoming .fd-upcoming-event').first()).toContainText('Šerm pro začátečníky');
  await expect(page.locator('#fdUpcoming .fd-upcoming-event').nth(1)).toContainText('Historický šerm');
  await expect(page.locator('#fdUpcoming')).toContainText('Praha');
  const panels=await page.locator('.fd-stage').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').filter(Boolean).length);
  expect(panels).toBe(width===1440?3:1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  const image=await page.request.get('/images/imperion-hero-cinematic-20261112.webp');
  expect(image.status()).toBe(200);expect(image.headers()['content-type']).toContain('image/webp');
  await page.locator('.fd-hero').screenshot({path:'test-results/imperion-v5-'+width+'-hero.png'});
  await page.locator('.fd-stage').screenshot({path:'test-results/imperion-v5-'+width+'-calendar.png'});
  expect(errs).toEqual([]);
  expect(posts()).toBe(0);
 });
}
test('event list opens exact event, displays correct price and preserves opt-in payment conditions',async({page})=>{
 const posts=await prepare(page);
 await page.goto('/');
 await page.locator('#fdUpcoming .fd-upcoming-event').nth(1).click();
 await expect(page.locator('#fdDetails')).toBeVisible();
 await expect(page.locator('#fdEventTitle')).toContainText('Historický šerm');
 await expect(page.locator('#fdFacts')).toContainText('240 Kč');
 await expect(page.locator('#fdFacts')).toContainText('Družina Moravy, z. s.');
 await expect(page.locator('#fdPaymentTerms')).toBeVisible();
 await expect(page.locator('#fdPaymentTerms')).not.toHaveAttribute('open','');
 await expect(page.locator('#fdPaymentContactIntro')).toBeHidden();
 await page.locator('#fdPaymentSummary').click();
 await expect(page.locator('#fdPaymentTiming')).toContainText('+25 %');
 await expect(page.locator('#fdPaymentCancellation')).toContainText('48 hodin');
 await page.keyboard.press('Escape');
 await expect(page.locator('#fdDetails')).toBeHidden();
 await page.locator('#fdUpcoming .fd-upcoming-event').first().click();
 await expect(page.locator('#fdFacts')).toContainText('Zdarma');
 await expect(page.locator('#fdPaymentTerms')).toBeHidden();
 expect(posts()).toBe(0);
});
test('city and category filters only use actual event venue; reset restores catalog',async({page})=>{
 await prepare(page);
 await page.goto('/');
 await page.locator('[data-fd-city="prague"]').click();
 await expect(page.locator('#fdUpcoming .fd-upcoming-event')).toHaveCount(1);
 await expect(page.locator('#fdUpcoming')).toContainText('Prague city walk');
 await page.locator('[data-fd-filter="club"]').click();
 await expect(page.locator('#fdUpcoming')).toContainText('Žádné potvrzené');
 await page.locator('#fdReset').click();
 await expect(page.locator('[data-fd-city="all"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-fd-filter="all"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#fdUpcoming .fd-upcoming-event')).toHaveCount(5);
});
test('empty or offline event feed shows honest status, keeps Academy lesson CTA',async({page})=>{
 await prepare(page,[]);
 await page.goto('/');
 await expect(page.locator('#fdUpcoming')).toContainText('Žádné potvrzené veřejné termíny');
 await expect(page.locator('#fdUpcoming .fd-upcoming-event')).toHaveCount(0);
 await expect(page.locator('#fdAcademyCta')).toHaveAttribute('href',/wa\.me\/420702914842/);
 await expect(page.locator('#fdFallback')).toBeVisible();
});
