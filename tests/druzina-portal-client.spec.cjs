'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const jsqr=require('jsqr');
const {prepare,render}=require('../ops/prepare-druzina-portal.cjs');
const {stage}=require('./helpers/druzina-staging-fixture.cjs');
const {harness}=require('./helpers/druzina-apps-script-harness.cjs');
const source=path.join(__dirname,'fixtures/druzina-portal-p13');
const staging=fs.mkdtempSync(path.join(os.tmpdir(),'druzina-p14-'));
prepare(source,path.join(staging,'source'));
const html=render(path.join(staging,'source'));
const locales={cs:{account:'Moje rezervace a balíčky',pending:'Čekáme na ověření bankou',paid:'Platba ověřena bankou'},
 en:{account:'My bookings and packages',pending:'Waiting for bank verification',paid:'Bank payment verified'},
 ru:{account:'Мои брони и пакеты',pending:'Ожидается банковская проверка',paid:'Банковская оплата проверена'},
 uk:{account:'Мої бронювання та пакети',pending:'Очікуємо перевірки банком',paid:'Банківську оплату перевірено'}};
async function mount(page,h){
 const allowed=new Set(['getBootstrap','requestBookingCode','verifyBookingCode','getDruzinaMemberAccount',
  'getEligibleProducts','getSessionOffer','getDruzinaCheckoutTerms','createDruzinaBankQuote','getDruzinaOrderStatus',
  'rescheduleDruzinaBooking','requestDruzinaCancellation','getDruzinaBookingOperations']);
 const calls=[];
 await page.goto('/404.html');
 await page.route('**/*',route=>route.abort());
 await page.exposeFunction('syntheticGas',async(name,args)=>{
  calls.push(name);if(!allowed.has(name))throw Error('Disallowed staging API: '+name);
  return JSON.parse(JSON.stringify(h.call(name,...args)));
 });
 await page.addScriptTag({content:`window.google={script:{run:new Proxy({}, {get(_t,key){if(key==='withSuccessHandler')return success=>new Proxy({}, {get(_u,next){if(next==='withFailureHandler')return failure=>new Proxy({}, {get(_v,fn){return (...args)=>window.syntheticGas(fn,args).then(success).catch(e=>failure({message:e.message}));}});}});}})}};`});
 await page.setContent(html);
 return calls;
}
for(const [locale,words] of Object.entries(locales))test('existing portal actual synthetic server flow '+locale,async({page})=>{
 const {h,session}=stage({sourceDir:path.join(staging,'source')});session(72);
 await page.setViewportSize({width:360,height:800});
 const calls=await mount(page,h);
 await expect(page.locator('#sendCode')).toBeVisible();
 await page.locator('#lang').selectOption(locale);
 await page.locator('#name').fill('Synthetic Member');await page.locator('#email').fill('synthetic-member@example.test');
 await page.locator('#sendCode').click();await expect(page.locator('#otp')).toBeVisible();
 const code=h.emails.at(-1).body.match(/code: ([A-F0-9]{10})/)[1];
 await page.locator('#otp').fill(code);await page.locator('#verifyCode').click();
 await expect(page.locator('#app h2')).toHaveText(words.account);
 await page.locator('#newBooking').click();await page.locator('.dm14-choice').first().click();
 await page.locator('.session.dm14-choice').first().click();await page.locator('#acceptTerms').check();await page.locator('#next').click();
 await expect(page.locator('#orderTotal')).toHaveText('240 Kč');
 await expect(page.locator('#orderStatus')).toContainText(words.pending);
 await expect(page.locator('#paymentQr svg')).toBeVisible();
 await expect(page.locator('input[type=file]')).toHaveCount(0);
 const spd=await page.locator('#paymentString').inputValue();
 expect(spd).toMatch(/^SPD\*1\.0\*ACC:CZ\d{22}\*AM:240\.00\*CC:CZK\*X-VS:\d{10}$/);
 expect(h.rows('Payments')).toHaveLength(0);expect(h.rows('Bookings')).toHaveLength(0);
 await page.locator('#checkOrder').click();await expect(page.locator('#orderStatus')).toContainText(words.pending);
 const q=h.rows('Quotes')[0];
 const settled=h.call('drufCommitVerifiedBankTransaction_',{transactionId:'1000000009',variableSymbol:q.Payment_Reference,
  amountCZK:240,amountHalers:24000,currency:'CZK',direction:'CREDIT',tokenAccountVerified:true,
  isReversal:false,accountKey:'192000145399/0800'});
 expect(settled.ok).toBe(true);
 await page.locator('#checkOrder').click();await expect(page.locator('#orderStatus')).toContainText(words.paid);
 expect(calls).not.toContain('submitQuotePayment');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 expect(await page.evaluate(()=>({token:localStorage.getItem('bookingToken'),url:location.href}))).not.toMatchObject({token:expect.any(String)});
 // Rasterize the SVG actually rendered by the client, then independently
 // decode its pixels. A wrong/missing QR payload cannot pass via text alone.
 const pixels=await page.locator('#paymentQr svg').evaluate(async svg=>{
  const clone=svg.cloneNode(true);clone.setAttribute('width','320');clone.setAttribute('height','320');
  const image=new Image();const loaded=new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});
  image.src='data:image/svg+xml;base64,'+btoa(new XMLSerializer().serializeToString(clone));await loaded;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=320;
  const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,320,320);ctx.drawImage(image,0,0,320,320);
  return Array.from(ctx.getImageData(0,0,320,320).data);
 });
 expect(jsqr(new Uint8ClampedArray(pixels),320,320).data).toBe(spd);
});
test('default paused portal has account access but no payment/order instructions',async({page})=>{
 const h=harness({enforceEmailAuth:true,sourceDir:path.join(staging,'source')});const calls=await mount(page,h);
 await expect(page.locator('#accountLogin')).toBeVisible();await expect(page.locator('#paymentQr')).toHaveCount(0);
 expect(calls).toEqual(['getBootstrap']);expect(h.emails).toHaveLength(0);
});
