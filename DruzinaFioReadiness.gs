/**
 * P13 bank release prerequisites. No secret values leave private Script Properties.
 * Deliberately FALSE: proof-only submitQuotePayment() is disabled and no verified
 * Fio checkout/settlement adapter is installed in the public portal.
 * Flip only in a code-reviewed release with provider E2E and explicit owner GO.
 */
const DRUS_PAID_BANK_ADAPTER_LIVE = false;

function drusCzIbanValid_(value){
  const iban=String(value||'').replace(/\s+/g,'').toUpperCase();
  if(!/^CZ\d{22}$/.test(iban))return false;
  const shifted=iban.slice(4)+'1235'+iban.slice(2,4); // CZ = 12 35; append check digits
  let mod=0;
  for(let i=0;i<shifted.length;i++){
    const digit=Number(shifted.charAt(i));
    if(!Number.isInteger(digit))return false;
    mod=(mod*10+digit)%97;
  }
  return mod===1;
}
function drusBankConfigReady_(props){
  if(!props||typeof props.getProperty!=='function')return false;
  const read=name=>String(props.getProperty(name)||'').trim();
  const token=read('DRU_FIO_READONLY_TOKEN');
  const account=read('DRU_FIO_ACCOUNT_ID');
  const bank=read('DRU_FIO_BANK_ID');
  const iban=read('DRU_FIO_IBAN').replace(/\s+/g,'').toUpperCase();
  const signedImport=read('DRU_BOOKING_SIGNED_IMPORT_CONFIRMED')==='YES'&&
    ['OSVC','DRUZINA'].includes(read('DRU_BOOKING_BANK_PROFILE'))&&
    !!read('DRU_BOOKING_SELLER_ID')&&bank==='2010'&&
    /^[a-fA-F0-9]{64}$/.test(read('DRU_BOOKING_IMPORT_SIGNING_KEY'));
  return read('DRU_FIO_AUTOMATION_ENABLED')==='YES'&&
    read('DRU_FIO_READONLY_CONFIRMED')==='YES'&&
    read('DRU_FIO_SETTLEMENT_SELLER_CONFIRMED')==='YES'&&
    (/^[a-zA-Z0-9]{64}$/.test(token)||signedImport)&&
    /^\d{1,16}$/.test(account)&&/^\d{4}$/.test(bank)&&
    drusCzIbanValid_(iban)&&iban.slice(4,8)===bank&&
    // Czech BBAN: 6 prefix digits + 10 account digits. Preserve the prefix;
    // matching just the bank could send QR payments to a different customer.
    account.padStart(16,'0')===iban.slice(8);
}
function drusFioOwnerReadiness(){
  requireOwner_();
  const p=PropertiesService.getScriptProperties();
  const flag=k=>p.getProperty(k)==='YES';
  return {
    ok:true,mode:'OWNER_ONLY_READ_ONLY_NO_BANK_REQUESTS',
    bankAdapterLive:DRUS_PAID_BANK_ADAPTER_LIVE,
    credentialsAndMerchantGatesComplete:drusBankConfigReady_(p),
    legalSellerVerified:flag('DRU_LEGAL_SELLER_CONFIRMED'),
    tradeAuthorizationVerified:flag('DRU_TRADE_AUTHORIZATION_VERIFIED'),
    paidActivityInsuranceVerified:flag('DRU_OSVC_ACTIVITY_INSURANCE_VERIFIED'),
    actualBankE2eVerified:flag('DRU_BANK_RECONCILIATION_E2E_VERIFIED'),
    bookingAndOtpE2eVerified:flag('DRU_BOOKING_RELEASE_E2E_VERIFIED')&&
      flag('DRU_BOOKING_OTP_LIVE_VERIFIED'),
    paidCheckoutLive:false,
    next:'Keep public enquiry-only until real provider/seller/insurance/safety/OTP/settlement E2E.'
  };
}
