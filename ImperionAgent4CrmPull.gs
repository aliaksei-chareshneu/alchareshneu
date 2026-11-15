/**
 * Hook into EXISTING owner-private imperionSyncPrivateIntake() 5-min trigger.
 * Never install a second timer, change owner credentials, or create a new CRM.
 * Pulls SHA-only source receipts via the already-configured private GAS token.
 */
var IMP_AG4_TRANSPORT_URL='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-agent4-transport';
function impAgent4Transport_(key,body){
 if(typeof key!=='string'||!/^[a-f0-9]{64}$/i.test(key))throw Error('AGENT4_PRIVATE_TOKEN_MISSING');
 var opt={method:'post',headers:{Authorization:'Bearer '+key},contentType:'application/json',
   payload:JSON.stringify(body),muteHttpExceptions:true,timeoutSeconds:25};
 var resp=UrlFetchApp.fetch(IMP_AG4_TRANSPORT_URL,opt),obj;
 if(resp.getResponseCode()!==200)throw Error('AGENT4_TRANSPORT_HTTP_'+resp.getResponseCode());
 try{obj=JSON.parse(resp.getContentText())}catch(_){throw Error('AGENT4_TRANSPORT_RESPONSE_NOT_JSON')}
 if(!obj||obj.ok!==true)throw Error('AGENT4_TRANSPORT_RESPONSE_INVALID');
 return obj;
}
function impAgent4CrmPull_(cfg,ss){
 // Existing scheduled importer already holds the script-wide lock.
 if(!cfg||!cfg.key||!ss||typeof impAg4Validate_!=='function'||
    typeof impAg4Append_!=='function'||typeof impAg4Check_!=='function')
   throw Error('AGENT4_EXISTING_BRIDGE_NOT_READY');
 var props=PropertiesService.getScriptProperties();
 if(props.getProperty('IMP_AGENT4_CRM_KILL_SWITCH')==='true'||
    props.getProperty('IMP_AGENT4_PULL_DISABLED')==='true')
   return {status:'DISABLED',imported:0,acked:0,held:0};
 var batch=impAgent4Transport_(cfg.key,{action:'pull'});
 if(batch.protocol!=='imperion-agent4-transport-v1'||!Array.isArray(batch.rows)||
    batch.rows.length>10)throw Error('AGENT4_TRANSPORT_UNEXPECTED_BATCH');
 var imported=0,acked=0,held=0;
 batch.rows.forEach(function(p){
   try{
     var scope=impAg4Validate_(p);
     // No customer name, message, handle, phone, membership, fee or paid status.
     var check=impAg4Check_(ss,scope.key,scope.entity);
     var result;
     if(check.exists)result={case_id:check.case_id,state:'EXISTING_SOURCE_VERIFIED'};
     else{result=impAg4Append_(ss,scope);imported++;}
     var proof=impAg4Check_(ss,scope.key,scope.entity);
     if(!proof.exists||proof.case_id!==result.case_id)
       throw Error('AGENT4_GAS_CRM_READBACK_UNVERIFIED');
     var remote=impAgent4Transport_(cfg.key,{action:'ack',
       source_key:scope.key,legal_entity:scope.entity,case_id:result.case_id});
     if(remote.source_key!==scope.key||remote.case_id!==result.case_id||
       (remote.status!=='REMOTE_CRM_ACK_VERIFIED'&&remote.status!=='ACK_ALREADY_VERIFIED'))
       throw Error('AGENT4_TRANSPORT_ACK_UNVERIFIED');
     acked++;
   }catch(error){
     held++;
     console.log('Agent4 private CRM metadata HELD: '+String((error&&error.message)||'unknown').slice(0,100));
     // Fail-closed: unACKed transport stays pending for deduped retry next tick.
   }
 });
 return {status:held?'PARTIAL_HELD':'OK',imported:imported,acked:acked,held:held};
}
