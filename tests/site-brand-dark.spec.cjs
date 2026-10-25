const {test,expect}=require('@playwright/test');

const pages=[
 ['/','shared'],['/academy/','shared'],['/walkers/','shared'],
 ['/calendar/','shared'],['/druzina/','shared'],['/druzina/novinky/','novinky'],
 ['/druzina/join/','join'],['/druzina/ranks.html','ranks'],['/druzina/share/','share'],
 ['/druzina/cesty/','dark'],['/druzina/leaderboard/','dark'],
 ['/academy/a2/','a2'],['/corporate/technical-answers/','tech'],
 ['/corporate/travel-audit/','travel'],['/register/','register'],['/start/','hub']
];
for(const [path,scope] of pages){
 test('unified midnight-blue and gold theme: '+path,async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:390,height:844});
  await page.goto(path+'?lang=ru');
  await expect(page.locator('body')).toHaveAttribute('data-imperion-scope',scope);
  await expect(page.locator('link[href*="brand-theme.css"]')).toHaveCount(1);
  const info=await page.evaluate(()=>{
   const root=getComputedStyle(document.documentElement);
   const body=getComputedStyle(document.body);
   return {
    night:root.getPropertyValue('--brand-night').trim(),
    gold:root.getPropertyValue('--brand-gold').trim(),
    bodyColor:body.color,colorScheme:root.colorScheme
   };
  });
  expect(info.night).toBe('#0b1729');
  expect(info.gold).toBe('#e6bf80');
  expect(info.colorScheme).toBe('dark');
  expect(info.bodyColor).toBe('rgb(245, 247, 252)');
  expect(errors).toEqual([]);
 });
}

for(const [path,selector] of [
 ['/druzina/novinky/','.fact'],
 ['/druzina/ranks.html','.launch-notice'],
 ['/druzina/join/','.card'],
 ['/druzina/share/','.steps li'],
 ['/academy/a2/','.surface'],
 ['/corporate/technical-answers/','.tile'],
 ['/corporate/travel-audit/','.travel-card'],
 ['/start/','.card']
]){
 test('former light surface has dark blue background: '+path,async({page})=>{
  await page.goto(path+'?lang=ru');
  const element=page.locator(selector).first();
  await expect(element).toBeVisible();
  const bg=await element.evaluate(x=>getComputedStyle(x).backgroundColor);
  const rgb=bg.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  expect(rgb).not.toBeNull();
  expect(Math.max(Number(rgb[1]),Number(rgb[2]),Number(rgb[3]))).toBeLessThan(110);
 });
}
test('November dark dashboard has all tables and no mobile horizontal overflow',async({page})=>{
 for(const lang of ['cs','en','ru','uk']){
  await page.setViewportSize({width:360,height:780});
  await page.goto('/druzina/novinky/?lang='+lang);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('article.locale:visible .data-table')).toHaveCount(3);
  await expect(page.locator('article.locale:visible .fold')).toHaveCount(8);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
 }
});
test('four-language registration keeps required consent inputs and dark legible fields',async({page})=>{
 for(const lang of ['en','ru','uk','cs']){
  const path=lang==='cs'?'/register/':'/register/'+lang+'/';
  await page.goto(path);
  await expect(page.locator('form')).toHaveCount(1);
  await expect(page.locator('input[type="checkbox"]').first()).toBeVisible();
  await expect(page.locator('link[href*="brand-theme.css"]')).toHaveCount(1);
 }
});