# ONE scheduled Windows metadata-only helper; NO Telegram consumer, send or publication.
# Fails closed if reviewed source differs or private key / owner runtime is absent.
param([switch]$Apply)
$ErrorActionPreference='Stop'
$root=Join-Path $env:LOCALAPPDATA 'ImperionAgents'
$source=Join-Path $root 'agent4-crm-bridge-github-20261115\ops\imperion-agent4-supabase-sync.py'
$parent=Join-Path $env:USERPROFILE 'OneDrive - MUNI\Dokumenty\ChatGPT'
$matches=@(Get-ChildItem -LiteralPath $parent -Directory -ErrorAction Stop | Where-Object {$_.Name -like '10 Imperion*'})
if($matches.Count -ne 1){throw 'AGENT4_WORKSPACE_PATH_AMBIGUOUS'}
$agent=Join-Path $matches[0].FullName 'agent-network'
$target=Join-Path $agent 'agent4_supabase_sync.py'
$python=Join-Path $agent '.venv\Scripts\python.exe'
$token=Join-Path $root 'private\agent4_transport_token.txt'
$name='Imperion-AgentNetwork-Agent4CRMTransport'
if(!(Test-Path $source) -or !(Test-Path $python) -or !(Test-Path $token) -or
 !(Test-Path (Join-Path $agent 'agent4_crm_handoff.py'))){
 throw 'PRIVATE_AGENT4_BRIDGE_NOT_READY'}
$old=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
if($old -and $old.Actions[0].Arguments -notmatch 'agent4_supabase_sync.py'){throw 'TASK_NAME_COLLISION'}
if(Test-Path $target){
 if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne
   (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash){throw 'LOCAL_PROTECTED_SOURCE_DIFFERS'}
}
Write-Output ('LOCAL_PREFLIGHT_PASS existing='+[bool](Test-Path $target)+' task='+[bool]$old)
if(!$Apply){Write-Output 'LOCAL_DRY_RUN_NO_CHANGES';exit 0}
if(!(Test-Path $target)){Copy-Item -LiteralPath $source -Destination $target}
Push-Location -LiteralPath $agent
try{
 & $python -m py_compile $target|Out-Null
 if($LASTEXITCODE -ne 0){throw 'PYTHON_SYNTAX_FAILED'}
 $result=(& $python -c "import agent4_supabase_sync as s; x=s.transport(source_key='IMP4-TG-aaaaaaaaaaaaaaaaaaaaaaaa'); print('TOKEN_TRANSPORT_GET_'+x.get('status','INVALID'))" 2>&1|Out-String)
 if($LASTEXITCODE -ne 0 -or $result -notmatch 'TOKEN_TRANSPORT_GET_MISSING'){
  throw 'OWNER_TOKEN_PROTECTED_GET_NOT_VERIFIED'}
 Write-Output 'WINDOWS_PRIVATE_TOKEN_OWNER_GET_PASS'
 $sync=(& $python $target 2>&1|Out-String)
 if($LASTEXITCODE -ne 0){throw 'AGENT4_METADATA_ONESHOT_HELD'}
 if($sync -notmatch '"status":\s*"(IDLE_NO_PENDING|STAGED_WAIT_GAS|SYNCED)"'){
  throw 'AGENT4_METADATA_RECEIPT_NOT_VERIFIED'}
 $state=[regex]::Match($sync,'"status":\s*"([^"]+)"').Groups[1].Value
 Write-Output ('ONE_SHOT_METADATA_RESULT='+$state)
}finally{Pop-Location}
if(!$old){
 $action=New-ScheduledTaskAction -Execute $python -Argument ('"'+$target+'"') -WorkingDirectory $agent
 $trigger=New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 365)
 $settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 4) -StartWhenAvailable
 $principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
 Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal|Out-Null
}
$task=Get-ScheduledTask -TaskName $name -ErrorAction Stop
if($task.State -eq 'Disabled' -or $task.Actions[0].Arguments -notmatch 'agent4_supabase_sync.py'){
 throw 'WINDOWS_SCHEDULED_TASK_READBACK_FAIL'}
Write-Output ('WINDOWS_AGENT4_CRM_TRANSPORT_SCHEDULED task='+$name+' period=PT5M no_sender=true')
