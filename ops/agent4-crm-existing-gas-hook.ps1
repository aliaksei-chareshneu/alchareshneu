# Safe additive integration into EXISTING owner-private GAS RSVP import.
# No new script, OAuth scope, owner token disclosure, time trigger, bot or CRM.
# Default dry-run, -Apply preserves 24 unrelated files byte-for-byte.
param([switch]$Apply)
$ErrorActionPreference='Stop'
$base=Join-Path $env:LOCALAPPDATA 'ImperionAgents'
$source=Join-Path $base 'agent4-crm-bridge-github-20261115'
$cfgPath=Join-Path $env:USERPROFILE 'ChatGPT-Workspace\80-Digital-Platform-Automation\.clasp.json'
$stageParent=Join-Path $base 'clasp-private-staging'
New-Item -Path $stageParent -ItemType Directory -Force | Out-Null
if(Test-Path (Join-Path $stageParent '.clasp.json')){throw 'PARENT_CLASP_CONFLICT'}
$env:TEMP=$stageParent
$script=[string]((Get-Content -LiteralPath $cfgPath -Raw|ConvertFrom-Json).scriptId)
if($script -notmatch '^[A-Za-z0-9_-]{30,100}$'){throw 'OWNER_SCRIPT_ID_MISSING'}
$newModule=Join-Path $source 'ImperionAgent4CrmPull.gs'
if(!(Test-Path -LiteralPath $newModule)){throw 'MISSING_REVIEWED_PULL_SOURCE'}
$hookOld="    return {newRsvps:addedR,newEnquiries:addedE,newB2B:addedB,acked:processed,receipts:receipts,followups:followups};"
$hookNew=@"
    var agent4={status:'NOT_INSTALLED'};
    try{if(typeof impAgent4CrmPull_==='function')agent4=impAgent4CrmPull_(cfg,ss);}
    catch(ag4Error){console.log('Agent4 metadata pull HELD '+String((ag4Error&&ag4Error.message)||'error').slice(0,80));agent4={status:'HELD_SAFE'};}
    return {newRsvps:addedR,newEnquiries:addedE,newB2B:addedB,acked:processed,receipts:receipts,followups:followups,agent4:agent4};
"@
function Clone([string]$path){
 New-Item -ItemType Directory -Force -Path $path|Out-Null
 Push-Location -LiteralPath $path
 try{
  $x=(& clasp clone $script 2>&1|Out-String)
  if($LASTEXITCODE -ne 0 -or !(Test-Path '.clasp.json')){throw 'AUTHENTICATED_CLONE_FAILED'}
  $read=[string]((Get-Content '.clasp.json' -Raw|ConvertFrom-Json).scriptId)
  if($read -ne $script){throw 'WRONG_PRIVATE_SCRIPT'}
 }finally{Pop-Location}
}
function Hashes([string]$dir){
 $m=@{}
 Get-ChildItem -LiteralPath $dir -File|ForEach-Object{
  if($_.Name -ne '.clasp.json'){$m[$_.Name]=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}
 }
 return $m
}
function SameExcept($a,$b){
 foreach($k in $a.Keys){
  if($k -eq 'ImperionIntakeSync.js'){continue}
  if(!$b.ContainsKey($k) -or $b[$k] -ne $a[$k]){throw ('UNRELATED_CLOUD_FILE_CHANGED:'+ $k)}
 }
}
$stage=Join-Path $stageParent ('ag4-privatehook-'+[guid]::NewGuid().ToString('N').Substring(0,11))
$initial=Join-Path $stage 'initial'
Clone $initial
$before=Hashes $initial
if($before.Count -lt 25 -or
 !(Test-Path (Join-Path $initial 'ImperionAgent4CrmBridge.js')) -or
 !(Test-Path (Join-Path $initial 'ImperionIntakeSync.js')) -or
 !(Test-Path (Join-Path $initial 'SocialPublisher.js'))){
 throw 'EXISTING_PRIVATE_SCRIPT_MISSING_MODULES'}
