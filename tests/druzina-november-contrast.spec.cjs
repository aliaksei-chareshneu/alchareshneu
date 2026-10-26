const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const languages=['cs','en','ru','uk'];
const forbidden={cs:/dobrovolný pilot hodností/i,en:/voluntary pilot|optional ranks and achievements pilot/i,ru:/добровольный пилот/i,uk:/добровільний пілот/i};

for(const lang of languages)for(const width of [360,1440]){
 test('November B/C/K wording and actual dark contrast: '+lang+' '+width,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto('/druzina/novinky/?lang='+lang+'&utm_source=chatgpt.com');
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('link[href*="brand-theme.css"]')).toHaveAttribute('href','../../brand-theme.css?v=20261026b');
  const article=page.locator('article.locale:visible');
  await expect(article).toHaveCount(1);
  await expect(article.locator('.price-amount')).toHaveCount(5);
  await expect(article.locator('.state-tag[data-state="pilot"]')).toHaveCount(1);
  await expect(article).not.toContainText(forbidden[lang]);
  const checks=await article.evaluate(el=>{
   const rgb=v=>{
    const m=v.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if(!m)throw Error('not rgb: '+v);
    return [Number(m[1]),Number(m[2]),Number(m[3])];
   };
   const luma=arr=>arr.reduce((sum,v,i)=>{
    const x=v/255,y=x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4;
    return sum+y*[0.2126,0.7152,0.0722][i];
   },0);
   const ratio=(a,b)=>{const x=[luma(rgb(a)),luma(rgb(b))].sort((q,r)=>r-q);return (x[0]+.05)/(x[1]+.05);};
   const backdrop=node=>{
    for(let x=node;x;x=x.parentElement){
     const b=getComputedStyle(x).backgroundColor;
     if(b&&b!=='transparent'&&b!=='rgba(0, 0, 0, 0)')return b;
    }
    return getComputedStyle(document.body).backgroundColor;
   };
   const tests=[
    '.fact-value','.section-intro h2','.data-table tbody td:first-child',
    '.price-amount','.state-tag[data-state="pilot"]',
    '.progress-step strong','.progress-step span:last-child',
    '.fold summary','.resource'
   ];
   const result=[];
   for(const selector of tests){
    for(const node of el.querySelectorAll(selector)){
     const color=getComputedStyle(node).color,background=backdrop(node);
     result.push({selector,color,background,ratio:ratio(color,background)});
    }
   }
   return result;
  });
  expect(checks.length).toBeGreaterThan(24);
  for(const item of checks)expect(item.ratio,lang+' '+width+' '+item.selector+': '+item.color+' on '+item.background).toBeGreaterThanOrEqual(4.5);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
 });
}
test('Three qualification lines are never confused with opt-in Senior Corps',()=>{
 const news=fs.readFileSync('druzina/novinky/index.html','utf8');
 const home=fs.readFileSync('druzina/index.html','utf8');
 const ranks=fs.readFileSync('druzina/ranks.html','utf8');
 expect(news).toContain('три взаимоисключающих кружка');
 expect(news).toContain('независимые направления оценки навыков');
 expect(news).toContain('Добровольная полезная помощь клубу');
 expect(news).toContain('Senior Flex');
 expect(news).toContain('7 ноября регулярная тренировка ОТМЕНЕНА');
 expect(news).toContain('ПОКА НЕ ОПЛАЧИВАТЬ');
 expect(news).toContain('Новые платные записи пока НЕ открыты');
 expect(home).toContain('пилот оценки квалификаций B/C/K');
 expect(home).toContain('Помощь клубу добровольна.');
 expect(ranks).toContain('Проверка квалификаций · прогресс и достижения');
 expect(ranks).toContain('Утверждённые правила v1.1 действуют.');
});
