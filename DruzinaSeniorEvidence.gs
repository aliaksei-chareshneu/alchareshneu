/* November rule: four independently verified paid attendances in the previous
 * Prague calendar month unlock Senior only from month M+1.
 * This pure evidence projector never mutates CRM or grants entitlements.
 */
function druseSeniorEvidence_(memberId){
  const id=String(memberId||''),sessions={},paid={};
  rows_(SHEETS.SESSIONS).forEach(s=>{
    if(s.Session_ID&&s.Start_DateTime)sessions[String(s.Session_ID)]=s;
  });
  rows_(SHEETS.PAYMENTS).forEach(p=>{
    if(String(p.Member_ID)!==id||String(p.Verification_Status)!=='VERIFIED')return;
    const amount=money_(p.Received_Amount_CZK||p.Amount_CZK);
    if(amount>0&&!/REVERS|REFUND|CHARGEBACK/i.test(String(p.Reconciliation_Note||'')))
      paid[String(p.Payment_ID)]=true;
  });
  const seen={},evidence=[];
  rows_(SHEETS.BOOKINGS).forEach(b=>{
    if(String(b.Member_ID)!==id||String(b.Status)!=='ATTENDED'||
       String(b.Attendance_Status)!=='PRESENT'||
       !(b.Attendance_Checked===true||
         String(b.Attendance_Checked).toUpperCase()==='TRUE')||
       !paid[String(b.Payment_ID)])return;
    const s=sessions[String(b.Session_ID)];
    if(!s)return;
    const key=String(b.Session_ID);
    if(seen[key])return;
    seen[key]=true;
    const end=new Date(s.End_DateTime||s.Start_DateTime);
    if(!Number.isFinite(end.getTime()))return;
    evidence.push({sessionId:key,status:'ATTENDED',verified:true,
      instructorVerified:true,attendedAt:end.toISOString()});
  });
  return evidence;
}
function druseSeniorPreviousMonth_(memberId,nowISO){
  return drubSeniorEligibility(String(nowISO||new Date().toISOString()),
    druseSeniorEvidence_(memberId));
}
