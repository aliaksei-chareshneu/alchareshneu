# Existing GAS importer private source hotfix: execute optional Agent4 metadata pull
# EARLY, because legacy receipts/followups may abort before previous end-of-hook.
# No new timer, credentials or client sends; preserves all other 25 files.
param([switch]$Apply)
$ErrorActionPreference='Stop'
$stageRoot=Join-Path $env:LOCALAPPDATA 'ImperionAgents\clasp-private-staging'
$env:TEMP=$stageRoot
$ownerCfg=Join-Path $env:USERPROFILE 'ChatGPT-Workspace\80-Digital-Platform-Automation\.clasp.json'
$sid=[string]((Get-Content -LiteralPath $ownerCfg -Raw|ConvertFrom-Json).scriptId)
if($sid -notmatch '^[A-Za-z0-9_-]{30,100}$'){throw 'BOUND_SCRIPT_MISSING'}
$oldHeader='    var cfg=impPrivateConfig_(),ss=SpreadsheetApp.openById(cfg.sheetId);'
$footer=@"
    var agent4={status:'NOT_INSTALLED'};
    try{if(typeof impAgent4CrmPull_==='function')agent4=impAgent4CrmPull_(cfg,ss);}
    catch(ag4Error){console.log('Agent4 metadata pull HELD '+String((ag4Error&&ag4Error.message)||'error').slice(0,80));agent4={status:'HELD_SAFE'};}
"@
$early=$footer.TrimEnd()
function CloneExact([string]$dir){
 New-Item -ItemType Directory -Force -Path $dir|Out-Null
 Push-Location -LiteralPath $dir
 try{
  $msg=(& clasp clone $sid 2>&1|Out-String)
  if($LASTEXITCODE -ne 0 -or !(Test-Path '.clasp.json')){throw 'EXISTING_GAS_CLONE_FAILED'}
  $read=(Get-Content '.clasp.json' -Raw|ConvertFrom-Json).scriptId
  if($read -ne $sid){throw 'CLOUD_BINDING_MISMATCH'}
 }finally{Pop-Location}
}
function HashFiles([string]$d){
 $h=@{}
 Get-ChildItem -LiteralPath $d -File|ForEach-Object{
  if($_.Name -ne '.clasp.json'){$h[$_.Name]=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}
 }
 return $h
}
function CheckUnrelated($before,$after){
 if($before.Count -ne $after.Count){throw 'CLOUD_MODULE_SET_CHANGED'}
 foreach($k in $before.Keys){
  if($k -eq 'ImperionIntakeSync.js'){continue}
  if(!$after.ContainsKey($k) -or $after[$k] -ne $before[$k]){throw ('UNRELATED_GAS_FILE_CHANGED:'+ $k)}
 }
}
$root=Join-Path $stageRoot ('ag4-earlyhook-'+[guid]::NewGuid().ToString('N').Substring(0,11))
$beforeDir=Join-Path $root 'before'
CloneExact $beforeDir
$before=HashFiles $beforeDir
if($before.Count -lt 26 -or !(Test-Path (Join-Path $beforeDir 'ImperionAgent4CrmPull.js'))){
 throw 'AGENT4_PRIOR_HOOK_NOT_INSTALLED'}
$oldText=Get-Content -LiteralPath (Join-Path $beforeDir 'ImperionIntakeSync.js') -Raw -Encoding UTF8
if($oldText.Split(@($oldHeader),[StringSplitOptions]::None).Length -ne 2 -or
   !$oldText.Contains($early)){throw 'HOOK_SOURCE_CONFLICT'}
Write-Output ('EARLY_HOOK_PREFLIGHT_OK existing_files='+$before.Count)
if(!$Apply){Write-Output 'NO_CLOUD_WRITES';exit 0}
$ready=Join-Path $root 'ready'
CloneExact $ready
$stageCheck=HashFiles $ready
foreach($k in $before.Keys){if($before[$k] -ne $stageCheck[$k]){throw 'CLOUD_SOURCE_CONCURRENT_CHANGE'}}
$path=Join-Path $ready 'ImperionIntakeSync.js'
$src=Get-Content -LiteralPath $path -Raw -Encoding UTF8
if(!$src.Contains($early)){throw 'OLD_HOOK_MOVED'}
$src=$src.Replace($early,'')
$src=$src.Replace($oldHeader,$oldHeader+[Environment]::NewLine+$early)
if($src.Split(@($early),[StringSplitOptions]::None).Length -ne 2){throw 'EARLY_HOOK_DUPLICATED'}
[IO.File]::WriteAllText($path,$src,[Text.UTF8Encoding]::new($false))
& node --check $path|Out-Null
if($LASTEXITCODE -ne 0){throw 'MODIFIED_GAS_JS_SYNTAX_INVALID'}
$prepush=Join-Path $root 'prepush'
CloneExact $prepush
$pre=HashFiles $prepush
foreach($k in $before.Keys){if($before[$k] -ne $pre[$k]){throw 'CONCURRENT_GAS_EDIT_ABORT'}}
Push-Location -LiteralPath $ready
try{
 $push=(& clasp push 2>&1|Out-String)
 if($LASTEXITCODE -ne 0){throw 'OWNER_CLOUD_PUSH_FAILED'}
}finally{Pop-Location}
$read=Join-Path $root 'readback'
CloneExact $read
$after=HashFiles $read
CheckUnrelated $before $after
$live=Get-Content -LiteralPath (Join-Path $read 'ImperionIntakeSync.js') -Raw -Encoding UTF8
if(!$live.Contains($oldHeader+[Environment]::NewLine+$early)){
 # Google normalization may change newlines; still require ordered signature
 $a=$live.IndexOf($oldHeader);$b=$live.IndexOf($early);$c=$live.IndexOf('var receipts=impSendReceiptQueue_')
 if($a -lt 0 -or $b -lt $a -or $c -le $b){throw 'EARLY_GAS_HOOK_READBACK_FAILED'}
}
if($live.Split(@($early),[StringSplitOptions]::None).Length -ne 2){
 throw 'GAS_EARLY_HOOK_COUNT_BAD'}
Write-Output ('EARLY_HOOK_CLOUD_READBACK_PASS preserved_other_files='+($before.Count-1)+' extra_timers=0')
