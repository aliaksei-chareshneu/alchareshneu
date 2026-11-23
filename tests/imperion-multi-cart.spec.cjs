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
function stub(page,posted){return page.route(API,route=>{
 const method=route.request().method();
 if(method==='OPTIONS')return route.fulfill({status:204,headers:cors});
 if(method==='GET')return route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify({events:fixtures})});
 posted.push(JSON.parse(route.request().postData()));
 return route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify({ok:true,cartId:'12345678-1234-4234-8234-123456789abc',cartToken:'A'.repeat(43),controller:'MIXED',references:[],secrets:[],confirmed:false,bankVerified:false})});
});}
async function pick(page,name){const detail=page.locator('.event-search-collapse');if(!(await detail.getAttribute('open')))await detail.locator('summary').click();await page.locator('#eventSearch').fill(name);await expect(page.locator('#eventMatches')).toBeVisible();await page.locator('#eventMatches .match-option').filter({hasText:name}).first().click();}
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
   await page.locator('#imperionMultiCart .cart-consent input').check();
   await page.locator('#submit').click();
   await expect(page.locator('#result')).toBeVisible();
   expect(posted).toHaveLength(1);
   expect(posted[0]).toMatchObject({action:'cart_submit',safety:true,photo:false,futureUpdates:false,osvcSellerConsent:true});
   expect(posted[0].eventIds).toHaveLength(2);
   expect(new Set(posted[0].eventIds).size).toBe(2);
 });
}
test('mixed legal sellers remain visibly split into two amounts, no combined bank quote',async({page})=>{
 const posted=[];await stub(page,posted);
 await page.goto('/register/en/?event=PUB-HEMA-MULTI-A');
 await pick(page,'Mock NGO Training');
 await expect(page.locator('#imperionMultiCart .cart-totals p')).toHaveCount(2);
 await expect(page.locator('#imperionMultiCart')).toContainText('Separate legal providers require separate payments.');
 await page.locator('#firstName').fill('Test');await page.locator('#lastName').fill('Example');
 await page.locator('#email').fill('cart-test@example.invalid');await page.locator('#phone').fill('+420 777 123 456');
 await page.locator('#safety').check();await page.locator('#imperionMultiCart .cart-consent input').check();
 await page.locator('#submit').click();
 await expect(page.locator('#result')).toContainText('Different legal entities cannot share a bank transfer.');
 expect(posted).toHaveLength(1);
 expect(posted[0].eventIds).toEqual(['PUB-HEMA-MULTI-A','PUB-HEMA-MULTI-C']);
});