const {test,expect}=require('@playwright/test');
const languages={
  cs:{price:'Aktuální skupinové ceny',meeting:'PO 9. 11.'},
  en:{price:'Current group prices',meeting:'MON 9 NOV'},
  ru:{price:'Актуальные групповые цены',meeting:'ПН 9 НОЯБРЯ'},
  uk:{price:'Актуальні групові ціни',meeting:'ПН 9 ЛИСТОПАДА'}
};
for(const [lang,copy] of Object.entries(languages)){
  test('Druzina mobile CTA truly fits first viewport and Nov 9 facts remain localised: '+lang,async({page})=>{
    await page.setViewportSize({width:390,height:844});
    await page.goto('/druzina/?lang='+lang);
    const cta=page.locator('#druzina .dm-v2-primary');
    await expect(page.locator('html')).toHaveAttribute('lang',lang);
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href','prihlaska/?lang='+lang);
    const actual=await cta.evaluate(el=>{
      const rect=el.getBoundingClientRect();
      return {top:rect.top,bottom:rect.bottom,width:rect.width,height:innerHeight,
        overflow:document.documentElement.scrollWidth-innerWidth};
    });
    expect(actual.top,lang+' CTA top').toBeGreaterThanOrEqual(0);
    expect(actual.bottom,lang+' CTA must be usable without scrolling').toBeLessThanOrEqual(actual.height+1);
    expect(actual.width).toBeGreaterThanOrEqual(250);
    expect(actual.overflow).toBeLessThanOrEqual(1);
    const order=await page.evaluate(()=>{
      const ids=['#druzina .dm-v2-primary','#dm-training-update-20261106','#dm-meeting-20261109','#dm-relaunch-20261107'];
      return ids.map(selector=>document.querySelector(selector)).map(el=>el.getBoundingClientRect().top+scrollY);
    });
    expect(order).toEqual([...order].sort((a,b)=>a-b));
    await expect(page.locator('#dm-meeting-20261109 [data-meeting-lang]:visible')).toHaveCount(1);
    await expect(page.locator('#dm-meeting-20261109 [data-meeting-lang="'+lang+'"]')).toContainText(copy.meeting);
    await expect(page.locator('#dm-meeting-20261109 [data-meeting-lang="'+lang+'"]')).toContainText('Dukelská třída 157/44');
    await expect(page.locator('#dm-meeting-20261109 [data-meeting-lang="'+lang+'"]')).toContainText('18:00');
    await expect(page.locator('.dm-permanentky-offer [data-dm-v2-locale="'+lang+'"] h2')).toHaveText(copy.price);
    await expect(page.locator('.dm-permanentky-offer [data-dm-v2-locale="'+lang+'"] a')).toHaveAttribute('href','permanentky/');
  });
}
test('Druzina 320px has no horizontal overflow and keeps CTA ahead of long notes',async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await page.goto('/druzina/?lang=ru');
  const geometry=await page.locator('#druzina .dm-v2-primary').evaluate(el=>({
    top:el.getBoundingClientRect().top,
    bottom:el.getBoundingClientRect().bottom,
    height:innerHeight,overflow:document.documentElement.scrollWidth-innerWidth
  }));
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.height+1);
});
const shopPaths=['/shop/','/shop/csv-rescue/','/shop/ai-workflow-roi/',
 '/shop/guides/csv-data-quality/','/shop/guides/automation-payback/','/shop/legal/','/shop/thanks/'];
const rgb=colour=>(colour.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
function contrast(foreground,background){
 const luma=colour=>rgb(colour).reduce((sum,v,i)=>{
  const c=v/255,s=c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;
  return sum+s*[.2126,.7152,.0722][i];
 },0);
 const a=luma(foreground),b=luma(background);
 return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
for(const path of shopPaths){
 test('Shop dark brand, CSS links, legibility and mobile overflow: '+path,async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto(path);
  await expect(page.locator('body')).toHaveAttribute('data-imperion-scope','shop');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#0b1729');
  await expect(page.locator('link[href*="brand-theme.css"]')).toHaveCount(1);
  await expect(page.locator('link[href*="site-design.css"]')).toHaveCount(1);
  const palette=await page.evaluate(()=>{
   const css=el=>getComputedStyle(el);
   const link=document.querySelector('.nav a');
   const card=document.querySelector('.card p');
   const panel=card?.closest('.card');
   return {background:css(document.body).backgroundColor,
    navigation:css(document.querySelector('.nav')).backgroundColor,
    linkColor:css(link).color,
    cardText:card?css(card).color:null,cardBackground:panel?css(panel).backgroundColor:null,
    overflow:document.documentElement.scrollWidth-innerWidth};
  });
  expect(palette.background).toBe('rgb(11, 23, 41)');
  expect(palette.navigation).toBe('rgb(16, 34, 56)');
  expect(contrast(palette.linkColor,palette.navigation)).toBeGreaterThanOrEqual(4.5);
  if(palette.cardText)expect(contrast(palette.cardText,palette.cardBackground)).toBeGreaterThanOrEqual(4.5);
  expect(palette.overflow).toBeLessThanOrEqual(1);
 });
}
