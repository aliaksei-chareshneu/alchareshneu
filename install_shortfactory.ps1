# One-click Windows installer for existing MoravianHost MediaMachine; no paid accounts.
param([switch]$EnableSchedule, [switch]$AutoInstallTools, [string]$DailyAt = "08:43")
$ErrorActionPreference = "Stop"
$Package = Split-Path -Parent $MyInvocation.MyCommand.Path
$MediaMachine = Join-Path $env:USERPROFILE "MoravianHost\MediaMachine"
$Candidate = Join-Path $MediaMachine "ShortFactory"
if (Test-Path (Join-Path $MediaMachine "trend_refresh_runner.py")) { $Target = $MediaMachine }
else { $Target = $Candidate }
New-Item -ItemType Directory -Force -Path $Target | Out-Null
$Backup = Join-Path $Target ("install_backups\" + (Get-Date -Format "yyyyMMdd-HHmmss"))
$Files = @(
    "shortfactory_autopilot.py","shortfactory_youtube_private.py",
    "shortfactory_idea_worker.py","shortfactory_free_one_click.py",
    "cinematic_shorts.py","shortfactory_voice_kokoro.py",
    "original_reel_builder.py","run_shortfactory_daily.ps1",
    "examples\roman_training_voice_20261025.json",
    "examples\roman_motion_free_20261025.json",
    "queue\ready\roman-training-demo.json",
    "config\shortfactory_settings.example.json",
    "requirements_shortfactory.txt"
)
$Copies=0
foreach ($Rel in $Files) {
    $Src=Join-Path $Package $Rel
    if (-not (Test-Path -LiteralPath $Src)) { throw "Missing installer component: $Src" }
    $Dst=Join-Path $Target $Rel
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Dst) | Out-Null
    if (Test-Path -LiteralPath $Dst) {
        if ((Get-FileHash -LiteralPath $Src -Algorithm SHA256).Hash -eq
            (Get-FileHash -LiteralPath $Dst -Algorithm SHA256).Hash) { continue }
        $Old=Join-Path $Backup $Rel
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Old) | Out-Null
        Copy-Item -LiteralPath $Dst -Destination $Old
    }
    Copy-Item -LiteralPath $Src -Destination $Dst -Force
    $Copies++
}
$LocalSettings=Join-Path $Target "config\shortfactory_settings.local.json"
if (-not (Test-Path -LiteralPath $LocalSettings)) {
    Copy-Item -LiteralPath (Join-Path $Package "config\shortfactory_settings.example.json") -Destination $LocalSettings
}
function Get-Python {
    $py=Get-Command py -ErrorAction SilentlyContinue
    if ($py) {
        & py -3.12 --version 2>$null
        if ($LASTEXITCODE -eq 0) { return ,@("py","-3.12") }
    }
    $candidate=Get-Command python -ErrorAction SilentlyContinue
    if ($candidate) {
        $ver=& python -c "import sys; print(sys.version_info.major, sys.version_info.minor)"
        if ($ver -match "3 (11|12)") { return ,@("python") }
    }
    return $null
}
$Python=Get-Python
if (-not $Python -and $AutoInstallTools) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "Python 3.12 missing, winget unavailable: install Python then rerun."
    }
    winget install --id Python.Python.3.12 -e --accept-package-agreements --accept-source-agreements
    $Python=Get-Python
}
if (-not $Python) { throw "Python 3.11/3.12 missing. Install Python 3.12, then rerun." }
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue) -and $AutoInstallTools) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "FFmpeg missing, winget unavailable: install FFmpeg manually."
    }
    winget install --id Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements
    $env:Path += ";" + (Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links")
}
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue) -or
    -not (Get-Command ffprobe -ErrorAction SilentlyContinue)) {
    throw "FFmpeg and ffprobe missing from PATH. Install free FFmpeg and rerun."
}
$Venv=Join-Path $Target ".venv"
if (-not (Test-Path (Join-Path $Venv "Scripts\python.exe"))) {
    $PArgs=@()
    if ($Python.Count -gt 1) { $PArgs=@($Python[1]) }
    & ($Python[0]) @PArgs -m venv $Venv
    if ($LASTEXITCODE -ne 0) { throw "Python venv creation failed" }
}
$Exe=Join-Path $Venv "Scripts\python.exe"
& $Exe -m pip install --disable-pip-version-check -r (Join-Path $Target "requirements_shortfactory.txt")
if ($LASTEXITCODE -ne 0) { throw "Python dependencies failed; correct network and rerun." }
& $Exe -m unittest discover -s (Join-Path $Package "tests") -p "test_shortfactory_autopilot.py" -v
if ($LASTEXITCODE -ne 0) { throw "Safety tests failed: no task was scheduled" }
if ($EnableSchedule) {
    $Runner=Join-Path $Target "run_shortfactory_daily.ps1"
    $Name="MoravianHost ShortFactory - daily private drafts"
    $Time=[datetime]::ParseExact($DailyAt,"HH:mm",$null)
    $Trigger=New-ScheduledTaskTrigger -Daily -At $Time
    $Action=New-ScheduledTaskAction -Execute "powershell.exe" -WorkingDirectory $Target -Argument ('-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $Runner)
    $Settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew
    $Principal=New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $Name -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Force | Out-Null
}
Write-Host "SUCCESS. ShortFactory: $Target; updated $Copies installer files."
if ($EnableSchedule) { Write-Host "Windows Task Scheduler daily: $DailyAt. New public posts remain DISABLED." }
Write-Host "YouTube OAuth NOT authorized. No public post was made."
Write-Host ('Dry-run command: powershell -NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $Target 'run_shortfactory_daily.ps1') + '" -DryRun')
Write-Host "Local settings: $LocalSettings"
