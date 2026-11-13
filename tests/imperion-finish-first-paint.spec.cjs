'use strict';
const {test,expect}=require('@playwright/test');
const API='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
async function events(page){
 await page.route(API,route=>route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'{"events":[]}'}));
}
async function snap(page,selector){
 return page.locator(selector).evaluate(el=>{
  const head=el.getBoundingClientRect();
  const n=el.querySelector('nav'),logo=el.querySelector('a');
  const nav=n&&n.getBoundingClientRect(),brand=logo&&logo.getBoundingClientRect();
  return {
   top:head.top,height:head.height,position:getComputedStyle(el).position,
   navY:nav&&nav.y-head.y,brandY:brand&&brand.y-head.y,
   overflow:document.documentElement.scrollWidth-innerWidth,
   pending:document.documentElement.getAttribute('data-imp-boot')
  };
 });
}
for(const width of [390,1440]){
 test('exactly one static header, same position on home and Academy '+width,async({page})=>{
  await events(page);
  await page.setViewportSize({width,height:900});
  await page.goto('/?lang=cs');
  const home=await snap(page,'#imperion-frontdoor .fd-header');
  await expect(page.locator('#imperion-frontdoor .fd-header')).toBeVisible();
  expect(home.position).toBe('relative');
  expect(home.top).toBeGreaterThanOrEqual(-1);
  expect(home.top).toBeLessThanOrEqual(1);
  expect(home.pending).toBe(null);
  expect(home.overflow).toBeLessThanOrEqual(1);
  await page.goto('/academy/?lang=cs');
  const academy=await snap(page,'#imp-shell-top');
  expect(academy.position).toBe('relative');
  expect(academy.top).toBeGreaterThanOrEqual(-1);
  expect(academy.top).toBeLessThanOrEqual(1);
  expect(Math.abs(academy.height-home.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(academy.navY-home.navY)).toBeLessThanOrEqual(3);
  expect(Math.abs(academy.brandY-home.brandY)).toBeLessThanOrEqual(3);
  expect(academy.pending).toBe(null);
  expect(academy.overflow).toBeLessThanOrEqual(1);
  await expect(page.locator('nav.nav:visible, .tabs-bar:visible')).toHaveCount(0);
  await page.evaluate(()=>window.scrollTo({top:500,behavior:'instant'}));
  await expect.poll(()=>page.locator('#imp-shell-top').evaluate(el=>el.getBoundingClientRect().bottom)).toBeLessThan(0);
 });
}
for(const route of ['/academy/a2/?lang=uk','/academy/courses/?lang=ru']){
 test('boot guard blocks old colors before shared shell is ready '+route,async({page})=>{
  await page.route('**/unified-shell.js?v=*',async route=>{
   await new Promise(resolve=>setTimeout(resolve,750));
   await route.continue();
  });
  await page.goto(route,{waitUntil:'commit'});
  await page.waitForFunction(()=>document.body&&document.documentElement.getAttribute('data-imp-boot')==='pending');
  const during=await page.evaluate(()=>({
    boot:document.documentElement.getAttribute('data-imp-boot'),
    visibility:getComputedStyle(document.body).visibility,
    fallback:document.documentElement.getAttribute('data-imp-fallback')
  }));
  expect(during.boot).toBe('pending');
  expect(during.visibility).toBe('hidden');
  expect(during.fallback).toBe(null);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-imp-boot','pending');
  await expect(page.locator('#imp-shell-top')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-imp-shell-complete','yes');
 });
}
test('home first-paint guard suppresses legacy page until calendar renders',async({page})=>{
 await events(page);
 await page.route('**/conversion-frontdoor.js?v=*',async route=>{
  await new Promise(resolve=>setTimeout(resolve,750));await route.continue();
 });
 await page.goto('/?lang=ru',{waitUntil:'commit'});
 await page.waitForFunction(()=>document.body&&document.documentElement.getAttribute('data-imp-boot')==='pending');
 expect(await page.locator('body').evaluate(el=>getComputedStyle(el).visibility)).toBe('hidden');
 await page.waitForLoadState('domcontentloaded');
 await expect(page.locator('html')).toHaveAttribute('data-imperion-frontdoor','ready');
 await expect(page.locator('body')).toBeVisible();
 await expect(page.locator('html')).not.toHaveAttribute('data-imp-boot','pending');
 await expect(page.locator('#imperion-frontdoor .fd-header')).toBeVisible();
});
test('A2 quiz and answer states use cinematic theme with four languages',async({page})=>{
 const errs=[];page.on('pageerror',e=>errs.push(e.message));
 await page.goto('/academy/a2/?lang=uk');
 await expect(page.locator('html')).toHaveAttribute('lang','uk');
 await expect(page.locator('#imp-shell-top [data-imp-lang="uk"]')).toHaveCount(1);
 const card=page.locator('.surface#intro');
 await expect(card).toBeVisible();
 const skin=await card.evaluate(el=>({
  background:getComputedStyle(el).backgroundImage,
  backdrop:getComputedStyle(el).backgroundColor,
  body:getComputedStyle(document.body).backgroundImage,
  nav:getComputedStyle(document.querySelector('#imp-shell-top')).position
 }));
 expect(skin.background).toMatch(/linear-gradient/);
 expect(skin.background).not.toMatch(/rgb\(255,\s*255,\s*255\)/);
 expect(skin.nav).toBe('relative');
 await page.locator('#start').click();
 await expect(page.locator('#quiz')).toBeVisible();
 await page.locator('#choices .choice').first().click();
 await expect(page.locator('#feedback')).toBeVisible();
 await expect(page.locator('#choices .choice.correct')).toHaveCount(1);
 const choiceStyle=await page.locator('#choices .choice.correct').evaluate(el=>getComputedStyle(el).backgroundColor);
 expect(choiceStyle).not.toBe('rgb(255, 255, 255)');
 await expect(page.locator('#next')).toBeEnabled();
 expect(errs).toEqual([]);
});
test('Academy catalogue and programmes retain prices but no old blue panels',async({page})=>{
 for(const route of ['/academy/courses/?lang=uk','/academy/programmes/?lang=uk']){
  await page.goto(route);
  await expect(page.locator('#imp-shell-top')).toBeVisible();
  const css=await page.evaluate(()=>({
   body:getComputedStyle(document.body).backgroundColor,
   panel:getComputedStyle(document.querySelector('main .course,main .offer')).backgroundImage,
   background:getComputedStyle(document.querySelector('main .course,main .offer')).backgroundColor
  }));
  expect(css.body).not.toBe('rgb(11, 23, 41)');
  expect(css.panel).toMatch(/linear-gradient/);
  expect(css.panel).not.toMatch(/rgb\(24,\s*43,\s*68\)/);
 }
 await page.goto('/academy/courses/?lang=uk');
 await expect(page.locator('article.course')).toHaveCount(31);
 await expect(page.locator('article.course#CZ01 h3 [data-locale="uk"]')).toContainText('Чеська');
});
