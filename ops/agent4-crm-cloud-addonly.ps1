# IMPERION Agent4 CRM, existing bound Google Apps Script. Owner-only.
# Source-only add, independent readback, no send/publish. Defaults to dry-run.
param([switch]$Apply)
$ErrorActionPreference='Stop'
$root=Join-Path $env:LOCALAPPDATA 'ImperionAgents'
$stageParent=Join-Path $root 'clasp-private-staging'
$source=Join-Path $root 'agent4-crm-bridge-github-20261115'
$ownerCfg=Join-Path $env:USERPROFILE 'ChatGPT-Workspace\80-Digital-Platform-Automation\.clasp.json'
$target='ImperionAgent4CrmBridge.js'
New-Item -ItemType Directory -Force -Path $stageParent | Out-Null
if(Test-Path -LiteralPath (Join-Path $stageParent '.clasp.json')){throw 'PARENT_CLASP_CONFLICT'}
$env:TEMP=$stageParent
if(!(Test-Path -LiteralPath $ownerCfg)){throw 'EXISTING_HUB_BINDING_MISSING'}
$script=[string]((Get-Content -LiteralPath $ownerCfg -Raw|ConvertFrom-Json).scriptId)
if($script -notmatch '^[A-Za-z0-9_-]{30,100}$'){throw 'BAD_EXISTING_SCRIPT_ID'}
$src=Join-Path $source 'ImperionAgent4CrmBridge.gs'
if(!(Test-Path -LiteralPath $src)){throw 'MISSING_REVIEWED_GAS_SOURCE'}
function Clone([string]$path){
  New-Item -ItemType Directory -Force -Path $path|Out-Null
  Push-Location -LiteralPath $path
  try{
    $log=(& clasp clone $script 2>&1|Out-String)
    if($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath '.clasp.json')){throw 'CLASP_CLONE_FAILED'}
    $id=[string]((Get-Content -LiteralPath '.clasp.json' -Raw|ConvertFrom-Json).scriptId)
    if($id -ne $script){throw 'WRONG_BOUND_PROJECT'}
  }finally{Pop-Location}
}
function Snapshot([string]$path){
  $result=@{}
  Get-ChildItem -LiteralPath $path -File|ForEach-Object {
    if($_.Name -ne '.clasp.json'){
      $result[$_.Name]=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
    }
  }
  return $result
}
function Preserve($expected,$actual){
  foreach($k in $expected.Keys){
    if(!$actual.ContainsKey($k) -or $actual[$k] -ne $expected[$k]){
      throw ('EXISTING_CLOUD_CODE_CHANGED:'+ $k)
    }
  }
}
$stage=Join-Path $stageParent ('ag4-crm-'+[guid]::NewGuid().ToString('N').Substring(0,12))
$beforeDir=Join-Path $stage 'before'
Clone $beforeDir
$before=Snapshot $beforeDir
if($before.Count -lt 24 -or
  !(Test-Path (Join-Path $beforeDir 'OperatorConsoleServer.js')) -or
  !(Test-Path (Join-Path $beforeDir 'SocialPublisher.js'))){
  throw 'NOT_EXISTING_COMMUNITY_HUB'}
