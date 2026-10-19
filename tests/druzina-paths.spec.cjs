const {test,expect}=require('@playwright/test');

const languages=['cs','en','ru','uk'];
for(const lang of languages){
 test('skill tree: '+lang+' shows three tiers and switches five infantry specialisations',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:390,height:850});
  await page.goto('/druzina/cesty/?lang='+lang);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('button[data-track="line"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#tierOneName')).not.toBeEmpty();
  await expect(page.locator('#tierChoice')).toBeVisible();
  await expect(page.locator('button[data-spec]')).toHaveCount(5);
  for(const spec of ['shield','spear','twohand','dual','skirmish']){
   const btn=page.locator('button[data-spec="'+spec+'"]');
   await btn.click();
   await expect(btn).toHaveAttribute('aria-pressed','true');
   await expect(page.locator('#tierTwoName')).toHaveText(await btn.textContent());
   await expect(page.locator('#tierThreeName')).not.toBeEmpty();
   await expect(page.locator('#tierThreeDescription')).not.toBeEmpty();
  }
  await page.locator('button[data-track="archer"]').click();
  await expect(page.locator('#tierChoice')).toBeHidden();
  await expect(page.locator('#tierOneName')).not.toBeEmpty();
  await expect(page.locator('#tierTwoName')).not.toBeEmpty();
  await expect(page.locator('#tierThreeName')).not.toBeEmpty();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
 });
 test('public board: '+lang+' month/all-time counts stay empty without verified consent',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:390,height:850});
  await page.goto('/druzina/leaderboard/?lang='+lang);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('#syncStatus')).toContainText('2026-10-19');
  await expect(page.locator('article[data-category]')).toHaveCount(7);
  await expect(page.locator('.category .list li.wait')).toHaveCount(7);
  const toggle=page.locator('button[data-period="all"]');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.category .list li.wait')).toHaveCount(7);
  await expect(page.locator('button[data-period="month"]')).toHaveAttribute('aria-pressed','false');
  await page.locator('button[data-period="month"]').click();
  await expect(page.locator('#syncStatus')).toContainText('2026-10');
  expect(errors).toEqual([]);
 });
}
