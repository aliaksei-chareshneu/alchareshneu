const {test,expect}=require('@playwright/test');
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
 await page.locator('#langSwitch [data-lang="en"]').click();
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await page.goto('/academy/');
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await page.goto('/druzina/?lang=cs');
 await expect(page.locator('html')).toHaveAttribute('lang','cs');
});
