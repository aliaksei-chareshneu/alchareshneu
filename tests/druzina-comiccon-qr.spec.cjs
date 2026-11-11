'use strict';
const {test,expect}=require('@playwright/test');
const route='/druzina/start/?lang=cs&src=CCBJ14';
function readWhatsApp(href){
 const u=new URL(href);
 if(u.hostname!=='wa.me'||u.pathname!=='/420702914842')throw Error('wrong_contact');
 return u.searchParams.get('text')||'';
}
async function verifyEnquiries(page,source='CCBJ14'){
 for(const sel of ['#nextTraining','#question']){
  const href=await page.locator(sel).getAttribute('href');
  expect(href,sel).toMatch(/^https:\/\/wa\.me\/420702914842\?text=/);
  const body=readWhatsApp(href);
  expect(body,sel+' should retain the real QR source').toContain('[DM:'+source+']');
  expect(body,sel+' should ask rather than auto-book').toMatch(/trenink|trénink|training|занят|трениров|тренуван|поді|akce|акц|activity/i);
  await expect(page.locator(sel)).toHaveAttribute('target','_blank');
  await expect(page.locator(sel)).toHaveAttribute('rel',/noopener/);
 }
}
for(const size of [{width:320,height:640},{width:390,height:844},{width:1440,height:900}]){
 test('Comic-Con QR paid enquiry, source and layout '+size.width+'px',async({page})=>{
  await page.setViewportSize(size);
  await page.clock.install({time:new Date('2026-11-14T16:20:00+01:00')});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(route);
  await expect(page.locator('html')).toHaveAttribute('lang','cs');
  await expect(page.locator('.intro')).toBeHidden();
  await expect(page.locator('#nextTraining')).toBeVisible();
  await expect(page.locator('#nextTraining')).toContainText('240 Kč');
  await expect(page.locator('#nextNote')).toContainText('800 Kč');
  await expect(page.locator('#nextNote')).toContainText('48 h');
  await expect(page.locator('#nextNote')).toContainText('25 %');
  await verifyEnquiries(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  expect(await page.locator('#nextTraining').evaluate(x=>{
   const b=x.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth+1&&b.width>=200;
  })).toBe(true);
  expect(await page.locator('#nextTraining').evaluate(x=>x.getBoundingClientRect().top)).toBeLessThan(size.height);
  expect(await page.locator('.media img').evaluate(x=>x.complete&&x.naturalWidth>0)).toBe(true);
  await expect(page.locator('#main > .wrap.trust')).toHaveCSS('display','block');
  await page.screenshot({path:'test-results/ccbj14-'+size.width+'px.png',fullPage:true});
  expect(errors).toEqual([]);
 });
}
test('four languages retain Comic-Con source through switching and both CTA paths',async({page})=>{
 await page.clock.install({time:new Date('2026-11-14T16:20:00+01:00')});
 await page.goto(route);
 for(const [lang,cta] of [['cs','240 Kč'],['en','240 Kč'],['ru','240 Kč'],['uk','240 Kč']]){
  await page.locator('button[data-lang="'+lang+'"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('#nextTraining')).toContainText(cta);
  await verifyEnquiries(page);
  const pageUrl=new URL(page.url());
  expect(pageUrl.searchParams.get('src')).toBe('CCBJ14');
  expect(pageUrl.searchParams.get('lang')).toBe(lang);
  expect(new URL(await page.locator('#details').getAttribute('href'),page.url()).searchParams.get('src')).toBe('CCBJ14');
  await expect(page.locator('.intro')).toBeHidden();
 }
 await expect(page.locator('#action')).toHaveAttribute('href','https://chat.whatsapp.com/DuTpgF22mxMFy6L1Cfrcvu');
 await page.locator('button[data-lang="ru"]').click();
 await expect(page.locator('#action')).toHaveAttribute('href','https://t.me/druzinamoravy_news');
});
test('untrusted src is never incorporated into a WhatsApp draft',async({page})=>{
 await page.goto('/druzina/start/?lang=cs&src='+encodeURIComponent('<img src=x onerror=alert(1)>'));
 await verifyEnquiries(page,'START');
 await expect(page.locator('#nextTraining')).toBeVisible();
});
test('free 14 Nov workshop remains available only to non-demo sources before cutoff',async({page})=>{
 await page.clock.install({time:new Date('2026-11-11T13:00:00+01:00')});
 await page.goto('/druzina/start/?lang=cs&src=START');
 await expect(page.locator('.intro')).toBeVisible();
 await expect(page.locator('.intro')).toHaveCSS('display','flex');
 await expect(page.locator('#introCta')).toHaveAttribute('href',/event=PUB-OREL-20261114/);
 await page.goto(route);
 await expect(page.locator('.intro')).toBeHidden();
 await page.goto('/druzina/start/?lang=cs&src=START');
 await page.clock.setFixedTime(new Date('2026-11-14T14:30:00+01:00'));
 await page.reload();
 await expect(page.locator('.intro')).toBeHidden();
});
