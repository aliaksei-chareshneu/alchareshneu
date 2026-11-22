'use strict';
const {test,expect}=require('@playwright/test');
const API='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
const COPY={
  cs:{title:'Učte se. Hýbejte se.',sub:'Objevujte Brno.',nav:'Hlavní navigace',lang:'Jazyk stránky',skip:'Přejít na hlavní obsah',brand:'Učení · pohyb · zážitky v Brně'},
  en:{title:'Learn. Move.',sub:'Discover Brno.',nav:'Main navigation',lang:'Page language',skip:'Skip to main content',brand:'Learning · movement · experiences in Brno'},
  ru:{title:'Учись. Двигайся.',sub:'Открывай Брно.',nav:'Основная навигация',lang:'Язык страницы',skip:'Перейти к содержимому',brand:'Обучение · движение · впечатления в Брно'},
  uk:{title:'Навчайся. Рухайся.',sub:'Відкривай Брно.',nav:'Головна навігація',lang:'Мова сторінки',skip:'Перейти до основного вмісту',brand:'Навчання · рух · пригоди в Брно'}
};
async function isolatedEvents(page){
 await page.route(API,r=>r.fulfill({status:200,contentType:'application/json',
  headers:{'Access-Control-Allow-Origin':'*'},body:'{"events":[]}'}));
}
for(const [lang,copy] of Object.entries(COPY)){
 test('UX standards: active front door accessible and localized '+lang,async({page})=>{
  await isolatedEvents(page);
  await page.setViewportSize({width:390,height:844});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?lang='+lang);
  await expect(page.locator('html')).toHaveAttribute('data-imperion-frontdoor','ready');
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('#fdHero1')).toHaveText(copy.title);
  await expect(page.locator('#fdHero2')).toHaveText(copy.sub);
  await expect(page.locator('#fdNav')).toHaveAttribute('aria-label',copy.nav);
  await expect(page.locator('.fd-languages')).toHaveAttribute('aria-label',copy.lang);
  await expect(page.locator('#fdBrandSubtitle')).toHaveText(copy.brand);
  await expect(page.locator('#fdSkip')).toHaveText(copy.skip);
  await expect(page.locator('#fdSkip')).toHaveAttribute('href','#fdMain');
  await expect(page.locator('#fdMain')).toHaveAttribute('tabindex','-1');
  await expect(page.locator('#fdVisualGrid > .fd-visual-tile')).toHaveCount(3);
  await expect(page.locator('#fdEntityNote')).toContainText('Družina Moravy, z. s.');
  await expect(page.locator('#fdEntityNote')).toContainText('Aliaksei Chareshneu');
  for(const [key,where] of [['Academy','academy/'],['Druzina','druzina/'],['Walkers','walkers/']]){
    await expect(page.locator('#fdVisual'+key)).toHaveAttribute('href',where+'?lang='+lang);
  }
  await page.keyboard.press('Tab');
  await expect(page.locator('#fdSkip')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#fdMain$/);
  await expect(page.locator('#fdMain')).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
 });
 test('UX standards: More menu closes via Escape and outside tap '+lang,async({page})=>{
  await isolatedEvents(page);
  await page.goto('/?lang='+lang);
  const menu=page.locator('#fdNav .fd-more');
  await menu.locator('summary').click();
  await expect(menu).toHaveAttribute('open','');
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open','');
  await expect(menu.locator('summary')).toBeFocused();
  await menu.locator('summary').click();
  await expect(menu).toHaveAttribute('open','');
  await page.locator('#fdHero1').click();
  await expect(menu).not.toHaveAttribute('open','');
 });
}
for(const width of [320,390,768,1440]){
 test('UX standards: three picture-based choices reflow without overflow '+width,async({page})=>{
  await isolatedEvents(page);
  await page.setViewportSize({width,height:860});
  await page.goto('/?lang=en');
  await expect(page.locator('#fdVisualGrid > a:visible')).toHaveCount(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  for(const link of await page.locator('#fdVisualGrid a.fd-visual-tile').all()){
   const b=await link.boundingBox();
   expect(b).not.toBeNull();
   expect(b.width).toBeGreaterThan(150);
  }
 });
}
