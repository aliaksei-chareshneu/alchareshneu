'use strict';
const {test,expect}=require('@playwright/test');

test('live HEMA registration shows open future training and private PDF field without writes',async({page})=>{
 test.setTimeout(70000);
 const endpoint='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
 const errors=[],api=[];
 page.on('requestfailed',req=>{if(req.url().startsWith(endpoint))errors.push(req.failure()?.errorText||'network failed');});
 page.on('response',res=>{if(res.url().startsWith(endpoint))api.push({status:res.status(),method:res.request().method()});});
 await page.goto('https://aliaksei-chareshneu.github.io/alchareshneu/register/?lang=en&live_qa=20261123',
 {waitUntil:'domcontentloaded'});
 await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 await expect(page.locator('#fallback')).toBeHidden();
 await expect(page.locator('#rsvpForm')).toBeVisible();
 const choice=await page.evaluate(()=>{
  const now=Date.now();
  const pool=typeof events==='undefined'?[]:events;
  return pool.filter(e=>e.category==='HEMA Training' && e.community==='Družina Moravy' && e.is_open &&
    e.registration_mode==='FORM' && Date.parse(e.begins_at)>now)
   .sort((a,b)=>Date.parse(a.begins_at)-Date.parse(b.begins_at))
   .map(e=>({id:e.event_id,controller:e.data_controller}))[0]||null;
 });
 test.skip(!choice,'No future active HEMA training exists for live smoke test');
 await page.evaluate(id=>chooseEvent(id),choice.id);
 await expect(page.locator('#eventId')).toHaveValue(choice.id);
 await expect(page.locator('#eventInfo')).toContainText('Dukelská třída 157/44');
 const legacy=page.locator('#checkoutPaymentDetails');
 if(await legacy.count())await legacy.locator('summary').click();
 await expect(page.locator('#trainingPayment')).toBeVisible();
 await expect(page.locator('#paymentProofField')).toBeVisible();
 await expect(page.locator('#paymentProofRecipientField')).toBeVisible();
 await expect(page.locator('#paymentProofRecipient')).toHaveValue(
  choice.controller==='Družina Moravy, z. s.'?'DRUZINA':'OSVC');
 await expect(page.locator('#paymentProof')).not.toHaveAttribute('required','');
 await expect(page.locator('#paymentQrArea')).toBeHidden();
 expect(errors).toEqual([]);
 expect(api.some(x=>x.method==='GET'&&x.status===200)).toBe(true);
 expect(api.every(x=>x.method==='GET')).toBe(true);
});
