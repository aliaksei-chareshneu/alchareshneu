const {test,expect}=require('@playwright/test');
const endpoint='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
test('voluntary discovery plus URL campaign reach the existing RSVP endpoint without marketing opt-in',async({page})=>{
 let sent=null;
 const start=new Date(Date.now()+21*86400000).toISOString(), end=new Date(Date.now()+21*86400000+5400000).toISOString();
 const event={event_id:'PUB-TEST-CAMPAIGN',title:'Synthetic beginner activity',community:'Družina Moravy',
  category:'HEMA Training',begins_at:start,ends_at:end,venue:'Sample venue',
  price_czk:0,data_controller:'Družina Moravy, z. s.',
  rules_url:'https://aliaksei-chareshneu.github.io/alchareshneu/druzina/safety/',
  contact_activity:true,is_open:true,registration_mode:'FORM',price_verified:true,end_time_verified:true};
 await page.route(endpoint,async route=>{
  const req=route.request();
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type'}});
  if(req.method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({events:[event]})});
  sent=JSON.parse(req.postData());
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,status:'RECEIVED',confirmed:false})});
 });
 await page.goto('/register/?event=PUB-TEST-CAMPAIGN&src=IS_MUNI&utm_medium=email&utm_campaign=HEMA_NOV14');
 await expect(page.locator('#rsvpForm')).toBeVisible();
 await page.locator('#firstName').fill('Synthetic');
 await page.locator('#lastName').fill('Participant');
 await page.locator('#email').fill('synthetic@example.invalid');
 await page.locator('#phone').fill('+420 777 111 222');
 await page.locator('#discoverySource').selectOption('SPOLEK_MUNI');
 await page.locator('#safety').check();
 await expect(page.locator('#future')).not.toBeChecked();
 await page.locator('#submit').click();
 await expect(page.locator('#result')).toBeVisible();
 expect(sent).toMatchObject({eventId:'PUB-TEST-CAMPAIGN',discoverySource:'SPOLEK_MUNI',
  utmSource:'IS_MUNI',utmMedium:'email',utmCampaign:'HEMA_NOV14',futureUpdates:false});
});
