const {test,expect}=require('@playwright/test');
const url='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
const example={event_id:'PUB-HIKE-20261101',title:'BrnoWalkers: Hády – Růženin lom – Obřany',community:'BrnoWalkers',category:'Hike',begins_at:'2026-11-01T11:45:00Z',ends_at:'2026-11-01T15:15:00Z',venue:'Velká Klajdovka, Brno',price_czk:0,data_controller:'Družina Moravy, z. s.',rules_url:'https://aliaksei-chareshneu.github.io/alchareshneu/register/safety/',contact_activity:false,is_open:true,registration_mode:'FORM',price_verified:true,end_time_verified:true};
function cors(){return {'access-control-allow-origin':'http://127.0.0.1:8000','access-control-allow-headers':'content-type','access-control-allow-methods':'GET, POST, OPTIONS'};}
test('public registration sends one private request with independent consents',async({page})=>{
  let submitted=null;
  await page.route(url,async route=>{
    const req=route.request();
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors()});
    if(req.method()==='GET')return route.fulfill({status:200,contentType:'application/json',headers:cors(),body:JSON.stringify({events:[example]})});
    submitted=JSON.parse(req.postData());return route.fulfill({status:200,contentType:'application/json',headers:cors(),body:JSON.stringify({ok:true,status:'RECEIVED',confirmed:false})});
  });
  await page.goto('/register/?lang=cs&event=PUB-HIKE-20261101');
  await expect(page.locator('#rsvpForm')).toBeVisible();
  await expect(page.locator('#eventId')).toHaveValue('PUB-HIKE-20261101');
  await expect(page.locator('#optionalConsents')).toBeVisible();
  await expect(page.locator('#optionalConsents')).toHaveJSProperty('tagName','FIELDSET');
  await expect(page.locator('#photo')).not.toBeChecked();
  await expect(page.locator('#future')).not.toBeChecked();
  await expect(page.locator('#safety')).not.toBeChecked();
  await page.locator('#firstName').fill('Test');
  await page.locator('#lastName').fill('Example');
  await page.locator('#email').fill('synthetic-rsvp@example.test');
  await page.locator('#phone').fill('+420 777 111 222');
  await page.locator('#safety').check();
  await page.locator('#submit').click();
  await expect(page.locator('#result')).toContainText('Přihláška byla přijata');
  await expect(page.locator('#result')).toContainText('Velká Klajdovka');
  await expect(page.locator('#result')).toContainText('synthetic-rsvp@example.test');
  await expect(page.locator('#result .receipt-actions button')).toHaveCount(2);
  await expect(page.locator('#rsvpForm')).toBeHidden();
  await expect(page.locator('#result')).toBeFocused();
  expect(submitted).toMatchObject({eventId:'PUB-HIKE-20261101',email:'synthetic-rsvp@example.test',safety:true,photo:'NO',futureUpdates:false,language:'cs'});
  expect(page.url()).not.toContain('synthetic-rsvp');
});
test('minors require guardian and cannot grant marketing/publicity permissions',async({page})=>{
 await page.route(url,route=>route.fulfill({status:200,contentType:'application/json',headers:cors(),body:JSON.stringify({events:[example]})}));
 await page.goto('/register/?lang=en');
 await expect(page.locator('#rsvpForm')).toBeVisible();
 await page.locator('input[name=age][value=under18]').check();
 await expect(page.locator('#guardian')).toBeVisible();
 await expect(page.locator('#guardianName')).toHaveAttribute('required','');
 await expect(page.locator('#photo')).toBeDisabled();
 await expect(page.locator('#future')).toBeDisabled();
});
test('registration backend outage gives direct organiser contact without collecting data',async({page})=>{
 await page.route(url,route=>route.fulfill({status:503,contentType:'application/json',headers:cors(),body:JSON.stringify({error:'down'})}));
 await page.goto('/register/?lang=ru');
 await expect(page.locator('#fallback')).toBeVisible();
 await expect(page.locator('#rsvpForm')).toBeHidden();
 await expect(page.locator('#contactLink')).toHaveAttribute('href',/^mailto:/);
 await expect(page.locator('#fallbackChannels a')).toHaveCount(3);
 await expect(page.locator('#fallbackChannels a').nth(0)).toHaveAttribute('href','https://t.me/Chareshneu');
 await expect(page.locator('#fallbackChannels a').nth(1)).toHaveAttribute('href',/^https:\/\/wa\.me\//);
 await expect(page.locator('#fallbackChannels a').nth(2)).toHaveAttribute('href',/^sms:/);
});


const variants=[
 {lang:'cs',path:'/register/',title:'Registrace na akce v Brně'},
 {lang:'en',path:'/register/en/',title:'Register for Brno hikes'},
 {lang:'ru',path:'/register/ru/',title:'Регистрация на походы'},
 {lang:'uk',path:'/register/uk/',title:'Реєстрація на походи'},
];
for(const v of variants){
 test('locale '+v.lang+' has crawlable title, canonical, same-page form and privacy link',async({page})=>{
  await page.route(url,route=>route.fulfill({status:200,contentType:'application/json',headers:cors(),body:JSON.stringify({events:[example]})}));
  await page.goto(v.path+'?event=PUB-HIKE-20261101');
  await expect(page).toHaveTitle(new RegExp(v.title));
  await expect(page.locator('html')).toHaveAttribute('lang',v.lang);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href',new RegExp('/register/'+(v.lang==='cs'?'':v.lang+'/')+'$'));
  await expect(page.locator('#rsvpForm')).toBeVisible();
  await expect(page.locator('#eventId')).toHaveValue('PUB-HIKE-20261101');
  await expect(page.locator('a[data-i18n=privacyLink]')).toHaveAttribute('href',v.lang==='cs'?'./privacy/':'../privacy/');
  await expect(page.locator('#rulesLink')).toHaveAttribute('href',new RegExp('/register/safety/$'));
 });
}
test('language switch keeps typed data and toggles legal descriptions',async({page})=>{
 await page.route(url,route=>route.fulfill({status:200,contentType:'application/json',headers:cors(),body:JSON.stringify({events:[example]})}));
 await page.goto('/register/en/');
 await expect(page.locator('#rsvpForm')).toBeVisible();
 await page.locator('#firstName').fill('Anna');
 await page.locator('#email').fill('anna@example.test');
 await page.locator('button[data-lang=ru]').click();
 await expect(page.locator('html')).toHaveAttribute('lang','ru');
 await expect(page.locator('#firstName')).toHaveValue('Anna');
 await expect(page.locator('#email')).toHaveValue('anna@example.test');
 await expect(page.locator('button[data-lang=ru]')).toHaveAttribute('aria-pressed','true');
});
test('mobile registration remains readable without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:375,height:667});
 await page.route(url,route=>route.fulfill({status:200,contentType:'application/json',headers:cors(),body:JSON.stringify({events:[example]})}));
 await page.goto('/register/ru/');
 await expect(page.locator('#rsvpForm')).toBeVisible();
 await expect(page.locator('.mobile-jump')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
 await page.locator('.mobile-jump').click();
 await expect.poll(()=>page.evaluate(()=>location.hash)).toBe('#form');
});
test('single open event is selected automatically without extra tap',async({page})=>{
 await page.route(url,route=>route.fulfill({status:200,contentType:'application/json',headers:cors(),body:JSON.stringify({events:[example]})}));
 await page.goto('/register/en/');
 await expect(page.locator('#rsvpForm')).toBeVisible();
 await expect(page.locator('#eventId')).toHaveValue('PUB-HIKE-20261101');
 await expect(page.locator('#eventInfo')).toContainText('Hády');
});
test('failed event fetch can be retried successfully',async({page})=>{
 let gets=0;
 await page.route(url,route=>{gets++;return route.fulfill({status:gets===1?503:200,contentType:'application/json',headers:cors(),body:gets===1?JSON.stringify({error:'down'}):JSON.stringify({events:[example]})});});
 await page.goto('/register/en/');
 await expect(page.locator('#fallback')).toBeVisible();
 await expect(page.locator('#retry')).toBeVisible();
 await page.locator('#retry').click();
 await expect(page.locator('#rsvpForm')).toBeVisible();
 await expect(page.locator('#fallback')).toBeHidden();
 expect(gets).toBe(2);
});


test('BrnoWalkers accurately labels free and paid trips and paused board games in four languages',async({page})=>{
  const variants=[
    {lang:'en',price:'Some events are free and others are paid'},
    {lang:'cs',price:'Pořádáme bezplatné i placené akce'},
    {lang:'ru',price:'Есть бесплатные и платные мероприятия'},
    {lang:'uk',price:'Є безкоштовні й платні заходи'},
  ];
  for(const {lang,price} of variants){
    await page.goto('/walkers/?lang='+lang);
    await expect(page.locator('#walkers-rules')).toContainText(price);
    await expect(page.locator('#navBookBtn')).toHaveAttribute('href',lang==='cs'?'../register/':'../register/'+lang+'/');
    await expect(page.locator('#boardgames')).toContainText(lang==='en'?'temporarily paused':lang==='cs'?'pozastaven':lang==='ru'?'временно': 'призупинен');
  }
});

test('unverified or withdrawn events cannot be submitted despite listing in catalog',async({page})=>{
  let post=0;
  await page.route(url,route=>{
    if(route.request().method()==='POST')post++;
    return route.fulfill({status:200,contentType:'application/json',headers:cors(),body:JSON.stringify({
      events:[{...example,is_open:true,registration_mode:'FORM',price_verified:false,title:'Pending price'}]
    })});
  });
  await page.goto('/register/en/?event=PUB-HIKE-20261101');
  await expect(page.locator('#rsvpForm')).toBeVisible();
  await expect(page.locator('#eventInfo')).toContainText('Awaiting confirmation');
  await expect(page.locator('#rsvpDetails')).toBeHidden();
  await expect(page.locator('#submit')).toBeDisabled();
  expect(post).toBe(0);
});

test('LIVE read-only smoke: public GitHub Pages loads catalog via real secured API',async({browser})=>{
 const context=await browser.newContext();
 const page=await context.newPage();
 try{
   await page.goto('https://aliaksei-chareshneu.github.io/alchareshneu/register/',{
     waitUntil:'domcontentloaded',timeout:30000
   });
   await expect(page.locator('#rsvpForm')).toBeVisible({timeout:20000});
   await expect(page.locator('#fallback')).toBeHidden();
   await expect(page.locator('#catalogSummary')).toContainText('Online přihláška');
   expect(await page.locator('#eventId option').count()).toBeGreaterThan(2);
   // No form submission or personal-data collection during live read-only checks.
 }finally{await context.close();}
});
