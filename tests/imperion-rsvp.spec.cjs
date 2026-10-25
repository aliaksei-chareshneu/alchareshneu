const {test,expect}=require('@playwright/test');
const url='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
const example={event_id:'PUB-HIKE-20261101',title:'BrnoWalkers: Hády – Růženin lom – Obřany',community:'BrnoWalkers',category:'Hike',begins_at:'2026-11-01T11:45:00Z',ends_at:'2026-11-01T15:15:00Z',venue:'Velká Klajdovka, Brno',price_czk:0,data_controller:'Družina Moravy, z. s.',rules_url:'https://aliaksei-chareshneu.github.io/alchareshneu/register/safety/',contact_activity:false};
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
  await page.locator('#firstName').fill('Test');
  await page.locator('#lastName').fill('Example');
  await page.locator('#email').fill('synthetic-rsvp@example.test');
  await page.locator('#phone').fill('+420 777 111 222');
  await page.locator('#safety').check();
  await page.locator('#submit').click();
  await expect(page.locator('#result')).toContainText('Přihláška byla přijata');
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
 await expect(page.locator('#contactLink')).toHaveAttribute('href',/^https:\/\/wa\.me\//);
});
