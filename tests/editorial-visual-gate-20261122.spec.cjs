'use strict';
/* Browser-first visual quality gate: actual computed colors, font sizes, photos,
   320/390/768/1440 reflow and hero screenshots. No production mutations. */
const {test,expect}=require('@playwright/test');
const API='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
async function fixedPublicEvents(page){
  await page.route(API,route=>route.fulfill({
    status:200,contentType:'application/json',
    headers:{'Access-Control-Allow-Origin':'*'},body:'{"events":[]}'
  }));
}
function light(v){
  v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);
}
function rgb(color){
  const m=color.match(/rgba?\((\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/);
  if(!m)throw Error('Unrecognized CSS color: '+color);
  return [+m[1],+m[2],+m[3]];
}
function contrast(a,b){
  const l=([r,g,b])=>light(r)*0.2126+light(g)*0.7152+light(b)*0.0722;
  const aa=l(rgb(a)),bb=l(rgb(b));
  return (Math.max(aa,bb)+.05)/(Math.min(aa,bb)+.05);
}
for(const width of [320,390,768,1440]){
  test('Editorial visual gate: text, photos and no overflow at '+width,async({page})=>{
    await fixedPublicEvents(page);
    await page.setViewportSize({width,height:930});
    await page.goto('/?lang=cs',{waitUntil:'domcontentloaded'});
    await expect(page.locator('html')).toHaveAttribute('data-imperion-frontdoor','ready');
    await page.evaluate(()=>document.fonts.ready);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    await expect(page.locator('#fdVisualGrid .fd-visual-tile')).toHaveCount(3);
    const photos=await page.locator('#fdVisualGrid img').evaluateAll(els=>els.map(el=>({
      src:el.getAttribute('src'),loaded:el.complete&&el.naturalWidth>0
    })));
    expect(photos.every(p=>p.loaded),JSON.stringify(photos)).toBe(true);
    const styles=await page.evaluate(()=>{
      const grab=selector=>{
        const e=document.querySelector(selector),s=getComputedStyle(e);
        return {color:s.color,fontSize:parseFloat(s.fontSize),
          backgroundColor:s.backgroundColor,text:e.textContent.trim().slice(0,70)};
      };
      return {
        paper:grab('.fd-hero').backgroundColor,
        calendar:grab('.fd-section').backgroundColor,
        title:grab('#fdHero1'),accent:grab('#fdHero2'),lead:grab('#fdLead'),
        eyebrow:grab('.fd-hero .fd-eyebrow'),
        sub:grab('#fdVisualAcademySub'),
        badge:grab('#fdVisualAcademyAction'),
        badgeBg:grab('#fdVisualAcademyAction').backgroundColor,
        calTitle:grab('#fdCalTitle'),calIntro:grab('#fdCalIntro'),
        calNote:grab('#fdCalNote')
      };
    });
    const readable=[
      ['title',styles.paper,4.5],['accent',styles.paper,4.5],
      ['lead',styles.paper,4.5],['eyebrow',styles.paper,4.5],
      ['badge',styles.badgeBg,4.5],
      ['calTitle',styles.calendar,4.5],['calIntro',styles.calendar,4.5],
      ['calNote',styles.calendar,4.5]
    ];
    for(const [key,bg,minimum] of readable){
      const ratio=contrast(styles[key].color,bg);
      expect(ratio,'Text contrast: '+key+' '+ratio.toFixed(2)+':1 '+JSON.stringify(styles[key])).toBeGreaterThanOrEqual(minimum);
    }
    expect(styles.title.fontSize).toBeGreaterThanOrEqual(36);
    expect(styles.lead.fontSize).toBeGreaterThanOrEqual(16);
    expect(styles.sub.fontSize).toBeGreaterThanOrEqual(14);
    expect(styles.badge.fontSize).toBeGreaterThanOrEqual(13);
    expect(styles.calNote.fontSize).toBeGreaterThanOrEqual(14);
    for(const card of await page.locator('.fd-visual-tile').all()){
      const b=await card.boundingBox();
      expect(b&&b.width).toBeGreaterThan(165);
      expect(b&&b.height).toBeGreaterThanOrEqual(width<=640?184:240);
    }
    console.log('EDITORIAL_METRICS:'+width+':'+JSON.stringify({
      heading:styles.title.fontSize,lead:styles.lead.fontSize,
      subtitle:styles.sub.fontSize,cardBadge:styles.badge.fontSize,
      contrast:readable.map(([k,b])=>[k,+contrast(styles[k].color,b).toFixed(2)])
    }));
    if(process.env.DESIGN_CAPTURE==='1'&&(width===390||width===1440)){
      const jpeg=await page.locator('.fd-hero').screenshot({type:'jpeg',quality:38,\n        path:'test-results/editorial-hero-'+width+'.jpg'});
      const b64=jpeg.toString('base64');
      const chunks=b64.match(/.{1,540}/g)||[];
      chunks.forEach((chunk,i)=>console.log('DESIGN_CAPTURE:'+width+':'+i+':'+chunk));
      console.log('DESIGN_CAPTURE_END:'+width+':'+chunks.length);
    }
  });
}
