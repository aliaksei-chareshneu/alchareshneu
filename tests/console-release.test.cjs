const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {prepare}=require('../prepare-console-bank-release.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'console-release-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const src=path.join(root,'src');fs.mkdirSync(src);fs.writeFileSync(path.join(src,'.clasp.json'),JSON.stringify({scriptId:'bound-fixture',rootDir:'.'}));fs.writeFileSync(path.join(src,'appsscript.json'),'{}');fs.writeFileSync(path.join(src,'Code.js'),'function onOpen() {}\n');return {root,src,out:path.join(root,'release')};}
test('release preserves original and includes adapters without deployment',t=>{const f=fixture(t),r=prepare(f.src,f.out,'bound-fixture');assert.equal(r.uploaded,false);assert.equal(fs.readFileSync(path.join(f.src,'Code.js'),'utf8'),'function onOpen() {}\n');assert.ok(fs.existsSync(path.join(f.out,'FioDruzinaConsole.js')));assert.equal(fs.readFileSync(path.join(f.out,'appsscript.json'),'utf8'),'{}');});
test('wrong target rejected without output',t=>{const f=fixture(t);assert.throws(()=>prepare(f.src,f.out,'wrong'),/Wrong script/);assert.equal(fs.existsSync(f.out),false);});
test('existing legacy adapter collision rejected before any output',t=>{const f=fixture(t);fs.writeFileSync(path.join(f.src,'FioBank.js'),'function fioSyncDruzinaReadOnly() {}');assert.throws(()=>prepare(f.src,f.out,'bound-fixture'),/Duplicate global declaration/);assert.equal(fs.existsSync(f.out),false);});

test('indented, inline, async, generator and escaped global functions block staging',t=>{
 for(const code of [' function fioSyncDruzinaReadOnly() {}','var harmless=1; function fioSyncDruzinaReadOnly() {}',
  'async function fioSyncDruzinaReadOnly() {}','function* fioSyncDruzinaReadOnly() {}',
  'function fioSyncDruzinaReadOnl\\u0079() {}','if(false){function fioSyncDruzinaReadOnly() {}}']){
  const f=fixture(t);fs.writeFileSync(path.join(f.src,'Legacy.js'),code);
  assert.throws(()=>prepare(f.src,f.out,'bound-fixture'),/Duplicate global declaration: fioSyncDruzinaReadOnly/);
  assert.equal(fs.existsSync(f.out),false);
 }
});

test('global aliases, destructuring and classes cannot replace installed handler declarations',t=>{
 for(const code of ['var fioSyncDruzinaReadOnly;', 'const fioSyncDruzinaReadOnly=()=>{};',
  'if(false){var fioSyncDruzinaReadOnly;}', 'let {fn:fioSyncDruzinaReadOnly}={};',
  'var [fioSyncDruzinaReadOnly]=[];', 'var [...fioSyncDruzinaReadOnly]=[];',
  'var {x:fioSyncDruzinaReadOnly=0}={};', 'class fioSyncDruzinaReadOnly {}']){
  const f=fixture(t);fs.writeFileSync(path.join(f.src,'Legacy.js'),code);
  assert.throws(()=>prepare(f.src,f.out,'bound-fixture'),/Duplicate global declaration: fioSyncDruzinaReadOnly/);
  assert.equal(fs.existsSync(f.out),false);
 }
});

test('nested helpers, strings, comments and block-local declarations are not global conflicts',t=>{
 const f=fixture(t),code=[
  '"use strict";',
  'function outer(){function fioSyncDruzinaReadOnly(){}; var ocOwner_;}',
  'const expression=function fioSyncDruzinaReadOnly(){};',
  'const arrow=()=>{function fioSyncDruzinaReadOnly(){}};',
  'const text=`\nfunction fioSyncDruzinaReadOnly(){}\n`;',
  '/*\nfunction fioSyncDruzinaReadOnly(){}\n*/',
  '// function fioSyncDruzinaReadOnly(){}',
  '{function fioSyncDruzinaReadOnly(){}; let ocOwner_;}',
  'for(let ocOwner_ of []){}',
  'class Local { method(){var ocOwner_;} static {var ocOwner_;} }'
 ].join('\n');
 fs.writeFileSync(path.join(f.src,'Legacy.js'),code);
 const result=prepare(f.src,f.out,'bound-fixture');assert.equal(result.uploaded,false);
 assert.equal(fs.readFileSync(path.join(f.out,'Legacy.js'),'utf8'),code);
 assert.equal(fs.existsSync(path.join(f.out,'console-release-acorn.cjs')),false);
});

test('duplicate retained globals fail without executing source or exposing source text',t=>{
 const f=fixture(t);fs.writeFileSync(path.join(f.src,'First.js'),'throw Error("SYNTHETIC-PRIVATE-SOURCE"); function same(){}');
 fs.writeFileSync(path.join(f.src,'Second.js'),' function same(){}');
 assert.throws(()=>prepare(f.src,f.out,'bound-fixture'),/Duplicate global declaration: same/);
 assert.equal(fs.existsSync(f.out),false);
 fs.writeFileSync(path.join(f.src,'Second.js'),'function malformed( SYNTHETIC_PRIVATE_SOURCE');
 assert.throws(()=>prepare(f.src,f.out,'bound-fixture'),err=>/Invalid Apps Script source: Second.js/.test(err.message)&&!err.message.includes('SYNTHETIC_PRIVATE_SOURCE'));
 assert.equal(fs.existsSync(f.out),false);
});


test('Windows UTF-8 BOM config preserves bytes and still enforces the exact target',t=>{
 const f=fixture(t),config='\uFEFF'+fs.readFileSync(path.join(f.src,'.clasp.json'),'utf8');
 fs.writeFileSync(path.join(f.src,'.clasp.json'),config);
 assert.throws(()=>prepare(f.src,f.out,'wrong'),/Wrong script target/);
 assert.equal(fs.existsSync(f.out),false);
 assert.equal(prepare(f.src,f.out,'bound-fixture').uploaded,false);
 assert.equal(fs.readFileSync(path.join(f.out,'.clasp.json'),'utf8'),config);
 assert.equal(fs.readFileSync(path.join(f.src,'.clasp.json'),'utf8'),config);
});
