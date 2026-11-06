const {test,expect}=require('@playwright/test');

for(const [lang,heading,shield] of [
  ['cs','Hvězdná mapa družiny','Meč a štít'],
  ['en','The Fellowship Star Map','Sword and shield'],
  ['ru','Звёздная карта Дружины','Меч и щит'],
  ['uk','Зоряна мапа Дружини','Меч і щит']
]){
 test('Druzina constellation has working '+lang+' language, selection and branch filter',async({page})=>{
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto('/druzina/cesty/hvezdna-mapa/');
  await page.locator('[data-lang="'+lang+'"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('#heading')).toHaveText(heading);
  await expect(page.locator('[data-node]')).toHaveCount(10);
  await page.locator('[data-node="shield"]').click();
  await expect(page.locator('#detailsTitle')).toHaveText(shield);
  await expect(page.locator('[data-node="shield"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-filter="craft"]').click();
  await expect(page.locator('[data-node="shield"]')).toBeHidden();
  await expect(page.locator('[data-node="craft"]')).toBeVisible();
  await expect(page.locator('[data-node="archery"]')).toBeVisible();
  await expect(page.locator('[data-filter="craft"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#detailsNote')).not.toBeEmpty();
  await expect(page.locator('a[href="../../join/"]')).not.toHaveCount(0);
  expect(pageErrors).toEqual([]);
 });
}
test('Druzina constellation has no document-wide phone overflow and respects reduced motion',async({page})=>{
 await page.setViewportSize({width:360,height:760});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/druzina/cesty/hvezdna-mapa/');
 const layout=await page.evaluate(()=>({
  documentOverflow:document.documentElement.scrollWidth-window.innerWidth,
  horizontalMap:document.querySelector('.map-shell').scrollWidth>document.querySelector('.map-shell').clientWidth,
  reducedAnimation:getComputedStyle(document.querySelector('.point:not([aria-pressed=true]) .glyph')).animationName,
  brandStyle:!!document.querySelector('link[href*="brand-theme.css"]'),
  siteStyle:!!document.querySelector('link[href*="site-design.css"]')
 }));
 expect(layout.documentOverflow).toBeLessThanOrEqual(1);
 expect(layout.horizontalMap).toBe(true);
 expect(layout.reducedAnimation).toBe('none');
 expect(layout.brandStyle).toBe(true);
 expect(layout.siteStyle).toBe(true);
});