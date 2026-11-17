'use strict';
/* Project 80: offline Playwright smoke audit across every repository HTML route.
   The assertion is that the document language matches the actual available content.
   Native single-language routes are explicit fallbacks, not falsely advertised as translated.
   Legal/safety sections are tested for visible language isolation. */
const fs=require('node:fs');
const path=require('node:path');
const {test,expect}=require('@playwright/test');

const root=path.resolve(__dirname,'..');
const ignoredFolders=new Set(['.git','node_modules','_pages','playwright-report','test-results']);
function scan(directory,relative=''){
 const found=[];
 for(const d of fs.readdirSync(directory,{withFileTypes:true})){
  if(d.isDirectory()&&!ignoredFolders.has(d.name))found.push(...scan(path.join(directory,d.name),relative+d.name+'/'));
  else if(d.isFile()&&d.name.endsWith('.html'))found.push(relative+d.name);
 }
 return found;
}
const allFiles=scan(root).sort();
const excluded=new Set(['404.html','RegistrationPortal.html','druzina/prihlaska/index.html']);
const fixedLang={
 'brno-stories/weekly/index.html':'en',
 'brno-stories/tanec-draku-2026/index.html':'cs',
 'shop/ai-workflow-roi/index.html':'en',
 'shop/csv-rescue/index.html':'en',
 'shop/guides/automation-payback/index.html':'en',
 'shop/guides/csv-data-quality/index.html':'en',
 'shop/legal/index.html':'en',
 'shop/thanks/index.html':'en',
 'platform-evidence/index.html':'cs',
 'platform-evidence/sample/index.html':'cs',
 'autopilot/index.html':'cs',
 'corporate/travel-audit/index.html':'cs',
 'register/en/index.html':'en',
 'register/ru/index.html':'ru',
 'register/uk/index.html':'uk'
};
const languages=['cs','en','ru','uk'];
test('sitewide inventory includes all current HTML sources and has no unclassified exclusions',async()=>{
 expect(allFiles.length).toBeGreaterThanOrEqual(60);
 expect(allFiles.filter(x=>excluded.has(x))).toEqual(['404.html','RegistrationPortal.html','druzina/prihlaska/index.html']);
 expect(allFiles.filter(x=>x.includes('_pages/'))).toEqual([]);
 const html404=fs.readFileSync(path.join(root,'404.html'),'utf8');
 expect(html404).toContain('<html lang="cs">');
 expect(html404).toMatch(/target \+ '\?lang=' \+ encodeURIComponent\(language\)/);
 const redirect=fs.readFileSync(path.join(root,'druzina/prihlaska/index.html'),'utf8');
 expect(redirect).toContain('main p[lang]{display:none}');
 expect(redirect).toContain('target.searchParams.set(\'lang\',lang)');
});
const langSensitivePanels=new Map([
 ['druzina/rules/index.html','main > section[lang]'],
 ['druzina/arsenal/index.html','main > section[lang]'],
 ['register/privacy/index.html','main > section[lang]'],
 ['register/safety/index.html','main > section[lang]'],
 ['druzina/safety/index.html','main > section[lang]'],
 ['academy/order/privacy.html','.ao-privacy-locale']
]);
for(const file of allFiles.filter(x=>!excluded.has(x))){
 test('all four language requests: '+file,async({page})=>{
  await page.route('**/functions/v1/**',route=>route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'{"events":[],"bookingConfirmed":false}'}));
  for(const requested of languages){
   await page.goto('/'+file+'?lang='+requested,{waitUntil:'domcontentloaded',timeout:25000});
   const expected=fixedLang[file]||requested;
   await expect(page.locator('html')).toHaveAttribute('lang',expected,{timeout:7000});
   if(langSensitivePanels.has(file)){
    const selector=langSensitivePanels.get(file);
    await expect(page.locator(selector+':visible')).toHaveCount(1);
    await expect(page.locator(selector+'[lang="'+expected+'"]')).toBeVisible();
    if(file.startsWith('druzina/')&&['cs','en'].includes(expected)){
     const txt=await page.locator('main').innerText();
     expect(txt).not.toMatch(/[А-Яа-яЁёІіЇїЄєЎўҐґ]/);
    }
   }
   if(file==='shop/index.html'){
    const t={cs:'Obchod',en:'Store',ru:'Магазин',uk:'Магазин'}[requested];
    await expect(page.locator('header.nav .nav-links a').first()).toHaveText(t);
    await expect(page.locator('main')).toHaveAttribute('data-locale',requested);
   }
   if(file==='druzina/rules/index.html'||file==='druzina/arsenal/index.html'){
    const other=requested==='cs'?'ru':'cs';
    await expect(page.locator('body>header nav a[lang="'+requested+'"]')).toHaveAttribute('aria-current','page');
    await page.locator('body>header nav a[lang="'+other+'"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang',other);
    await expect(page.locator('main > section[lang="'+other+'"]')).toBeVisible();
   }
  }
 });
}
test('Academy course language switch persists in URL and survives reload',async({page})=>{
 await page.goto('/academy/courses/?lang=cs');
 await page.locator('nav.lang button[data-lang="ru"]').click();
 await expect(page).toHaveURL(/[?&]lang=ru/);
 await expect(page.locator('html')).toHaveAttribute('lang','ru');
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('lang','ru');
 await expect(page.locator('a.back')).toHaveAttribute('href','../?lang=ru');
});
test('Ranks additionally support Belarusian and Slovak without exporting them sitewide',async({page})=>{
 for(const code of ['be','sk']){
  await page.goto('/druzina/ranks.html?lang='+code);
  await expect(page.locator('html')).toHaveAttribute('lang',code);
  await expect(page.locator('.panel[data-locale="'+code+'"]')).toBeVisible();
 }
});
