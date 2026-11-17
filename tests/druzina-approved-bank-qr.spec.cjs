'use strict';
const {test,expect}=require('@playwright/test');
const ENDPOINT='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
const UUID='11111111-1111-4111-8111-111111111111';
const VS='7123456789';
const IBAN='CZ6508000000192000145399';
const SPD='SPD*1.0*ACC:'+IBAN+'*AM:240.00*CC:CZK*MSG:DM '+UUID.replace(/-/g,'').toUpperCase()+'*X-VS:'+VS;

const event={event_id:'PUB-HEMA-20261116',title:'Synthetic Monday training',community:'Družina Moravy',category:'HEMA Training',price_czk:240,begins_at:'2026-11-16T17:00:00Z',ends_at:'2026-11-16T19:00:00Z',venue:'Brno synthetic',rules_url:'https://example.invalid/terms',is_open:true,source_active:true,price_verified:true,end_time_verified:true,registration_mode:'FORM',trainingPayment:{sessionPaymentOpen:true,tiers:[{tier:'STANDARD',baseCzk:240,surchargeCzk:0,totalCzk:240}]}};
const approved={ok:true,confirmed:false,trainingPayment:{tier:'STANDARD',baseCzk:240,
 surchargeCzk:0,totalCzk:240,late48h:false,quoteLockedAt:'2026-11-14T09:00:00Z',
 recipient:'Synthetic Test Association',account:'19-2000145399/0800',iban:IBAN,
 paymentReference:UUID,variableSymbol:VS,spd:SPD,proofRequired:true,bankVerified:false}};
for(const [lang,uri] of [['cs','/register/'],['en','/register/en/'],['ru','/register/ru/'],['uk','/register/uk/']]){
 test('bank instructions require private approved quote in '+lang,async({page})=>{
  await page.clock.install({time:new Date('2026-11-14T08:00:00Z')});
  let quotes=0;
  await page.route(ENDPOINT,route=>{
   if(route.request().method()==='POST'){
    quotes++;
    return route.fulfill({status:200,contentType:'application/json',
     headers:{'access-control-allow-origin':'*'},body:JSON.stringify(approved)});
   }
   return route.fulfill({status:200,contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},body:JSON.stringify({events:[event]})});
  });
  await page.goto(uri,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#rsvpForm')).toBeVisible({timeout:12000});
  await page.evaluate(()=>{
   const $=id=>document.getElementById(id),f=$('rsvpForm');
   $('eventId').value='PUB-HEMA-20261116';
   $('eventId').dispatchEvent(new Event('change',{bubbles:true}));
   f.checkValidity=()=>true;
   $('firstName').value='Test';$('lastName').value='Sample';
   $('email').value='example@example.invalid';$('phone').value='+420 777 888 999';
   $('paymentResumeToken').value='A'.repeat(43);
   $('safety').checked=true;
   const yes=document.querySelector('input[name=rsvp][value=YES]');
   yes.checked=true;yes.dispatchEvent(new Event('change',{bubbles:true}));
   $('paymentResumeToken').dispatchEvent(new Event('input',{bubbles:true}));
  });
  await expect(page.locator('#trainingPayment')).toBeVisible();
  await expect(page.locator('#paymentQuoteButton')).toBeVisible();
  await expect(page.locator('#paymentQrArea')).toBeHidden();
  await page.locator('#paymentQuoteButton').evaluate(el=>el.click());
  await expect.poll(()=>quotes).toBe(1);
  await expect.poll(()=>page.locator('#paymentQuoteButton').isEnabled()).toBe(true);
  if(await page.locator('#paymentQrArea').isHidden()){
   const diagnostic=await page.evaluate(()=>({
    privateText:document.getElementById('trainingPaymentPrivate')?.textContent,
    qrLibrary:typeof window.QRCode,
    qrHidden:document.getElementById('paymentQrArea')?.hidden,
    formHidden:document.getElementById('rsvpForm')?.hidden,
    paymentHidden:document.getElementById('trainingPayment')?.hidden
   }));
   throw Error('Private QR not rendered: '+JSON.stringify(diagnostic));
  }
  await expect(page.locator('#paymentQrArea')).toBeVisible();
  await expect(page.locator('#paymentQrCode canvas')).toHaveCount(1);
  await expect(page.locator('#paymentReference')).toContainText(UUID);
  await expect(page.locator('#paymentReference')).toContainText(VS);
  await expect(page.locator('#paymentProofField')).toBeVisible();
  expect(quotes).toBe(1);
  await page.locator('#paymentResumeToken').fill('B'.repeat(43));
  await expect(page.locator('#paymentQrArea')).toBeHidden();
  await expect(page.locator('#paymentProofField')).toBeHidden();
  await page.evaluate(language=>window.ImperionTrainingPayment.render(null,language,'PLANNED'),lang);
  await expect(page.locator('#paymentQrArea')).toBeHidden();
 });
}
test('public HEMA CTA presents currently open 23/28 November dates without automatic payment',async({page})=>{
 await page.clock.install({time:new Date('2026-11-15T09:00:00Z')});
 await page.goto('/druzina/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#dm-nov14-fast-rsvp')).toBeVisible();
 const upcoming=page.locator('#dm-nov14-fast-rsvp [data-fast-lang="cs"] a');
 await expect(upcoming).toHaveCount(2);
 await expect(upcoming.nth(0)).toHaveAttribute('href',/PUB-HEMA-20261123/);
 await expect(upcoming.nth(1)).toHaveAttribute('href',/PUB-HEMA-20261128/);
 await expect(page.locator('#dm-meeting-20261109')).toBeHidden();
 const links=page.locator('.dm-book-actions a[data-book-lang]');
 await expect(links).toHaveCount(4);
 for(const link of await links.all())expect(await link.getAttribute('href')).toMatch(/\.\.\/register\/\?lang=(cs|en|ru|uk)$/);
 // The public information note is now split into four language variants.
 await expect(page.locator('.reg-note[data-reg-lang="en"]')).toContainText('No online payment.');
 await expect(page.locator('.reg-note[data-reg-lang="cs"]')).toContainText('Na webu se neplatí.');
 await expect(page.locator('.reg-note[data-reg-lang="ru"]')).toContainText('Онлайн-оплаты нет.');
 await expect(page.locator('.reg-note[data-reg-lang="uk"]')).toContainText('Онлайн-оплати немає.');
});