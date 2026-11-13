const {test,expect}=require('@playwright/test');
test.use({locale:'en-US'});
const pages=['','druzina/','academy/','walkers/','calendar/','corporate/','druzina/ranks.html','academy/programmes/','events/november-2026.html'];
for(const path of pages){
 test('Czech default on fresh visit: '+(path||'home'),async({page})=>{
  await page.goto('/'+path);
  await expect(page.locator('html')).toHaveAttribute('lang','cs');
 });
 test('explicit EN parameter still works: '+(path||'home'),async({page})=>{
  await page.goto('/'+path+'?lang=en');
  await expect(page.locator('html')).toHaveAttribute('lang','en');
 });
}
test('manual EN preference persists across primary pages',async({page})=>{
 await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('lang','cs');
 await page.locator('#imperion-frontdoor [data-fd-language="en"]').click();
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await page.goto('/academy/');
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await page.goto('/druzina/?lang=cs');
 await expect(page.locator('html')).toHaveAttribute('lang','cs');
});

for(const path of ['','druzina/','academy/','walkers/','calendar/']){
 test('CZ is the first visible language choice: '+(path||'home'),async({page})=>{
  await page.goto('/'+path);
  await expect(page.locator('#langSwitch button[data-lang]').first()).toHaveAttribute('data-lang','cs');
 });
}
