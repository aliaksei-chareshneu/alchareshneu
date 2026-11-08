# IMPERION DEV Agent on-demand owner issue command poller, Windows user-level scheduling.
# Default preview. -Apply adds ONE reversible least-privilege OS task, without user credentials or paid services.
param([switch]$Apply)
$ErrorActionPreference='Stop'
$name='IMPERION-DevAgent-OwnerCommands'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$script=Join-Path $root 'owner_comment_poller.py'
if(-not (Test-Path -LiteralPath $script)){ $script=Join-Path $root '..\scripts\imperion-owner-comment-poller.py' }
if(Test-Path -LiteralPath $script){$script=(Resolve-Path -LiteralPath $script).Path}
$py=(Get-Command python -ErrorAction Stop).Source
if(-not (Test-Path -LiteralPath $script -PathType Leaf)){throw 'MISSING_EXISTING_POLLER'}
$expectedArg='"'+$script+'" --once'
$old=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
if($old){
  $act=@($old.Actions)[0]
  if($act.Execute -ine $py -or $act.Arguments -ne $expectedArg){
    throw 'SCHEDULED_TASK_NAME_COLLISION_DO_NOT_REPLACE'
  }
  Write-Output 'VERIFIED_EXISTING_SCHEDULE_KEEP_NO_DUPLICATE'
  Get-ScheduledTaskInfo -TaskName $name | Select-Object LastRunTime,LastTaskResult,NextRunTime
  exit 0
}
Write-Output ('PREVIEW_NAME='+$name)
Write-Output ('PREVIEW_EXECUTABLE='+$py)
Write-Output ('PREVIEW_SCRIPT='+$script)
Write-Output 'PREVIEW_INTERVAL_MINUTES=10'
Write-Output 'PREVIEW_RUNLEVEL=Limited, NO_UNATTENDED_PASSWORD'
Write-Output 'PREVIEW_ACTION=ONE_READONLY_GITHUB_ISSUE_FETCH_PER_TICK, owner-only commands, local synthetic QA'
if(-not $Apply){Write-Output 'PREVIEW_ONLY_NO_OS_CHANGES';exit 0}
$action=New-ScheduledTaskAction -Execute $py -Argument $expectedArg -WorkingDirectory $root
$trigger=New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 6) -MultipleInstances IgnoreNew -StartWhenAvailable -RunOnlyIfNetworkAvailable
$principal=New-ScheduledTaskPrincipal -UserId (whoami) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Existing IMPERION DEV Agent: public GitHub issue 195 owner-only ping/smoke; no token, merge, CRM, paid API.' -ErrorAction Stop | Out-Null
$created=Get-ScheduledTask -TaskName $name -ErrorAction Stop
$verified=@($created.Actions)[0]
if($verified.Execute -ine $py -or $verified.Arguments -ne $expectedArg -or $created.State -eq 'Disabled'){
  throw 'SCHEDULE_CREATED_BUT_READBACK_FAILED'
}
Write-Output ('SCHEDULED_TASK_CREATED_VERIFIED='+$name)
Write-Output ('TASK_STATE='+$created.State)
Get-ScheduledTaskInfo -TaskName $name | Select-Object LastRunTime,LastTaskResult,NextRunTime
