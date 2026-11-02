const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const endpoint='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';

test('BrnoWalkers two paid walks have distinct website-first interest links, not checkout',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto('/walkers/');
  const section=page.locator('#bw-paid-interest-202611');
  await expect(section).toBeVisible();
  await expect(section).toContainText('uncommitted enquiry');
  await expect(section).toContainText('we do not collect payment through this form');
  const a=page.locator('#bw-walk-20261117 a[href*="register"]');
  const b=page.locator('#bw-walk-20261129 a[href*="register"]');
  await expect(a).toHaveAttribute('href',/register\/\?event=PUB-WALK-20261117/);
  await expect(b).toHaveAttribute('href',/register\/\?event=PUB-WALK-20261129/);
  await expect(page.locator('#bw-walk-20261117')).toContainText('18+');
  await expect(page.locator('#bw-walk-20261117')).toContainText('390 Kč');
  await expect(page.locator('#bw-walk-20261129')).toContainText('450 Kč');
  await expect(section.locator('a[href*="buy.stripe.com"],a[href*="checkout.stripe.com"]')).toHaveCount(0);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

for(const lang of ['cs','en','ru','uk']){
 test('only adult interest is allowed in 17 Nov event UI, '+lang,async({page})=>{
  const base={category:'Guided Walk',community:'BrnoWalkers / OSVČ',venue:'Brno',price_czk:390,price_verified:true,end_time_verified:true,data_controller:'Aliaksei Chareshneu (OSVČ)',rules_url:'https://aliaksei-chareshneu.github.io/alchareshneu/register/safety/',contact_activity:false,is_open:true,registration_mode:'FORM',ends_at:'2099-11-17T16:00:00Z',begins_at:'2099-11-17T07:30:00Z'};
  const events=[{...base,event_id:'PUB-WALK-20261117',title:'Adults-only 18+ walk'}, {...base,event_id:'PUB-WALK-20261129',title:'Brno historical walk',begins_at:'2099-11-29T13:00:00Z',ends_at:'2099-11-29T15:30:00Z',price_czk:450}];
  await page.route(endpoint,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({events})}));
  await page.goto('/register/'+(lang==='cs'?'':lang+'/')+'?event=PUB-WALK-20261117');
  await expect(page.locator('#eventId')).toHaveValue('PUB-WALK-20261117');
  await expect(page.locator('input[name=age][value=under18]')).toBeDisabled();
  await expect(page.locator('#eventInfo')).toContainText(lang==='en'?'Adults 18+':lang==='cs'?'18 let':lang==='ru'?'18+':'18+');
  await page.locator('#eventSearch').fill('historical walk');
  await page.locator('#eventMatches .match-option').click();
  await expect(page.locator('#eventId')).toHaveValue('PUB-WALK-20261129');
  await expect(page.locator('input[name=age][value=under18]')).toBeEnabled();
 });
}
test('RSVP server source rejects minors before storing 17 November 18+ form request',async()=>{
  const src=fs.readFileSync('supabase/functions/imperion-register/index.ts','utf8');
  expect(src).toContain("event.event_id==='PUB-WALK-20261117' && v.age!=='adult'");
  expect(src.indexOf("error:'adult_only_event'")).toBeLessThan(src.indexOf("from('imperion_rsvp_submissions').insert"));
});
