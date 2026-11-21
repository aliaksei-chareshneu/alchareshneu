'use strict';
const {test,expect}=require('@playwright/test');
const API='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
async function offlineCatalog(page){
  await page.route(API,r=>r.fulfill({status:200,contentType:'application/json',
    headers:{'Access-Control-Allow-Origin':'*'},body:'{"events":[]}'}));
}
for(const lang of ['cs','en','ru','uk']){
 test('site triage: exactly three visible directions, no lost secondary routes '+lang,async({page})=>{
  await offlineCatalog(page);
  await page.goto('/?lang='+lang);
  await expect(page.locator('#fdVisualGrid > a.fd-visual-tile')).toHaveCount(3);
  await expect(page.locator('#fdNav > a')).toHaveCount(3);
  await expect(page.locator('#fdNav .fd-more')).toBeVisible();
  await expect(page.locator('#fdNav .fd-more')).not.toHaveAttribute('open','');
  for(const dest of ['academy','druzina','walkers']){
    const link=page.locator('#fdVisualGrid > a[href^="'+dest+'/"]');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href',dest+'/?lang='+lang);
  }
  await page.locator('#fdNav .fd-more > summary').click();
  await expect(page.locator('#fdNavAbout')).toBeVisible();
  await expect(page.locator('#fdNavEvents')).toBeVisible();
  await expect(page.locator('#fdNavCorporate')).toBeVisible();
  await expect(page.locator('#fdNavCorporate')).toHaveAttribute('href','corporate/?lang='+lang);
  // Four-language links keep the user's choice.
  await expect(page.locator('#fdNavAbout')).toHaveAttribute('href','about/?lang='+lang);
 });
 test('club: three choices, written confirmation, discoverable rules '+lang,async({page})=>{
  await offlineCatalog(page);
  await page.goto('/druzina/?lang='+lang);
  const hub=page.locator('#dm-visitor-hub [data-hub-lang="'+lang+'"]');
  await expect(hub).toBeVisible();
  await expect(hub.locator('.dm-hub-grid > article.dm-hub-card')).toHaveCount(3);
  await expect(hub.locator('.dm-hub-grid > article.dm-hub-card').first().locator('a')).toHaveAttribute('href','../register/?lang='+lang);
  await expect(hub.locator('.dm-hub-grid > article.dm-hub-card').nth(1).locator('a')).toHaveAttribute('href','cesty/?lang='+lang);
  await expect(hub.locator('.dm-hub-grid > article.dm-hub-card').nth(2).locator('a')).toHaveAttribute('href','permanentky/?lang='+lang);
  await expect(hub.locator('.imp-hub-safety-more')).not.toHaveAttribute('open','');
  await hub.locator('.imp-hub-safety-more > summary').click();
  await expect(hub.locator('.imp-hub-safety-more a[href="rules/?lang='+lang+'"]')).toBeVisible();
  await expect(page.locator('#imp-club-essentials .imp-first-visit')).not.toHaveAttribute('open','');
  await expect(page.locator('#imp-club-next .imp-quick-links a')).toHaveCount(2);
 });
 test('walkers: proposals are optional, not an invented booking '+lang,async({page})=>{
  await offlineCatalog(page);
  await page.goto('/walkers/?lang='+lang);
  await expect(page.locator('#imp-walkers-next')).toBeVisible();
  const proposal=page.locator('#bw-december-proposals');
  await expect(proposal).toHaveJSProperty('open',false);
  await expect(proposal.locator('summary')).toBeVisible();
  await expect(proposal).toContainText('NOT confirmed bookings');
  await proposal.locator('summary').click();
  await expect(proposal.locator('section')).toBeVisible();
  await expect(page.locator('#bw-mysteries-20261129')).toBeVisible();
 });
}
for(const width of [320,390,768]){
 test('three-way navigation remains reachable on narrow screens '+width,async({page})=>{
   await offlineCatalog(page);
   await page.setViewportSize({width,height:900});
   await page.goto('/?lang=ru');
   await expect(page.locator('#fdVisualGrid > a:visible')).toHaveCount(3);
   await page.locator('#fdNav .fd-more > summary').click();
   await expect(page.locator('#fdNavCorporate')).toBeVisible();
   const bounds=await page.locator('#fdNavCorporate').evaluate(el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right}});
   expect(bounds.left).toBeGreaterThanOrEqual(-1);
   expect(bounds.right).toBeLessThanOrEqual(width+1);
 });
}
