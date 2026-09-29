const {JSDOM}=require('jsdom');const fs=require('fs');const assert=require('node:assert/strict');
async function load(path,language){
 const html=fs.readFileSync(path,'utf8');const dom=new JSDOM(html,{url:'https://aliaksei-chareshneu.github.io/alchareshneu/'+path.replace('index.html','')+'?lang='+language,runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;
 w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.IntersectionObserver=class{observe(){}disconnect(){}unobserve(){}};w.ResizeObserver=class{observe(){}disconnect(){}};w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;w.HTMLMediaElement.prototype.play=()=>Promise.resolve();w.HTMLMediaElement.prototype.pause=()=>{};
 const errors=[];w.addEventListener('error',e=>errors.push(e.message));
 for(const script of w.document.querySelectorAll('script:not([src])')){if(script.type==='application/ld+json'){JSON.parse(script.textContent);continue;}w.eval(script.textContent);}
 w.eval(fs.readFileSync('experience.js','utf8'));await new Promise(r=>setTimeout(r,20));return {dom,w,d:w.document,errors};
}
module.exports={load};
if(require.main===module)(async()=>{let count=0;for(const path of ['index.html','academy/index.html','druzina/index.html','walkers/index.html','calendar/index.html'])for(const lang of ['en','ru','cs','uk']){
 const {dom,w,d,errors}=await load(path,lang);
 try{
 assert.equal(d.documentElement.lang,lang,path);assert.equal(d.querySelectorAll('h1').length,1,path);
 const ids=[...d.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length,path+' duplicate ids');
 const bad=[...d.querySelectorAll('main a[href^="#"]')].filter(a=>a.hash.length>1&&!d.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash);assert.deepEqual(bad,[],path+' anchors');
 assert.deepEqual(errors,[],path+' runtime errors');
 if(path.startsWith('academy')){const input=d.querySelector('#service-search');input.value='zzzzmissing';input.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('.price-cat:not([hidden])').length,0);input.value='';input.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('.price-cat:not([hidden])').length,9);assert.equal(d.querySelectorAll('.service-action').length,9);}
 if(path.startsWith('druzina')){for(const price of ['120','240','910','455','2870','1435','8235','4120'])assert.ok(d.body.textContent.replace(/[ ,]/g,'').includes(price+'Kč'));}
 const languageButton=d.querySelector('[data-lang="ru"]');languageButton.click();await new Promise(r=>setTimeout(r,10));assert.equal(d.documentElement.lang,'ru');assert.equal(d.querySelectorAll('h1').length,1);assert.deepEqual(errors,[]);
 console.log('PASS',path,lang);count++;
 }finally{dom.window.close();}
 }console.log(count+' DOM/language cases passed (no layout engine; browser checks remain required)');})().catch(e=>{console.error(e);process.exit(1)});
