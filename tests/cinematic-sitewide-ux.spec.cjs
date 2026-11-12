'use strict';
const {test,expect}=require('@playwright/test');

const API='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
async function keepReadOnly(page) {
  let mutations=0;
  await page.route(API, route => {
    if(route.request().method()!=='GET'){mutations++;return route.fulfill({status:405,body:'{}'});}
    return route.fulfill({status:200,contentType:'application/json',
      headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({events:[
        {event_id:'PUB-HEMA-20261116',category:'HEMA Training',community:'Družina Moravy',
        title:'Historický šerm',begins_at:'2026-11-16T17:00:00Z',venue:'Brno',
        price_czk:240,price_verified:true,end_time_verified:true,source_active:true,
        is_open:true,registration_mode:'FORM',data_controller:'Družina Moravy, z. s.'}
      ]})});
  });
  await page.route('https://script.google.com/**',route=>route.fulfill({status:200,contentType:'text/javascript',body:'/* read only */'}));
  return ()=>mutations;
}
for(const width of [390,768,1440]){
 test('homepage CTA is readable and the event popup fits '+width+' px',async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.clock.install({time:new Date('2026-11-12T17:50:00+01:00')});
  const mutations=await keepReadOnly(page);
  await page.goto('/?lang=cs');
  const button=page.locator('#fdHeroCta'),heading=button.locator('strong');
  await expect(button).toBeVisible();
  await expect(heading).toHaveCSS('color','rgb(21, 32, 30)');
  await expect(button).toHaveCSS('color','rgb(21, 32, 30)');
  await expect(page.locator('#fdDays button[aria-label^="2026-11-16"]')).toBeVisible();
  await page.locator('#fdDays button[aria-label^="2026-11-16"]').click();
  const dialog=page.locator('#fdDetails');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal','true');
  await expect(page.locator('#fdFacts')).toContainText('240 Kč');
  const r=await dialog.boundingBox();
  expect(r).not.toBeNull();
  expect(r.width).toBeLessThanOrEqual(width+1);
  expect(r.x).toBeGreaterThanOrEqual(-1);
  expect(r.x+r.width).toBeLessThanOrEqual(width+1);
  expect(r.y+r.height).toBeLessThanOrEqual(901);
  if(width===1440){
    expect(r.width).toBeGreaterThanOrEqual(840);
    expect(Math.abs(r.x-(width-r.width)/2)).toBeLessThanOrEqual(2);
    const layout=await dialog.evaluate(x=>getComputedStyle(x).gridTemplateColumns.split(' ').filter(Boolean).length);
    expect(layout).toBe(2);
    await expect(page.locator('#fdPhoto')).toBeVisible();
  }else if(width===390){
    expect(r.width).toBeGreaterThanOrEqual(388);
    expect(Math.abs(r.y+r.height-900)).toBeLessThanOrEqual(3);
  }else{
    expect(r.width).toBeGreaterThanOrEqual(680);
  }
  await expect(page.locator('#fdPaymentTerms')).toBeVisible();
  await expect(page.locator('#fdPaymentTerms')).not.toHaveAttribute('open','');
  await page.locator('#fdPaymentSummary').click();
  await expect(page.locator('#fdPaymentCancellation')).toContainText('48 hodin');
  await dialog.screenshot({path:'test-results/cinematic-dialog-'+width+'.png'});
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(mutations()).toBe(0);
 });
}
const cases=[
 ['/academy/','academy'],
 ['/academy/courses/','academy-course'],
 ['/academy/programmes/','academy-course'],
 ['/academy/a2/','academy-a2'],
 ['/druzina/','druzina'],
 ['/druzina/start/','druzina-start'],
 ['/druzina/join/','druzina-join'],
 ['/druzina/rules/','druzina-rules'],
 ['/druzina/safety/','druzina-safety'],
 ['/druzina/teambuilding/','druzina-teambuilding'],
 ['/druzina/permanentky/','druzina-pricing'],
 ['/druzina/cesty/','druzina'],
 ['/druzina/ranks.html','druzina-ranks'],
 ['/walkers/','walkers'],
 ['/walkers/walktalk-november-2026.html','walkers-event'],
 ['/calendar/','calendar'],
 ['/register/','register'],
 ['/register/en/','register'],
 ['/register/ru/','register'],
 ['/register/uk/','register'],
 ['/events/november-2026.html','events'],
 ['/start/','hub'],
 ['/praha-hema/','praha-hema'],
 ['/corporate/','corporate'],
 ['/corporate/leadership/','corporate-sub'],
 ['/corporate/technical-answers/','corporate-sub'],
 ['/corporate/diagnostic/','corporate-sub'],
 ['/brno-stories/','stories'],
 ['/druzina/share/','druzina'],
 ['/druzina/arsenal/','druzina'],
 ['/druzina/novinky/','druzina'],
 ['/corporate/request/','corporate-sub'],
 ['/corporate/travel-audit/','corporate-sub'],
 ['/brno-stories/tanec-draku-2026/','stories'],
 ['/brno-stories/weekly/','stories'],
 ['/ideas/','hub'],
 ['/dame-na-vas-2755/','druzina'],
 ['/platform-evidence/','corporate-sub'],
 ['/autopilot/','walkers-event'],
 ['/shop/','hub'],
];
test('the 40 public pages load their themed styles without redirecting or editing registration data',async({page})=>{
 test.setTimeout(180000);
 await page.setViewportSize({width:1280,height:850});
 const mut=await keepReadOnly(page);
 const style=await page.request.get('/imperion-cinematic-site.css?v=20261112-ux1');
 expect(style.ok()).toBeTruthy();
 for(const [route,theme] of cases){
  const response=await page.goto(route,{waitUntil:'domcontentloaded',timeout:25000});
  expect(response?.status(),route).toBe(200);
  await expect(page.locator('body'),route).toHaveAttribute('data-imperion-design',theme);
  const link=page.locator('link[href*="imperion-cinematic-site.css"]');
  await expect(link,route).toHaveCount(1);
  const load=await page.evaluate(()=>{
    const body=document.body;
    return {
      font:getComputedStyle(body).fontFamily,
      theme:getComputedStyle(body).getPropertyValue('--imp-gold').trim(),
      href:document.querySelector('link[href*="imperion-cinematic-site.css"]')?.href,
    };
  });
  expect(load.theme,route).toBe('#f2cb7f');
  expect(load.font,route).toContain('Source Sans 3');
  expect(new URL(load.href).pathname,route).toMatch(/\/imperion-cinematic-site\.css$/);
 }
 expect(mut()).toBe(0);
});
test('booking form remains a real form after restyling and no unintended mutation occurs',async({page})=>{
 const mut=await keepReadOnly(page);
 await page.goto('/register/?lang=cs',{waitUntil:'domcontentloaded'});
 await expect(page.locator('body')).toHaveAttribute('data-imperion-design','register');
 await expect(page.locator('form#rsvpForm')).toHaveCount(1);
 await expect(page.locator('#eventCalendarHeading')).toBeVisible();
 await expect(page.locator('.panel#form')).toHaveCSS('background-color','rgb(16, 45, 52)');
 expect(mut()).toBe(0);
});
for(const [route,style] of [['/academy/','academy'],['/druzina/','druzina'],['/walkers/','walkers'],['/calendar/','calendar'],['/register/','register']]){
 test('mobile theme is loaded without hiding primary heading '+route,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await keepReadOnly(page);
  await page.goto(route,{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveAttribute('data-imperion-design',style);
  const first=page.locator('h1').first();
  await expect(first).toBeVisible();
  const color=await page.locator('body').evaluate(e=>getComputedStyle(e).getPropertyValue('--imp-gold').trim());
  expect(color).toBe('#f2cb7f');
  await page.screenshot({path:'test-results/cinematic-'+style+'-390.png',fullPage:false});
 });
}
