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
module.exports={report};
