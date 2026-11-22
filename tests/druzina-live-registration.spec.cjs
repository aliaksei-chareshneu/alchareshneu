'use strict';
const {test,expect}=require('@playwright/test');

test('live Druzina HEMA registration shows fixed meeting point and private PDF field',async({page})=>{
 test.setTimeout(70000);
 const endpoint='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
 const errors=[];
 const api=[];
 page.on('requestfailed',req=>{if(req.url().startsWith(endpoint))errors.push(req.failure()?.errorText||'network failed');});
 page.on('response',res=>{if(res.url().startsWith(endpoint))api.push({status:res.status(),method:res.request().method()});});
 await page.goto('https://aliaksei-chareshneu.github.io/alchareshneu/register/?lang=en&event=PUB-HEMA-20261123&live_qa=20261122',
   {waitUntil:'domcontentloaded'});
 await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 await expect(page.locator('#fallback')).toBeHidden();
 await expect(page.locator('#rsvpForm')).toBeVisible();
 await expect(page.locator('#eventId')).toHaveValue('PUB-HEMA-20261123');
 await expect(page.locator('#eventInfo')).toContainText('Dukelská třída 157/44');
 await expect(page.locator('#trainingPayment')).toBeVisible();
 await expect(page.locator('#paymentProofField')).toBeVisible();
 await expect(page.locator('#paymentProofRecipientField')).toBeVisible();
 await expect(page.locator('#paymentProofRecipient')).toHaveValue('OSVC');
 await expect(page.locator('#paymentPdfLabel')).toContainText('Already transferred');
 await expect(page.locator('#paymentProof')).not.toHaveAttribute('required','');
 await expect(page.locator('#paymentQrArea')).toBeHidden();
 expect(errors).toEqual([]);
 expect(api.some(x=>x.method==='GET'&&x.status===200)).toBe(true);
 // Absolutely no POST, form submission, evidence upload or monetary action.
 expect(api.every(x=>x.method==='GET')).toBe(true);
});
