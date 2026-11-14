const {test,expect}=require('@playwright/test');
for(const lang of ['cs','en'])for(const width of [360,768,1440]){
 test('Brno Finds discovery pilot '+lang+' at '+width, async({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.setViewportSize({width,height:900});
  await page.goto('/market/?lang='+lang);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('.tile:visible')).toHaveCount(4);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex,nofollow');
  await expect(page.locator('form')).toHaveCount(0);
  await expect(page.locator('[data-inquire]')).toHaveCount(3);
  expect(await page.locator('[data-inquire]').first().getAttribute('href')).toMatch(/^mailto:chereshnev\.biochem@gmail\.com\?subject=/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.locator('[data-filter="leather"]').click();
  await expect(page.locator('.tile:visible')).toHaveCount(1);
  await expect(page.locator('.tile:visible')).toHaveAttribute('data-category','leather');
  await page.locator('[data-filter="all"]').click();
  await expect(page.locator('.tile:visible')).toHaveCount(4);
  expect(errors).toEqual([]);
 });
}
test('switching language updates legal seller, action and preserves browsing',async({page})=>{
 await page.goto('/market/?lang=cs');
 await page.locator('[data-lang="en"]').click();
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.locator('h1')).toContainText('Unusual finds');
 await expect(page.locator('#vendor-contact')).toHaveAttribute('href',/^mailto:/);
 await expect(page).toHaveURL(/lang=en/);
 await expect(page.locator('.tile:visible')).toHaveCount(4);
 await expect(page.locator('body')).toContainText('IČO 23041625');
});
test('pilot does not implement booking, card details or seller impersonation',async({page})=>{
 await page.goto('/market/');
 await expect(page.locator('form')).toHaveCount(0);
 await expect(page.locator('input')).toHaveCount(0);
 await expect(page.locator('a[href*="checkout"]')).toHaveCount(0);
 await expect(page.locator('a[href^="https://"]').not('a[href^="https://aliaksei-chareshneu.github.io"]')).toHaveCount(0);
 await expect(page.locator('.tile .seller')).toHaveCount(4);
});