# IMPERION existing agent + Social Publisher owner-only source installer, PowerShell 5+.
# Dry-run unless -Apply. NO new Google Apps Script project, web deploy, payment,
# outgoing message, data export, timer, or existing-source replacement.
param(
  [Parameter(Mandatory=$true)][string]$AuthorizedScriptId,
  [switch]$Apply
)
$ErrorActionPreference='Stop'
if($AuthorizedScriptId -notmatch '^[A-Za-z0-9_-]{30,100}$'){throw 'INVALID_SCRIPT_ID'}
$repo=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$names=@('ImperionAgentSnapshot','ImperionClosedLoopAudit','ImperionAgentRuntime','SocialPublisher','SocialPublisherAdapters','SocialPublisherCommunity','SocialPublisherManual')
foreach($n in $names){
  if(-not (Test-Path (Join-Path $repo ($n+'.gs')))){throw ('MISSING_SOURCE:'+ $n)}
}
function Normalize([string]$path){
  $text=Get-Content -LiteralPath $path -Raw -Encoding UTF8
  return $text.Replace(([string][char]13+[string][char]10),[string][char]10)
}
function CloneFresh([string]$dir,[string]$sid) {
  New-Item -Path $dir -ItemType Directory -ErrorAction Stop | Out-Null
  Push-Location $dir
  try {
    $result=(& clasp clone $sid 2>&1 | Out-String)
    if($LASTEXITCODE -ne 0 -or -not (Test-Path '.clasp.json')){
      throw ('CLASP_CLONE_FAILED:'+ $result.Substring(0,[Math]::Min(150,$result.Length)))
    }
    $cfg=Get-Content -LiteralPath '.clasp.json' -Raw -Encoding UTF8 | ConvertFrom-Json
    if($cfg.scriptId -ne $sid){throw 'SCRIPT_ID_MISMATCH'}
  }finally{Pop-Location}
}
$stage=Join-Path $env:TEMP ('imperion-ag5-install-'+[guid]::NewGuid().ToString('N').Substring(0,10))
New-Item -Path $stage -ItemType Directory -ErrorAction Stop | Out-Null
$first=Join-Path $stage 'source'
CloneFresh $first $AuthorizedScriptId
$server=Join-Path $first 'OperatorConsoleServer.js'
$revenue=Join-Path $first 'RevenuePipeline.js'
if(-not (Test-Path $server) -or -not (Test-Path $revenue)) {throw 'WRONG_PROJECT_NOT_EXISTING_COMMUNITY_HUB'}
if((Normalize $server) -notmatch 'function ocOwner_\(' -or
  (Normalize $server) -notmatch 'function ocId_\(' -or
  (Normalize $revenue) -notmatch 'SPREADSHEET_ID') {throw 'OWNER_GUARD_MISSING'}
$before=@{}
$moduleFiles=@($names|ForEach-Object {$_+'.js'})
foreach($f in @(Get-ChildItem -LiteralPath $first -File)){
  if($f.Name -eq '.clasp.json' -or $f.Name -in $moduleFiles){continue}
  $before[$f.Name]=Normalize $f.FullName
}
if($before.Count -lt 10) {throw 'EXISTING_PROJECT_TOO_SMALL_ABORT'}
$added=0
foreach($name in $names){
  $source=Join-Path $repo ($name+'.gs')
  $target=Join-Path $first ($name+'.js')
  if(Test-Path $target){
    if((Normalize $target) -ne (Normalize $source)){throw ('CLOUD_MODULE_DIFFERS_ABORT:'+ $name)}
  }else{
    Copy-Item -LiteralPath $source -Destination $target -ErrorAction Stop
    $added++
  }
}
Write-Output ('PREFLIGHT_VERIFIED existing_files='+$before.Count+' new_modules='+$added+' cloud_source_safeguarded=true')
if(-not $Apply){
  Write-Output 'DRY_RUN_DONE; no Google cloud writes; use -Apply only after review'
  exit 0
}
Push-Location $first
try{
  $result=(& clasp push 2>&1 | Out-String)
  if($LASTEXITCODE -ne 0 -or $result -match '(?i)permission denied|unauthorized|fatal error|unable to push'){
    throw ('CLASP_PUSH_FAILED:'+ $result.Substring(0,[Math]::Min(180,$result.Length)))
  }
}finally{Pop-Location}
$second=Join-Path $stage 'independent-readback'
CloneFresh $second $AuthorizedScriptId
foreach($name in $names){
  $target=Join-Path $second ($name+'.js')
  if(-not (Test-Path $target) -or (Normalize $target) -ne (Normalize (Join-Path $repo ($name+'.gs')))){
    throw ('AGENT_CLOUD_READBACK_DIFFERENT:'+ $name)
  }
}
foreach($entry in $before.GetEnumerator()){
  $target=Join-Path $second $entry.Key
  if(-not (Test-Path $target) -or (Normalize $target) -ne $entry.Value){
    throw ('ORIGINAL_CLOUD_FILE_MUTATED:'+ $entry.Key)
  }
}
Write-Output ('SOURCE_INSTALLED_READBACK_VERIFIED original_preserved='+$before.Count+' modules='+$names.Count)
Write-Output 'SOURCE ONLY: no SocialPublisher timer, credentials or owner GO enabled. Authorised owner may run existing agent and SocialPublisher manually; independently verify installed code and provider before claiming LIVE.'
