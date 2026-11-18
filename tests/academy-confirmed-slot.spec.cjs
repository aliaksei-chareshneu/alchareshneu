'use strict';
const {test,expect}=require('@playwright/test');
const endpoint='**/functions/v1/imperion-academy-checkout';
const reference='12345678-1234-4234-8234-123456789012';

for(const [lang,word] of [
 ['cs','potvrzen'],['en','confirmed'],['ru','подтвержден'],['uk','підтверджен']
]){
 test('Academy status returns actual verified session, never the requested time: '+lang,async({page})=>{
  await page.route(endpoint,route=>route.fulfill({status:200,contentType:'application/json',
   headers:{'Access-Control-Allow-Origin':'*'},
   body:JSON.stringify({ok:true,quoteApproved:false,proofRequired:false,
    bookingConfirmed:true,bankVerified:true,evidenceReceived:true,
    requestedSession:'2026-11-15T09:00:00.000Z',
    confirmedSession:'2026-11-16T17:00:00.000Z',
    confirmedSessionEnd:'2026-11-16T18:00:00.000Z'})}));
  await page.goto('/academy/order/?lang='+lang);
  await page.locator('#aoReference').fill(reference);
  await page.locator('#aoEmailStatus').fill('synthetic-qa@example.test');
  await page.locator('#aoContinuationCode').fill('synthetic-only-test-token');
  await page.locator('#aoStatusButton').click();
  const message=page.locator('#aoStatusResult');
  await expect(message).toContainText(new RegExp(word,'i'));
  await expect(message).toContainText('Europe/Prague');
  await expect(message).toContainText('18:00');
  await expect(message).not.toContainText('10:00');
 });
}
test('Academy does not claim a reserved slot from a proposed date or uploaded receipt',async({page})=>{
 await page.route(endpoint,route=>route.fulfill({status:200,contentType:'application/json',
  headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({ok:true,quoteApproved:false,
   bankVerified:false,evidenceReceived:true,bookingConfirmed:false,
   requestedSession:'2026-11-15T09:00:00.000Z',confirmedSession:null,confirmedSessionEnd:null})}));
 await page.goto('/academy/order/?lang=en');
 await page.locator('#aoReference').fill(reference);
 await page.locator('#aoEmailStatus').fill('synthetic-qa@example.test');
 await page.locator('#aoContinuationCode').fill('synthetic-only-test-token');
 await page.locator('#aoStatusButton').click();
 await expect(page.locator('#aoStatusResult')).toContainText('Evidence received');
 await expect(page.locator('#aoStatusResult')).not.toContainText('Europe/Prague');
});
