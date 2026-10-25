const {test,expect}=require('@playwright/test');
const endpoint='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
const event={event_id:'PUB-HIKE-20261101',title:'BrnoWalkers: Hády – Růženin lom – Obřany',community:'BrnoWalkers',category:'Hike',begins_at:'2026-11-01T11:45:00Z',ends_at:'2026-11-01T15:15:00Z',venue:'Velká Klajdovka, Brno',price_czk:0,data_controller:'Družina Moravy, z. s.',rules_url:'https://aliaksei-chareshneu.github.io/alchareshneu/register/safety/',contact_activity:false};
for(const locale of ['cs','en','ru','uk']){
 for(const width of [768,1024,1440]){
  test('registration hero stays clear of the form for '+locale+' at '+width+'px',async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.route(endpoint,r=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({events:[event]})}));
    await page.goto(locale==='cs'?'/register/':'/register/'+locale+'/');
    await expect(page.locator('#rsvpForm')).toBeVisible();
    const metrics=await page.evaluate(()=>{
      const h=document.querySelector('#hero'),panel=document.querySelector('#form');
      const range=document.createRange();range.selectNodeContents(h);
      return {textRight:Math.max(...Array.from(range.getClientRects()).map(r=>r.right)),panelLeft:panel.getBoundingClientRect().left,heroLeft:h.getBoundingClientRect().left,screenWidth:innerWidth,scrollWidth:document.documentElement.scrollWidth};
    });
    expect(metrics.textRight).toBeLessThanOrEqual(metrics.panelLeft-8);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(width+1);
  });
 }
}