'use strict';
// Read-only evidence readiness for a proposed B2B service. No CRM access or payments.
function report(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid record');
  const present = name => typeof input[name] === 'string' && input[name].trim().length > 2;
  const missing=[];
  const steps=[
    ['BUYER', ['buyer_source','problem','authority','budget_source']],
    ['OFFER', ['scope','deliverable','acceptance','price_source','payment_terms','cancellation_terms']],
    ['ORDER', ['written_order_source']],
    ['INVOICE', ['invoice_source']],
    ['BANK', ['bank_readback_source','payee_confirmation']]
  ];
  if (input.entity !== 'OSVC' || input.sports_training === true) return {
    state:'HOLD',reason:'LEGAL_SELLER_OR_LICENSE_REVIEW',verified_cash:false,verified_order:false
  };
  let stage='LEAD';
  for(const [name, fields] of steps) {
    const gaps=fields.filter(f=>!present(f));
    if(gaps.length){ missing.push(...gaps);break; }
    stage=name;
  }
  return {
    state:'NEEDS_INDEPENDENT_READBACK',
    recorded_stage:stage,
    next_missing_evidence:missing,
    verified_cash:false,
    verified_order:false,
    estimated_revenue_czk:null,
    source:'UNVERIFIED_OPERATOR_INPUT',
    no_data_sent:true
  };
}

function economics(input) {
  const e=input && input.economics;
  const valid = e && Number.isFinite(e.quoted_czk) && e.quoted_czk > 0 &&
    Number.isFinite(e.external_cost_czk) && e.external_cost_czk >= 0 &&
    Number.isFinite(e.founder_hours) && e.founder_hours > 0 &&
    e.founder_hours <= 10000;
  if(!valid) return {net_per_founder_hour_scenario_czk:null,weighted30_scenario_czk:null};
  const net=Math.round((e.quoted_czk-e.external_cost_czk)/e.founder_hours*100)/100;
  const weighted = e.probability_source && typeof e.probability === 'number' &&
    e.probability >= 0 && e.probability <= 1 &&
    Number.isInteger(e.expected_payment_days) && e.expected_payment_days >= 0 &&
    e.expected_payment_days <= 30
      ? Math.round(e.quoted_czk*e.probability*100)/100 : null;
  return {net_per_founder_hour_scenario_czk:net,weighted30_scenario_czk:weighted};
}
function main(args=process.argv.slice(2)) {
  if(args.length===0) {
    process.stdout.write('Usage: node ops/deal-proof-gate.cjs --stdin (reads one JSON record from stdin)\\n');
    return 0;
  }
  if(args.length!==1 || args[0]!=='--stdin') return 2;
  try {
    const fs=require('node:fs');
    const data=fs.readFileSync(0,'utf8');
    if(data.length>16000) return 2;
    const input=JSON.parse(data);
    const output={...report(input),...economics(input)};
    process.stdout.write(JSON.stringify(output,null,2)+'\\n');
    return 0;
  }catch (_) {
    process.stderr.write('INVALID_INPUT; no private values echoed\\n');
    return 2;
  }
}
if(require.main===module) process.exitCode=main();
module.exports={report,economics,main};

