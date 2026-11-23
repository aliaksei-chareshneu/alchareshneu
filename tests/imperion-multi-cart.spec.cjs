'use strict';
const {test,expect}=require('@playwright/test');
const API='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
const START_A=new Date(Date.now()+6*86400000).toISOString();
const START_B=new Date(Date.now()+9*86400000).toISOString();
const START_C=new Date(Date.now()+12*86400000).toISOString();
const basics={community:'Družina Moravy',category:'HEMA Training',venue:'Dukelská třída 157/44, Brno',price_czk:240,
 data_controller:'Aliaksei Chareshneu (OSVČ)',rules_url:'https://aliaksei-chareshneu.github.io/alchareshneu/druzina/safety/',
 contact_activity:false,is_open:true,registration_mode:'FORM',price_verified:true,end_time_verified:true,source_active:true,
 trainingPayment:{kind:'OSVC_EVENT',sessionPaymentOpen:false,tiers:[{tier:'STANDARD',totalCzk:240},{tier:'SENIOR',totalCzk:120}]}};
const fixtures=[
 {...basics,event_id:'PUB-HEMA-MULTI-A',title:'Mock First Training',begins_at:START_A,ends_at:new Date(Date.parse(START_A)+7200000).toISOString()},
 {...basics,event_id:'PUB-HEMA-MULTI-B',title:'Mock Second Training',begins_at:START_B,ends_at:new Date(Date.parse(START_B)+7200000).toISOString()},
 {...basics,event_id:'PUB-HEMA-MULTI-C',title:'Mock NGO Training',begins_at:START_C,ends_at:new Date(Date.parse(START_C)+7200000).toISOString(),data_controller:'Družina Moravy, z. s.',trainingPayment:{status:'AWAITING_ORGANIZER_GO',sessionPaymentOpen:false,tiers:[{tier:'STANDARD',totalCzk:240}]}}
];
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET, POST, OPTIONS'};
function stub(page,posted,catalog=fixtures){return page.route(API,route=>{
 const method=route.request().method();
 if(method==='OPTIONS')return route.fulfill({status:204,headers:cors});
 if(method==='GET')return route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify({events:catalog})});
 posted.push(JSON.parse(route.request().postData()));
 return route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify({ok:true,cartId:'12345678-1234-4234-8234-123456789abc',cartToken:'A'.repeat(43),controller:'MIXED',references:[],secrets:[],confirmed:false,bankVerified:false})});
});}
async function pick(page,name){const detail=page.locator('.event-search-collapse');if((await detail.getAttribute('open'))===null)await detail.locator('summary').click();await page.locator('#eventSearch').fill(name);await expect(page.locator('#eventMatches')).toBeVisible();await page.locator('#eventMatches .match-option').filter({hasText:name}).first().click();}
for(const lang of ['cs','en','ru','uk']){
 const path='/register/'+(lang==='cs'?'':lang+'/');
 test(lang+' participant selects two dates, corrects choice and one form request',async({page})=>{
   const posted=[];await stub(page,posted);
   await page.goto(path+'?event=PUB-HEMA-MULTI-A');
   await expect(page.locator('#imperionMultiCart')).toBeVisible();
   await expect(page.locator('#imperionMultiCart .cart-item')).toHaveCount(1);
   await pick(page,'Mock Second Training');
   await expect(page.locator('#imperionMultiCart .cart-item')).toHaveCount(2);
   await expect(page.locator('#imperionMultiCart .cart-totals')).toContainText('480');
   await page.locator('#imperionMultiCart .cart-item').first().locator('button').click();
   await expect(page.locator('#imperionMultiCart .cart-item')).toHaveCount(1);
   await expect(page.locator('#eventId')).toHaveValue('PUB-HEMA-MULTI-B');
   await pick(page,'Mock First Training');
   await expect(page.locator('#imperionMultiCart .cart-item')).toHaveCount(2);
   await page.locator('#firstName').fill('Test');await page.locator('#lastName').fill('Example');
   await page.locator('#email').fill('cart-test@example.invalid');await page.locator('#phone').fill('+420 777 123 456');
   await page.locator('#safety').check();
   
   await page.locator('#submit').click();
   await expect(page.locator('#result')).toBeVisible();
   expect(posted).toHaveLength(1);
   expect(posted[0]).toMatchObject({action:'cart_submit',safety:true,photo:'NO',futureUpdates:false,osvcSellerConsent:false});
   expect(posted[0].eventIds).toHaveLength(2);
   expect(new Set(posted[0].eventIds).size).toBe(2);
 });
}
test('mixed internal controllers have one clean total and one intake; no payment payee displayed yet',async({page})=>{
 const posted=[];await stub(page,posted);
 await page.goto('/register/en/?event=PUB-HEMA-MULTI-A');
 await pick(page,'Mock NGO Training');
 await expect(page.locator('#imperionMultiCart .cart-totals p')).toHaveCount(1);
 await expect(page.locator('#imperionMultiCart .cart-totals')).toContainText('480');
 await expect(page.locator('#imperionMultiCart .cart-totals')).not.toContainText('OSVČ');
 await expect(page.locator('#imperionMultiCart .cart-totals')).not.toContainText('z. s.');
 await page.locator('#firstName').fill('Test');await page.locator('#lastName').fill('Example');
 await page.locator('#email').fill('cart-test@example.invalid');await page.locator('#phone').fill('+420 777 123 456');
 await page.locator('#safety').check();
 await page.locator('#submit').click();
 await expect(page.locator('#result')).toBeVisible();
 expect(posted).toHaveLength(1);
 expect(posted[0].action).toBe('cart_submit');
 expect(posted[0].eventIds).toEqual(['PUB-HEMA-MULTI-A','PUB-HEMA-MULTI-C']);
});
const eightDates=Array.from({length:8},(_,i)=>{
 const start=new Date(Date.now()+(6+i*3)*86400000).toISOString();
 return {...basics,event_id:'PUB-HEMA-BUNDLE-'+i,title:'UX package date '+(i+1),
  begins_at:start,ends_at:new Date(Date.parse(start)+7200000).toISOString()};
});
test('full-width layout, no empty desktop column, optional fields folded',async({page})=>{
 const posted=[];await stub(page,posted,eightDates);
 await page.setViewportSize({width:1280,height:900});
 await page.goto('/register/en/?event=PUB-HEMA-BUNDLE-0');
 await expect(page.locator('#rsvpForm')).toBeVisible();
 await expect(page.locator('.layout>.pitch')).toBeVisible();
   const heroHeight=await page.locator('.layout>.pitch').evaluate(el=>el.getBoundingClientRect().height);
   // Subpixel font/layout rounding may add <1 px across renderers; still a compact top block.
 expect(heroHeight).toBeLessThan(155);
 const width=await page.locator('.layout>.panel').evaluate(el=>el.getBoundingClientRect().width);
 expect(width).toBeGreaterThan(980);
 await expect(page.locator('#optionalDisclosure')).not.toHaveAttribute('open','');
 await expect(page.locator('.event-search-collapse')).not.toHaveAttribute('open','');
 await expect(page.locator('#imperionMultiCart .cart-item')).toHaveCount(1);
});
test('one HEMA date submits via the same simple cart path',async({page})=>{
 const posted=[];await stub(page,posted,eightDates);
 await page.goto('/register/en/?event=PUB-HEMA-BUNDLE-0');
 await page.locator('#firstName').fill('Test');await page.locator('#lastName').fill('Buyer');
 await page.locator('#email').fill('buyer@example.invalid');await page.locator('#phone').fill('+420 777 123 456');
 await page.locator('#safety').check();
 await expect(page.locator('#imperionMultiCart .cart-consent input')).toBeHidden();
 await page.locator('#submit').click();
 await expect(page.locator('#result')).toBeVisible();
 expect(posted).toHaveLength(1);
 expect(posted[0].action).toBe('cart_submit');
 expect(posted[0].eventIds).toEqual(['PUB-HEMA-BUNDLE-0']);
});
test('package preview: 4=800, 5=1040, 8=1600; Senior does not receive unearned package discount',async({page})=>{
 const posted=[];await stub(page,posted,eightDates);
 await page.goto('/register/en/?event=PUB-HEMA-BUNDLE-0');
 for(let i=1;i<4;i++)await pick(page,'UX package date '+(i+1));
 await expect(page.locator('#imperionMultiCart .cart-item')).toHaveCount(4);
 await expect(page.locator('#imperionMultiCart .cart-totals')).toContainText('800');
 await expect(page.locator('#imperionMultiCart .cart-plan-note')).toContainText('Starter 4');
 await pick(page,'UX package date 5');
 await expect(page.locator('#imperionMultiCart .cart-totals')).toContainText('1,040');
 for(let i=6;i<=8;i++)await pick(page,'UX package date '+i);
 await expect(page.locator('#imperionMultiCart .cart-item')).toHaveCount(8);
 await expect(page.locator('#imperionMultiCart .cart-totals')).toContainText('1,600');
 await page.locator('#cartTierChoice').selectOption('SENIOR');
 await expect(page.locator('#imperionMultiCart .cart-totals')).toContainText('960');
 await page.locator('#cartTierChoice').selectOption('STANDARD');
 await page.locator('#cartPlanChoice').selectOption('SINGLE');
 await expect(page.locator('#imperionMultiCart .cart-totals')).toContainText('1,920');
});
