# Existing Windows Agent4: install ONE metadata-only CRM sync helper.
# No Telegram polling, WhatsApp outbound, clients contacted, or fresh CRM.
param([switch]$Apply)
$ErrorActionPreference='Stop'
$root=Join-Path $env:LOCALAPPDATA 'ImperionAgents'
$source=Join-Path $root 'agent4-crm-bridge-github-20261115\ops\imperion-agent4-crm-sync.py'
$agent=Join-Path $env:USERPROFILE 'OneDrive - MUNI\Dokumenty\ChatGPT\10 Imperion — Business & Career\agent-network'
$owner=Join-Path $root 'agent4-clasp-owner\.clasp.json'
$dest=Join-Path $agent 'agent4_crm_sync.py'
$python=Join-Path $agent '.venv\Scripts\python.exe'
$name='Imperion-AgentNetwork-Agent4CRMBridge'
if(!(Test-Path -LiteralPath $source) -or !(Test-Path -LiteralPath $owner) -or
   !(Test-Path -LiteralPath $python) -or !(Test-Path -LiteralPath (Join-Path $agent 'agent4_crm_handoff.py'))){
  throw 'EXISTING_BRIDGE_OR_LOCAL_AGENT_MISSING'}
$srcHash=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
if(Test-Path $dest){
  if((Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash -ne $srcHash){
    throw 'OWNER_LOCAL_BRIDGE_DIFFERENT_ABORT'}
}
$task=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
if($task){
  if($task.Actions[0].Arguments -notmatch 'agent4_crm_sync.py'){throw 'SCHEDULED_TASK_COLLISION'}
}
Write-Output ('LOCAL_AGENT_PREFLIGHT_OK file_present='+(Test-Path $dest)+' task_present='+[bool]$task)
if(!$Apply){Write-Output 'LOCAL_DRY_RUN_NO_CHANGES';exit 0}
if(!(Test-Path $dest)){Copy-Item -LiteralPath $source -Destination $dest}
$env:PATH=(Join-Path $env:APPDATA 'npm')+';'+$env:PATH
Push-Location -LiteralPath $agent
try{
  $syntax=(& $python -m py_compile $dest 2>&1|Out-String)
  if($LASTEXITCODE -ne 0){throw 'BRIDGE_PYTHON_SYNTAX_FAILED'}
  $ping=(& $python -c "import agent4_crm_sync as m; print(m.ClaspOwner().run('impAgent4CrmPingToken',[]))" 2>&1|Out-String)
  if($LASTEXITCODE -ne 0 -or $ping -notmatch 'IMPAG4_PING_ENABLED_READY_V1'){
    throw 'PYTHON_OWNER_OAUTH_CRM_PING_BLOCKED'}
  Write-Output 'LOCAL_PYTHON_OWNER_OAUTH_API_READBACK_PASS'
  $run=(& $python $dest 2>&1|Out-String)
  if($LASTEXITCODE -ne 0){throw 'LOCAL_BRIDGE_ONE_SHOT_HELD_CHECK_STATUS'}
  if($run -notmatch '"status"\s*:\s*"(IDLE_NO_PENDING|SYNCED)"'){
    throw 'LOCAL_BRIDGE_ONE_SHOT_RECEIPT_UNVERIFIED'}
  $s=[regex]::Match($run,'"status"\s*:\s*"([^"]+)"')
  Write-Output ('LOCAL_BRIDGE_ONESHOT_STATUS='+$s.Groups[1].Value)
}finally{Pop-Location}
if(!$task){
  $action=New-ScheduledTaskAction -Execute $python -Argument ('"'+$dest+'"') -WorkingDirectory $agent
  $trigger=New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
  $settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 4) -StartWhenAvailable
  $principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType InteractiveToken -RunLevel Limited
  Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
}
$task=Get-ScheduledTask -TaskName $name -ErrorAction Stop
if($task.State -eq 'Disabled'){throw 'CRM_BRIDGE_SCHEDULE_DISABLED'}
Write-Output ('CRM_BRIDGE_SCHEDULED_READBACK_VERIFIED task='+$name+' state='+$task.State+' interval_minutes=5')
Write-Output 'NO_CLIENT_MESSAGES_NO_SOCIAL_POSTS_NO_NEW_BOT_NO_BANK_CASH'
