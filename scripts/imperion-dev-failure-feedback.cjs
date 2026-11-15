'use strict';
// Filter independent no-network Docker TAP diagnostics into minimal PUBLIC test facts.
// The model never receives raw CI logs, paths, env, stack traces or secrets.
function reject(reason){throw Error(reason)}
const SENSITIVE=/(?:secret|credential|password|bearer|authorization|token|api.?key|gh[pousr]_|sk-|@|https?:|[\\/]|BEGIN|PRIVATE)/i;
function safeName(raw){
 if(typeof raw!=='string'||raw.length>110)return null;
 const name=raw.trim();
 if(name.length<3||name.length>65||!/^[A-Za-z][A-Za-z0-9_ -]{2,64}$/.test(name)||
    SENSITIVE.test(name))return null;
 return name;
}
function safeScalar(value){
 if(typeof value!=='string'||value.length>20)return null;
 if(value==='true'||value==='false')return value;
 if(!/^-?(?:0|[1-9]\d{0,5})(?:\.\d{1,4})?$/.test(value))return null;
 const number=Number(value);
 return Number.isFinite(number)&&Math.abs(number)<=100000?value:null;
}
function extractFeedback(log){
 if(typeof log!=='string'||Buffer.byteLength(log)>65536)
  reject('AUTO_TRUSTED_LOG_SIZE_REJECTED');
 const names=[];
 const diffs=[];
 const stripped=log.replace(/\x1b\[[0-9;]*m/g,'');
 for(const line of stripped.split(/\r?\n/)){
  const bad=/^\s*not ok\s+\d+\s+-\s+(.+)$/.exec(line);
  if(bad&&names.length<3){
   const value=safeName(bad[1]);
   if(value&&!names.includes(value))names.push(value);
  }
  const diff=/^\s*(-?(?:\d+(?:\.\d+)?|true|false))\s+!==\s+(-?(?:\d+(?:\.\d+)?|true|false))\s*$/.exec(line);
  if(diff&&diffs.length<2){
   const actual=safeScalar(diff[1]),expected=safeScalar(diff[2]);
   if(actual!==null&&expected!==null)diffs.push({actual,expected});
  }
 }
 const total=/# fail ([0-9]{1,2})\s*$/m.exec(stripped);
 const failCount=total?Number(total[1]):names.length;
 if(!Number.isInteger(failCount)||failCount<1||failCount>99)
  reject('AUTO_TRUSTED_LOG_NO_FAILURE_REJECTED');
 const detail={origin:'INDEPENDENT_TRUSTED_TEST',failCount,names,diffs};
 const result=JSON.stringify(detail);
 if(result.length>360)reject('AUTO_TRUSTED_LOG_FEEDBACK_TOO_LONG');
 return result;
}
module.exports={safeName,safeScalar,extractFeedback};
