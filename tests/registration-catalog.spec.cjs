const {test,expect}=require('@playwright/test');
const endpoint='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
const base={community:'BrnoWalkers',category:'Hike',ends_at:'2026-11-28T13:30:00Z',venue:'Brno',price_czk:0,data_controller:'Družina Moravy, z. s.',rules_url:'https://aliaksei-chareshneu.github.io/alchareshneu/register/safety/',contact_activity:false,price_verified:true,end_time_verified:true};
const events=[
 {...base,event_id:'PUB-HIKE-20261101',title:'BrnoWalkers Hády',begins_at:'2026-11-01T11:45:00Z',is_open:true,registration_mode:'FORM'},
 {...base,event_id:'PUB-OREL-20261114',title:'Orel beginner HEMA',begins_at:'2026-11-14T11:00:00Z',registration_mode:'CONTACT',is_open:false,category:'HEMA Training',action_url:'https://wa.me/420702914842?text=OREL%2014'},
 {...base,event_id:'PUB-HEMA-20261116',title:'Future group training',begins_at:'2026-11-16T17:00:00Z',registration_mode:'PLANNED',is_open:false},
 {...base,event_id:'PUB-HIKE-20261128',title:'Obřany to Bílovice',begins_at:'2026-11-28T09:00:00Z',registration_mode:'FORM',is_open:true}
];
for(const lang of ['cs','en','ru','uk']){
 test('searchable catalog '+lang+' distinguishes active, contact and planned sessions',async({page})=>{
   let posts=0;
   await page.route(endpoint,route=>{if(route.request().method()==='POST'){posts++;return route.fulfill({status:400,contentType:'application/json',body:'{"error":"event_not_available"}'});}return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({events})});});
   await page.goto('/register/'+(lang==='cs'?'':lang+'/'));
   await expect(page.locator('#rsvpForm')).toBeVisible();
   await expect(page.locator('#rsvpDetails')).toBeHidden();
   await expect(page.locator('#catalogSummary')).toContainText('4');
   await page.locator('#eventSearch').fill('Orel');
   await expect(page.locator('#eventMatches .match-option')).toHaveCount(1);
   await page.locator('#eventMatches .match-option').click();
   await expect(page.locator('#eventId')).toHaveValue('PUB-OREL-20261114');
   await expect(page.locator('#rsvpDetails')).toBeHidden();
   await expect(page.locator('#eventInfo .contact-cta')).toHaveAttribute('href',/^https:\/\/wa\.me\//);
   const alternatives=page.locator('#eventInfo .contact-alternatives a');
   await expect(alternatives).toHaveCount(3);
   await expect(alternatives.nth(0)).toHaveAttribute('href','https://t.me/Chareshneu');
   await expect(alternatives.nth(1)).toHaveAttribute('href',/^sms:\+420702914842\?body=/);
   await expect(alternatives.nth(2)).toHaveAttribute('href',/^mailto:chereshnev\.biochem@gmail\.com\?/);
   await expect(page.locator('#eventInfo .contact-lead')).toBeVisible();
   await page.locator('#eventSearch').fill('Future group');
   await page.locator('#eventMatches .match-option').click();
   await expect(page.locator('#rsvpDetails')).toBeHidden();
   await expect(page.locator('#eventInfo .contact-cta')).toHaveCount(0);
   await page.locator('#eventSearch').fill('Bílovice');
   await page.locator('#eventMatches .match-option').click();
   await expect(page.locator('#rsvpDetails')).toBeVisible();
   await expect(page.locator('#eventId')).toHaveValue('PUB-HIKE-20261128');
   await expect(page.locator('#optionalConsents')).toBeVisible();
   await expect(page.locator('#optionalConsentNote')).toBeVisible();
   await expect(page.locator('#photo')).not.toBeChecked();
   await expect(page.locator('#future')).not.toBeChecked();
   await expect(page.locator('#safety')).not.toBeChecked();
   const firstConsent=await page.evaluate(()=>{
      const opts=document.querySelector('#optionalConsents'),first=document.querySelector('#firstName');
      return Boolean(opts.compareDocumentPosition(first)&Node.DOCUMENT_POSITION_FOLLOWING);
   });
   expect(firstConsent).toBe(true);
   expect(posts).toBe(0);
 });
}
