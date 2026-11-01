'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {verify,digest,FILES,BASE}=require('../scripts/imperion-live-readback.cjs');
function fixture(){
  return Object.fromEntries(FILES.map(name=>[name,{content:'fixture for '+name+'\n',sha256:digest('fixture for '+name+'\n')}]));
}
test('every public provider byte is independently read back before PASS',async()=>{
  const expected=fixture(),requests=[];
  const got=await verify({
    expected, maxAttempts:1,waitMs:0,
    fetchImpl:async(url,opts)=>{
      requests.push({url,opts});
      const name=FILES.find(n=>url.startsWith(BASE+n+'?imperion_readback='));
      assert.ok(name);
      assert.equal(opts.method,'GET');
      assert.equal(opts.redirect,'error');
      assert.equal(opts.credentials,'omit');
      return {ok:true,redirected:false,text:async()=>expected[name].content};
    }
  });
  assert.equal(got.status,'PROVIDER_VERIFIED');
  assert.equal(got.files.length,FILES.length);
  assert.equal(requests.length,FILES.length);
  assert.equal(got.third_party_posts,0);
  assert.equal(got.charges,0);
});
test('a stale Pages file cannot be mistaken for successfully published',async()=>{
  const expected=fixture();
  await assert.rejects(verify({expected,maxAttempts:1,waitMs:0,
    fetchImpl:async(url)=>({ok:true,redirected:false,text:async()=>{
      if(url.includes('rss.xml'))return 'STALE';
      return expected[FILES.find(name=>url.includes('/'+name+'?'))].content;
    }})
  }),/PAGES_READBACK_UNVERIFIED:PROVIDER_SOURCE_MISMATCH:rss.xml/);
});
test('a network outage, 403 or redirect fails closed',async()=>{
  const expected=fixture();
  for(const fetchImpl of [
    async()=>{throw Error('OFFLINE')},
    async()=>({ok:false,status:403}),
    async()=>({ok:true,redirected:true}),
  ])await assert.rejects(verify({expected,maxAttempts:1,waitMs:0,fetchImpl}),
    /PAGES_READBACK_UNVERIFIED/);
});
test('cannot inject arbitrary URL or falsely shrink readback coverage',async()=>{
  await assert.rejects(verify({expected:{'evil.json':{content:'x',sha256:digest('x')}},
    maxAttempts:1,waitMs:0,fetchImpl:async()=>{throw Error('NO_FETCH');}}),
    /INVALID_READBACK_SOURCE/);
});
