/* Local, dependency-free Czech QR Platba/SPAYD descriptor.
 * Only the authenticated server may release it after confirming seller+account.
 * UUID in MSG is unique per RSVP but NOT a numeric variable symbol.
 * Neither this helper nor a customer receipt verifies settled bank funds.
 */
export function domesticIban(input) {
  if(typeof input!=='string')return null;
  const s=input.replace(/\s+/g,'').toUpperCase();
  let iban=s;
  if(!/^CZ\d{22}$/.test(s)){
    const m=s.match(/^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/);
    if(!m)return null;
    const bban=m[3]+(m[1]||'').padStart(6,'0')+m[2].padStart(10,'0');
    let rem=0;for(const digit of bban+'123500')rem=(rem*10+Number(digit))%97;
    iban='CZ'+String(98-rem).padStart(2,'0')+bban;
  }
  let rem=0;for(const digit of iban.slice(4)+'1235'+iban.slice(2,4))rem=(rem*10+Number(digit))%97;
  return rem===1?iban:null;
}
export function verifiedBankIban(account,recipient,expectedIban,expectedPayee) {
  const a=domesticIban(account),b=domesticIban(expectedIban);
  return a&&b&&a===b&&typeof recipient==='string'&&typeof expectedPayee==='string'&&
    recipient.trim()&&recipient.trim()===expectedPayee.trim()?a:null;
}
export function createTrainingSpd(iban,amountCzk,reference,vs=null,prefix='DM') {
  if(domesticIban(iban)!==iban||!Number.isSafeInteger(amountCzk)||
     amountCzk<1||amountCzk>9999999||typeof reference!=='string'||
     !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(reference)||
     (vs!==null&&!/^[1-9][0-9]{9}$/.test(String(vs)))||
     !['DM','BW'].includes(prefix))return null;
  return 'SPD*1.0*ACC:'+iban+'*AM:'+amountCzk.toFixed(2)+
    '*CC:CZK*MSG:'+prefix+' '+reference.replace(/-/g,'').toUpperCase()+
    (vs===null?'':'*X-VS:'+String(vs));
}