$oldCloud=Get-Content -LiteralPath (Join-Path $initial 'ImperionIntakeSync.js') -Raw -Encoding UTF8
if(!$oldCloud.Contains($hookOld)){throw 'EXISTING_RSVP_HOOK_SIGNATURE_CHANGED'}
if($oldCloud.Contains('impAgent4CrmPull_(cfg,ss)')){throw 'ALREADY_HOOKED_REVIEW_REQUIRED'}
if(Test-Path (Join-Path $initial 'ImperionAgent4CrmPull.js')){throw 'PULL_MODULE_ALREADY_EXISTS'}
$collision=Get-ChildItem -LiteralPath $initial -Filter '*.js' -File|
 Select-String -List -Pattern 'function impAgent4CrmPull_\('
if($collision){throw 'PULL_GLOBAL_NAME_COLLISION'}
Write-Output ('PRECHECK_OK_EXISTING_FILES='+$before.Count+' one_existing_file_to_patch=ImperionIntakeSync')
if(!$Apply){Write-Output 'DRY_RUN_NO_CLOUD_WRITES';exit 0}
$ready=Join-Path $stage 'ready'
Clone $ready
$next=Hashes $ready
if($next.Count -ne $before.Count){throw 'CLOUD_CONCURRENT_FILE_ADDED'}
foreach($k in $before.Keys){if($next[$k] -ne $before[$k]){throw 'CLOUD_CHANGED_AFTER_PREFLIGHT'}}
$target=Join-Path $ready 'ImperionIntakeSync.js'
$sourceText=Get-Content -LiteralPath $target -Raw -Encoding UTF8
if($sourceText.Split(@($hookOld),[StringSplitOptions]::None).Length -ne 2){
 throw 'MORE_THAN_ONE_OR_NO_HOOK_ANCHOR'}
$updated=$sourceText.Replace($hookOld,$hookNew.TrimEnd())
[IO.File]::WriteAllText($target,$updated,[Text.UTF8Encoding]::new($false))
Copy-Item -LiteralPath $newModule -Destination (Join-Path $ready 'ImperionAgent4CrmPull.js')
foreach($file in @($target,(Join-Path $ready 'ImperionAgent4CrmPull.js'))){
 & node --check $file|Out-Null
 if($LASTEXITCODE -ne 0){throw 'GAS_SCRIPT_SYNTAX_FAILED'}
}
$prePush=Join-Path $stage 'prepush'
Clone $prePush
$baseline=Hashes $prePush
if($baseline.Count -ne $before.Count){throw 'CLOUD_CHANGES_DURING_STAGING'}
foreach($k in $before.Keys){if($baseline[$k] -ne $before[$k]){throw 'CONCURRENT_CHANGE_ABORT'}}
Push-Location -LiteralPath $ready
try{
 $out=(& clasp push 2>&1|Out-String)
 if($LASTEXITCODE -ne 0){throw 'GAS_HOOK_PUSH_FAILED'}
}finally{Pop-Location}
$readback=Join-Path $stage 'readback'
Clone $readback
$after=Hashes $readback
SameExcept $before $after
if($after.Count -ne $before.Count+1){throw 'POST_DEPLOY_FILE_COUNT_BAD'}
$cloudHook=Get-Content -LiteralPath (Join-Path $readback 'ImperionIntakeSync.js') -Raw -Encoding UTF8
if(!$cloudHook.Contains('impAgent4CrmPull_(cfg,ss)') -or
 $cloudHook.Contains($hookOld)){throw 'GAS_HOOK_READBACK_MISSING'}
if($after['ImperionAgent4CrmPull.js'] -ne
 (Get-FileHash -LiteralPath $newModule -Algorithm SHA256).Hash){
 throw 'NEW_PULL_MODULE_HASH_MISMATCH'}
Write-Output ('PRIVATE_GAS_HOOK_READBACK_VERIFIED original_files='+$before.Count+' unrelated_files_preserved='+($before.Count-1)+' new_pull_modules=1 existing_timers_unchanged=true')
Write-Output 'NO_OUTBOUND_MESSAGES_NO_PUBLIC_POSTS_NO_DUMMY_BUYERS'
