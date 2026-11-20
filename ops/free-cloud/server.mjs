import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const LIMIT = 2048;
const HEADERS = { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' };
function send(res,code,body){ res.writeHead(code,HEADERS); res.end(JSON.stringify(body)); }
function countPrimes(max){ let c=0; for(let n=2;n<=max;n++){ let p=true; for(let i=2;i*i<=n;i++){if(n%i===0){p=false;break;}}if(p)c++; } return c; }
export async function handle(req,res){
  const path=new URL(req.url??'/','http://localhost').pathname;
  if(req.method==='GET' && path==='/health')return send(res,200,{status:'LIVE',application:'imperion-free-cloud-runtime-smoke',runtime:'node',version:'2026-11-08-v1',external_requests:false,persistent_storage:false});
  if(path!=='/compute'||req.method!=='POST')return send(res,404,{status:'NOT_FOUND'});
  if(Number(req.headers['content-length']??0)>LIMIT)return send(res,413,{status:'PAYLOAD_TOO_LARGE'});
  let raw='';
  try{for await(const chunk of req){raw+=chunk.toString('utf8');if(Buffer.byteLength(raw)>LIMIT)return send(res,413,{status:'PAYLOAD_TOO_LARGE'});}}catch{return send(res,400,{status:'INVALID_BODY'});}
  let body;try{body=JSON.parse(raw);}catch{return send(res,400,{status:'INVALID_JSON'});}
  if(body&&body.op==='primes'&&Number.isInteger(body.n)&&body.n>=2&&body.n<=5000){
    const t=performance.now();return send(res,200,{status:'EXECUTED',op:'primes',n:body.n,prime_count:countPrimes(body.n),elapsed_ms:Number((performance.now()-t).toFixed(3)),external_requests:false});
  }
  if(body&&body.op==='sha256'&&typeof body.text==='string'&&body.text.length<=1024){
    const buf=Buffer.from(body.text,'utf8');return send(res,200,{status:'EXECUTED',op:'sha256',byte_length:buf.length,sha256:createHash('sha256').update(buf).digest('hex'),external_requests:false});
  }
  return send(res,400,{status:'OP_NOT_ALLOWED'});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const port=Number(process.env.PORT||8080);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('INVALID_PORT');
  createServer(handle).listen(port,'0.0.0.0',()=>console.log(JSON.stringify({status:'LISTENING',port})));
}
