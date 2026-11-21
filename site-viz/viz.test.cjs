"use strict";
const{test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const dir=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(dir,p),"utf8");
test("club and rank page opt into local scripts without changing applications",()=>{
 const h=read("druzina/index.html"),r=read("druzina/ranks.html");
 assert.match(h,/viz\/effects\.js\?v=20261121/);assert.match(r,/viz\/effects\.js\?v=20261121/);
 assert.match(r,/viz\/ranks\.js\?v=20261121/);assert.match(r,/id="dm-rank-visualisation"/);
 assert.match(r,/dm-viz-static/);assert.match(h,/id="registration-notice"/);
 assert.match(h,/id="dm-visitor-hub"/);
});
test("chart shows only source-published categories",()=>{
 const r=read("druzina/ranks.html"),c=read("site-viz/ranks.jsx");
 for(const x of ["B","C","K"]){assert.match(r,new RegExp(x+"-VII"));assert.match(c,new RegExp('key:"'+x+'",number:7'))}
 assert.match(r,/A-10/);assert.match(c,/key:"A",number:10/);
 assert.match(c,/Not earned ranks, attendance, memberships or payments/);
});
test("bundle is local, motion optional and size bounded",()=>{
 assert.match(read("druzina/index.html"),/script-src 'self'/);
 assert.match(read("site-viz/effects.js"),/prefers-reduced-motion/);
 assert.match(read("druzina/viz.css"),/prefers-reduced-motion/);
 for(const f of ["effects.js","ranks.js"]){const n=fs.statSync(path.join(dir,"druzina/viz",f)).size;assert.ok(n>1000&&n<1500000,f+" "+n)}
});
test("deploy builds before packaging and asserts assets",()=>{
 const workflow=read(".github/workflows/pages-production.yml");
 assert.ok(workflow.indexOf("npm --prefix site-viz run build")<workflow.indexOf("Copy only public website assets"));
 assert.match(workflow,/test -s _pages\/druzina\/viz\/ranks\.js/);
});
