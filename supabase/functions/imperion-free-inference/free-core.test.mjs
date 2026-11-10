import test from "node:test";
import assert from "node:assert/strict";
import {validateInput,configuredFreeProviders,generateFreeDraft} from "./free-core.mjs";
const task={classification:"PUBLIC",task:"public_summary",prompt:"Summarize public regulations"};
test("reject private data and unapproved tasks",()=>{
  assert.throws(()=>validateInput({...task,classification:"PRIVATE"}),/CLASSIFICATION/);
  assert.throws(()=>validateInput({...task,task:"send_email"}),/TASK_NOT_ALLOWED/);
  assert.throws(()=>validateInput({...task,prompt:"x".repeat(4001)}),/PROMPT_LENGTH/);
});
test("no credential or unverified account means zero network calls",async()=>{
  let count=0;const result=await generateFreeDraft(task,{GROQ_API_KEY:"mock"},()=>{count++;throw Error()});
  assert.equal(result.status,"BLOCKED_NO_VERIFIED_FREE_PROVIDER");assert.equal(count,0);
});
test("paid OpenRouter model never selected",()=>{
  const env={OPENROUTER_API_KEY:"mock",IMPERION_OPENROUTER_FREE_VERIFIED:"1",
    OPENROUTER_FREE_MODEL:"openai/gpt-oss-120b"};
  assert.equal(configuredFreeProviders(env).length,0);
});
test("free-only OpenRouter model allowed",()=>{
  const env={OPENROUTER_API_KEY:"mock",IMPERION_OPENROUTER_FREE_VERIFIED:"1",
    OPENROUTER_FREE_MODEL:"nvidia/nemotron-3-ultra:free"};
  assert.equal(configuredFreeProviders(env)[0].model,env.OPENROUTER_FREE_MODEL);
});
test("synthetic public model response is always draft",async()=>{
  const env={GROQ_API_KEY:"mock",IMPERION_GROQ_FREE_VERIFIED:"1"};
  const result=await generateFreeDraft(task,env,async(url,opts)=>{
    assert.match(url,/groq/);
    const body=JSON.parse(opts.body);
    assert.equal(body.max_completion_tokens,2400);
    assert.equal(body.reasoning_effort,"low");
    assert.equal(body.include_reasoning,false);
    return {ok:true,json:async()=>({choices:[{finish_reason:"stop",message:{content:"Completed review draft."}}]})};
  });
  assert.equal(result.status,"DRAFT_ONLY");assert.equal(result.evidence,"UNVERIFIED_MODEL_OUTPUT");
});
test("429 stops at exhausted free quota rather than paid fallback",async()=>{
  const env={GROQ_API_KEY:"mock",IMPERION_GROQ_FREE_VERIFIED:"1"};
  const result=await generateFreeDraft(task,env,async()=>({ok:false,status:429}));
  assert.equal(result.status,"CAP_REACHED_OR_UNAVAILABLE");
  assert.equal(result.next,"QUEUE_NO_PAID_FALLBACK");
});

test("GPT-OSS 120B length-truncated result never becomes a public draft",async()=>{
  let calls=0;
  const env={GROQ_API_KEY:"mock",IMPERION_GROQ_FREE_VERIFIED:"1"};
  const result=await generateFreeDraft(task,env,async(_url,opts)=>{
    calls++;
    assert.equal(JSON.parse(opts.body).reasoning_effort,"low");
    return {ok:true,json:async()=>({choices:[{
      finish_reason:"length",message:{content:"The beginning of a draft..."}
    }]})};
  });
  assert.equal(calls,1);
  assert.equal(result.status,"CAP_REACHED_OR_UNAVAILABLE");
  assert.deepEqual(result.attempts,[{provider:"groq_free",reason:"INCOMPLETE_OUTPUT"}]);
  assert.equal(result.next,"QUEUE_NO_PAID_FALLBACK");
  assert.equal(Object.hasOwn(result,"text"),false);
});
test("provider output missing finish_reason cannot be accepted",async()=>{
  const env={GROQ_API_KEY:"mock",IMPERION_GROQ_FREE_VERIFIED:"1"};
  const result=await generateFreeDraft(task,env,async()=>({
    ok:true,json:async()=>({choices:[{message:{content:"Some arbitrary output"}}]})
  }));
  assert.equal(result.status,"CAP_REACHED_OR_UNAVAILABLE");
  assert.equal(result.attempts[0].reason,"INCOMPLETE_OUTPUT");
});
test("completed Groq output remains owner-review-only and cannot claim external actions",async()=>{
  const env={GROQ_API_KEY:"mock",IMPERION_GROQ_FREE_VERIFIED:"1"};
  const result=await generateFreeDraft({...task,task:"public_draft"},env,async()=>({
    ok:true,json:async()=>({choices:[{
      finish_reason:"stop",message:{content:"A public draft for owner review only."}
    }]})
  }));
  assert.equal(result.status,"DRAFT_ONLY");
  assert.equal(result.evidence,"UNVERIFIED_MODEL_OUTPUT");
  assert.equal(result.next,"OWNER_REVIEW");
  assert.equal(Object.hasOwn(result,"messages_sent"),false);
  assert.equal(Object.hasOwn(result,"payments_created"),false);
});
