/* Server-validated Starter 4 allocations for a single legal OSVC seller.
 * 4 actual selected HEMA dates within 30 days = 800 CZK (+25% only if
 * newly requested within 48h of the first date). 8 = two distinct packs.
 * No 8-pack is invented; no cross-provider transfer is permitted. */
export function quoteStarter4(members,byId) {
  const chosen=members.filter(r=>r.training_requested_tier==='STARTER4');
  const prices=new Map();
  if(!chosen.length)return {prices,packCount:0};
  if(chosen.length%4!==0)return {error:'package_requires_four_dates'};
  const sorted=chosen.map(row=>({row,event:byId.get(row.event_id)}))
    .sort((a,b)=>Date.parse(a.event?.begins_at)-Date.parse(b.event?.begins_at));
  if(sorted.some(x=>!x.event||x.event.category!=='HEMA Training'||
      x.event.community!=='Družina Moravy'||
      x.event.data_controller!=='Aliaksei Chareshneu (OSVČ)'))
    return {error:'package_seller_mismatch'};
  for(let i=0;i<sorted.length;i+=4){
    const pack=sorted.slice(i,i+4);
    const first=Date.parse(pack[0].event.begins_at),last=Date.parse(pack[3].event.begins_at);
    const registered=Date.parse(pack[0].row.created_at);
    if(!Number.isFinite(first)||!Number.isFinite(last)||!Number.isFinite(registered)||
       last-first>30*24*3600000||first<=registered)
       return {error:'package_30_day_window_invalid'};
    const late=first-registered<48*3600000;
    for(const item of pack){
      const baseCzk=200,surchargeCzk=late?50:0;
      prices.set(item.row.event_id,{baseCzk,surchargeCzk,totalCzk:baseCzk+surchargeCzk,late48h:late});
    }
  }
  return {prices,packCount:sorted.length/4};
}