$prior=Join-Path $beforeDir $target
$already=$false
if(Test-Path $prior){
  $already=$true
  if((Get-FileHash -LiteralPath $prior -Algorithm SHA256).Hash -ne
     (Get-FileHash -LiteralPath $src -Algorithm SHA256).Hash){throw 'EXISTING_BRIDGE_DIFFERS'}
}else{
  $duplicates=Get-ChildItem -LiteralPath $beforeDir -Filter '*.js' -File |
    Select-String -List -Pattern 'function impAgent4CrmImport\(','var IMP_AG4_CRM_VERSION\s*='
  if($duplicates){throw 'BRIDGE_FUNCTION_COLLISION'}
}
Write-Output ('PREFLIGHT_EXISTING_FILES='+$before.Count+' already_present='+$already)
if(!$Apply){Write-Output 'DRY_RUN_NO_CLOUD_CHANGES';exit 0}
if(!$already){
  $ready=Join-Path $stage 'ready'
  Clone $ready
  $snap=Snapshot $ready
  Preserve $before $snap
  if($snap.Count -ne $before.Count){throw 'CLOUD_SOURCE_COUNT_CHANGED'}
  Copy-Item -LiteralPath $src -Destination (Join-Path $ready $target)
  $prePush=Join-Path $stage 'prepush'
  Clone $prePush
  $live=Snapshot $prePush
  Preserve $before $live
  if($live.Count -ne $before.Count){throw 'CLOUD_PREPUSH_MISMATCH'}
  Push-Location -LiteralPath $ready
  try{
    $out=(& clasp push 2>&1|Out-String)
    if($LASTEXITCODE -ne 0){throw 'CLASP_SOURCE_PUSH_FAILED'}
  }finally{Pop-Location}
}
$afterDir=Join-Path $stage 'after'
Clone $afterDir
$after=Snapshot $afterDir
Preserve $before $after
if(!$after.ContainsKey($target) -or
   $after[$target] -ne (Get-FileHash -LiteralPath $src -Algorithm SHA256).Hash){
  throw 'CLOUD_BRIDGE_READBACK_MISMATCH'}
if($after.Count -ne ($before.Count+[int](!$already))){throw 'CLOUD_UNEXPECTED_FILE_COUNT'}
Write-Output ('ADD_ONLY_READBACK_PASS prior='+$before.Count+' new='+[int](!$already))
function RunOwner([string]$func,[string]$argsText=''){
  Push-Location -LiteralPath $afterDir
  try{
    $args=@('run',$func)
    if($argsText){$args+=@('-p',$argsText)}
    $output=(& clasp @args 2>&1|Out-String)
    if($LASTEXITCODE -ne 0){throw ('OWNER_API_FAILED_'+$func)}
    return $output
  }finally{Pop-Location}
}
$ping=RunOwner 'impAgent4CrmPingToken'
if($ping -notmatch 'IMPAG4_PING_(DISABLED|ENABLED)_READY_V1'){
  throw 'OWNER_API_OR_CRM_GUARD_PING_FAILED'}
$key='IMP4-TG-aaaaaaaaaaaaaaaaaaaaaaaa'
foreach($controller in @('OSVC','DRUZINA_MORAVY_ZS')){
  $params=ConvertTo-Json -InputObject @($key,$controller) -Compress
  $proof=RunOwner 'impAgent4CrmVerifyToken' $params
  if($proof -notmatch ('IMPAG4_VERIFY_MISSING_'+$key+'_NONE')){
    throw ('INDEPENDENT_TAB_READBACK_FAILED_'+$controller)}
}
Write-Output 'OWNER_READONLY_CRM_PROBES_PASS_NO_DUMMY_LEADS'
if($ping -match 'IMPAG4_PING_DISABLED_READY_V1'){
  $go=ConvertTo-Json -InputObject @('GO-AG4-CRM-20261115-OWNER',$true) -Compress
  $grant=RunOwner 'impAgent4CrmEnable' $go
  if($grant -notmatch '"enabled"\s*:\s*true'){throw 'OWNER_INTERNAL_BRIDGE_FLAG_NOT_CONFIRMED'}
}
$confirmed=RunOwner 'impAgent4CrmPingToken'
if($confirmed -notmatch 'IMPAG4_PING_ENABLED_READY_V1'){throw 'BRIDGE_READBACK_NOT_ENABLED'}
$localOwner=Join-Path $root 'agent4-clasp-owner'
New-Item -ItemType Directory -Force -Path $localOwner|Out-Null
$targetConfig=Join-Path $localOwner '.clasp.json'
if(Test-Path $targetConfig){
  $stored=[string]((Get-Content -LiteralPath $targetConfig -Raw|ConvertFrom-Json).scriptId)
  if($stored -ne $script){throw 'PRIVATE_LOCAL_CLASP_BINDING_CONFLICT'}
}else{
  Copy-Item -LiteralPath (Join-Path $afterDir '.clasp.json') -Destination $targetConfig
}
Write-Output 'SOURCE_CLOUD_INSTALLED_OWNER_API_ENABLED_NO_POSTS_NO_MESSAGES'
