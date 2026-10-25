const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const raw=fs.readFileSync(path.join(__dirname,'..','RegistrationPortal.html'),'utf8')
 .replace('<?!= JSON.stringify(initialEventId) ?>','"TEST-HIKE-20991101"')
 .replace('<?!= JSON.stringify(initialLanguage) ?>','"en"');
const fixture={id:'TEST-HIKE-20991101',title:'Synthetic hike (TEST)',date:'Sun 1 Nov 2099 · 12:45',
 location:'Synthetic meeting point',price:'Free',dataController:'Test community organizer',
 rulesUrl:'https://aliaksei-chareshneu.github.io/alchareshneu/register/safety/',additionalSafety:false};
async function mount(page){
 await page.goto('/');
 await page.evaluate(event=>{
  window.google={script:{run:{
   withSuccessHandler(callback){this.ok=callback;return this;},
   withFailureHandler(callback){this.fail=callback;return this;},
   regpGetEvents(){this.ok({events:[event],version:'synthetic'});},
   regpSubmit(payload){window.__lastSyntheticSubmission=payload;
     this.ok({ok:true,recorded:true,reference:'TEST-ONLY-0001',status:'REGISTERED',needsGuardian:false});}
  }}};
 },fixture);
 await page.setContent(raw);
}
test('mobile registration is readable in EN/CZ/RU/UA without horizontal overflow',async({page})=>{
 for(const width of [360,390,428,768]){
  await page.setViewportSize({width,height:820});
  await mount(page);
  await expect(page.locator('#event')).toHaveValue('TEST-HIKE-20991101');
  await expect(page.locator('#submit')).toBeEnabled();
  for(const lang of ['en','cs','ru','uk']){
   await page.locator('[data-lang="'+lang+'"]').click();
   await expect(page.locator('html')).toHaveAttribute('lang',lang);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
 }
});
test('RSVP requires contact and safety while photo permission stays optional',async({page})=>{
 await mount(page);
 await page.locator('#first').fill('Ada');
 await page.locator('#last').fill('Example');
 await page.locator('#email').fill('ada@example.test');
 await page.locator('#phone').fill('+420 777 123 456');
 await page.locator('#age').selectOption('adult');
 await page.locator('#safety').check();
 await page.locator('input[name="rsvp"][value="YES"]').check();
 await page.locator('#future').uncheck();
 await page.locator('#submit').click();
 await expect(page.locator('#thanks')).toBeVisible();
 const payload=await page.evaluate(()=>window.__lastSyntheticSubmission);
 expect(payload.email).toBe('ada@example.test');
 expect(payload.photo).toBe('NO');
 expect(payload.futureUpdates).toBe(false);
 expect(payload.safety).toBe(true);
 expect(page.url()).not.toContain('ada@example.test');
});
test('minors require guardian details and cannot self-grant photo publicity',async({page})=>{
 await mount(page);
 await page.locator('#age').selectOption('under18');
 await expect(page.locator('#guardian')).toBeVisible();
 await expect(page.locator('#guardianName')).toHaveAttribute('required','');
 await expect(page.locator('#photoConsent')).toBeDisabled();
 await expect(page.locator('#future')).toBeDisabled();
});
test('unactivated gateway keeps customers on site and points to current events',async({page})=>{
 await page.goto('/register/?lang=cs');
 await expect(page.locator('#open')).toHaveAttribute('href',/\/calendar\/\?lang=cs$/);
 await expect(page.locator('#message')).toContainText('není aktivní');
 expect(page.url()).toContain('/register/');
});
test('privacy and safety information are reachable and a hosted Apps Script URL is explicit',async({page})=>{
 await page.goto('/register/?preview=1&event=TEST-HIKE-20991101');
 await expect(page.locator('#open')).toHaveAttribute('href',/script\.google\.com.*view=register.*event=TEST-HIKE-20991101/);
 await page.goto('/register/privacy/');
 await expect(page.locator('h1')).toContainText('Privacy');
 await page.goto('/register/safety/');
 await expect(page.locator('h1')).toContainText('Safety');
});
