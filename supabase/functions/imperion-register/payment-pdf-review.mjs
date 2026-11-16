/* Bounded inspection of an UNTRUSTED bank-transfer PDF.
 * Extracted text is only a review hint. This module cannot attest settlement,
 * initiate payments, authenticate bank data or confirm a booking.
 */
const MAX_INPUT=2*1024*1024;
const MAX_TEXT=256*1024;
const MAX_STREAMS=12;
const latin1=new TextDecoder('latin1');
const utf8=new TextDecoder('utf-8',{fatal:true});

function folded(s){
  return String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
}
function pdfString(bytes){
  if(bytes[0]===254&&bytes[1]===255){
    let out='';for(let i=2;i+1<bytes.length;i+=2)
      out+=String.fromCharCode((bytes[i]<<8)|bytes[i+1]);
    return out;
  }
  if(bytes[0]===255&&bytes[1]===254){
    let out='';for(let i=2;i+1<bytes.length;i+=2)
      out+=String.fromCharCode(bytes[i]|(bytes[i+1]<<8));
    return out;
  }
  try{return utf8.decode(Uint8Array.from(bytes));}
  catch{return latin1.decode(Uint8Array.from(bytes));}
}
function literal(source,at){
  const bytes=[];let depth=1,i=at+1;
  for(;i<source.length&&bytes.length<4096;i++){
    const c=source.charCodeAt(i);
    if(c===92){
      if(++i>=source.length)break;
      const next=source[i];
      if(next==='n')bytes.push(10);
      else if(next==='r')bytes.push(13);
      else if(next==='t')bytes.push(9);
      else if(next==='b')bytes.push(8);
      else if(next==='f')bytes.push(12);
      else if(next==='\n')continue;
      else if(next==='\r'){if(source[i+1]==='\n')i++;}
      else if(/[0-7]/.test(next)){
        let oct=next;for(let j=0;j<2&&/[0-7]/.test(source[i+1]||'');j++)oct+=source[++i];
        bytes.push(parseInt(oct,8)&255);
      }else bytes.push(next.charCodeAt(0)&255);
    }else if(c===40){depth++;bytes.push(c);}
    else if(c===41){if(--depth===0)return {text:pdfString(bytes),next:i+1};bytes.push(c);}
    else bytes.push(c&255);
  }
  return {text:'',next:i};
}
function visibleText(stream){
  const out=[];let used=0;
  const blocks=stream.match(/\bBT\b[\s\S]{0,90000}?\bET\b/g)||[];
  for(const block of blocks.slice(0,80)){
    for(let i=0;i<block.length&&used<MAX_TEXT;i++){
      if(block[i]==='('){
        const p=literal(block,i);
        if(p.text){out.push(p.text);used+=p.text.length;}
        i=Math.max(i,p.next-1);
      }else if(block[i]==='<'&&block[i+1]!=='<'){
        const end=block.indexOf('>',i+1);
        if(end>i&&end-i<=8193){
          const hex=block.slice(i+1,end).replace(/\s/g,'');
          if(hex.length>0&&hex.length%2===0&&/^[0-9a-f]+$/i.test(hex)){
            const bytes=[];for(let k=0;k<hex.length;k+=2)bytes.push(parseInt(hex.slice(k,k+2),16));
            const t=pdfString(bytes);out.push(t);used+=t.length;
          }
          i=end;
        }
      }
    }
  }
  return out.join(' ');
}
async function inflateBounded(data,maxBytes){
  if(typeof DecompressionStream!=='function')return null;
  let reader;
  try{
    reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
    const chunks=[];let size=0;
    while(true){
      const part=await reader.read();if(part.done)break;
      size+=part.value.byteLength;
      if(size>maxBytes){await reader.cancel().catch(()=>{});return null;}
      chunks.push(part.value);
    }
    const bytes=new Uint8Array(size);let at=0;
    for(const c of chunks){bytes.set(c,at);at+=c.length;}
    return latin1.decode(bytes);
  }catch{
    try{await reader?.cancel();}catch{/* Invalid/unsupported stream. */}
    return null;
  }
}
async function pageText(raw,bytes){
  const pieces=[];let total=0,streams=0;
  const rx=/\bstream(?:\r\n|\n|\r)/g;
  for(let m;(m=rx.exec(raw))!==null&&streams<MAX_STREAMS;){
    streams++;
    const start=rx.lastIndex;
    const end=raw.indexOf('endstream',start);
    if(end<0)break;
    const dict=raw.slice(Math.max(0,m.index-600),m.index);
    const flate=/\/FlateDecode\b/.test(dict);
    // PDF streams end with a line break BEFORE "endstream". Different
    // DecompressionStream runtimes reject trailing bytes after a zlib member.
    // Prefer a direct /Length number; never treat an indirect n 0 R as bytes.
    const lengthMatch=dict.match(/\/Length\s+(\d{1,7})(?!\s+\d+\s+R)\b/);
    const length=lengthMatch?Number(lengthMatch[1]):NaN;
    let dataEnd=Number.isSafeInteger(length)&&length>0&&start+length<=end
      ? start+length:end;
    if(dataEnd===end){
      if(bytes[dataEnd-1]===10)dataEnd--;
      if(bytes[dataEnd-1]===13)dataEnd--;
    }
    const payload=flate
      ? await inflateBounded(bytes.subarray(start,dataEnd),MAX_TEXT-total)
      : raw.slice(start,Math.min(end,start+MAX_TEXT-total));
    if(payload){
      const text=visibleText(payload);
      if(text){pieces.push(text);total+=text.length;}
    }
    rx.lastIndex=end+9;
    if(total>=MAX_TEXT)break;
  }
  return pieces.join(' ');
}
/** No OCR, remote requests, PDF script execution, bank or booking claim. */
export async function inspectPaymentPdf(bytes,quote){
  if(!(bytes instanceof Uint8Array)||bytes.length<100||bytes.length>MAX_INPUT)
    throw Error('INVALID_PDF_SIZE');
  if(!quote||!Number.isSafeInteger(quote.amountCzk)||quote.amountCzk<1||
     !/^CZ\d{22}$/.test(String(quote.iban||''))||
     !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(quote.reference||''))||
     typeof quote.recipient!=='string'||!quote.recipient.trim())
    throw Error('INVALID_APPROVED_QUOTE');
  const raw=latin1.decode(bytes);
  if(!/^%PDF-(?:1\.[0-7]|2\.0)\b/.test(raw.slice(0,12))||
     !/%%EOF(?:\s|\x00)*$/.test(raw.slice(-4096)))
    throw Error('INVALID_PDF_STRUCTURE');
  if(/\/(?:Encrypt|JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia|XFA)\b/i.test(raw))
    throw Error('UNSAFE_PDF_FEATURE');
  const text=folded(await pageText(raw,bytes));
  const compact=text.replace(/[^A-Z0-9]/g,'');
  const expectedRef=quote.reference.replace(/-/g,'').toUpperCase();
  const amount=String(quote.amountCzk);
  const seenAmount=new RegExp('(?:^|[^0-9])'+amount+'(?:[ .,]00)?(?=[^0-9]|$)').test(text);
  const flags=[];
  if(!text)flags.push('TEXT_UNAVAILABLE');
  if(!seenAmount)flags.push('AMOUNT_NOT_FOUND');
  if(!/\bCZK\b|\bKC\b/.test(text))flags.push('CURRENCY_NOT_FOUND');
  if(!compact.includes(quote.iban))flags.push('RECIPIENT_IBAN_NOT_FOUND');
  const numericVS=String(quote.variableSymbol||'');
  const vsSeen=/^[1-9][0-9]{9}$/.test(numericVS)&&
    new RegExp('(?:^|[^0-9])'+numericVS+'(?:[^0-9]|$)').test(text);
  if(!compact.includes(expectedRef)&&!vsSeen)flags.push('REFERENCE_NOT_FOUND');
  if(!text.includes(folded(quote.recipient)))flags.push('RECIPIENT_NAME_NOT_FOUND');
  return {status:flags.length===0?'MATCHED_UNVERIFIED':'NEEDS_MANUAL_REVIEW',
    flags,bankVerified:false,confirmed:false};
}