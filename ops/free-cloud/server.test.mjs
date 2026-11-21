import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {handle} from './server.mjs';
test('real node HTTP execution, bounded pure functions, no side effects', async()=>{
 const server=createServer(handle);server.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;
 try{
   let r=await fetch(base+'/health');assert.equal(r.status,200);assert.equal((await r.json()).status,'LIVE');
   const call=(payload)=>fetch(base+'/compute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   r=await call({op:'primes',n:1000});assert.equal(r.status,200);assert.equal((await r.json()).prime_count,168);
   r=await call({op:'sha256',text:'abc'});assert.equal(r.status,200);assert.equal((await r.json()).sha256,'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
   r=await call({op:'primes',n:100000});assert.equal(r.status,400);
   r=await fetch(base+'/missing');assert.equal(r.status,404);
 }finally{await new Promise((yes,no)=>server.close(err=>err?no(err):yes()));}
});
