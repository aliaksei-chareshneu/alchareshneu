param([switch]$DryRun)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    throw "ShortFactory virtual environment is missing. Run INSTALL_SHORTFACTORY.cmd first."
}
$Config = Join-Path $Root "config\shortfactory_settings.local.json"
if (-not (Test-Path $Config)) {
    throw "Missing local settings file: $Config"
}
$Settings = Get-Content -LiteralPath $Config -Raw -Encoding UTF8 | ConvertFrom-Json
$Logs = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $Logs | Out-Null
$Date = Get-Date -Format "yyyy-MM-dd"
$Log = Join-Path $Logs ("daily-" + $Date + ".log")
function Run-Logged([string[]]$CommandArgs) {
    # Do not log OAuth tokens, credentials or secret JSON.
    ("[" + (Get-Date -Format o) + "] " + ($CommandArgs -join " ")) | Out-File -Append -FilePath $Log -Encoding utf8
    & $Python @CommandArgs 2>&1 | Out-File -Append -FilePath $Log -Encoding utf8
    if ($LASTEXITCODE -ne 0) {
        ("EXIT=" + $LASTEXITCODE) | Out-File -Append -FilePath $Log -Encoding utf8
        throw "ShortFactory stage failed. See $Log"
    }
}
$AutoMedia = Join-Path $Root "trend_candidates.auto.csv"
if (-not (Test-Path $AutoMedia)) {
    $Alternate = Join-Path (Split-Path -Parent $Root) "trend_candidates.auto.csv"
    if (Test-Path $Alternate) { $AutoMedia = $Alternate }
}
$IdeaArgs = @("shortfactory_idea_worker.py", "--trends", $AutoMedia, "--ideas", (Join-Path $Root "ideas"))
if ($Settings.enable_local_ollama_ideas -eq $true) { $IdeaArgs += "--ollama" }
Run-Logged $IdeaArgs
$AutopilotArgs = @("shortfactory_autopilot.py", "--root", $Root,
          "--queue", (Join-Path $Root "queue\ready"),
          "--drafts", (Join-Path (Split-Path -Parent $Root) "Drafts\ShortFactory"),
          "--state", (Join-Path $Root "state"))
if ($Settings.enable_private_upload -eq $true) {
    if (-not $Settings.channel_id -or -not $Settings.channel_id.StartsWith("UC")) {
        throw "Private uploads enabled without an explicit channel ID"
    }
    $AutopilotArgs += @("--upload-private", "--channel-id", $Settings.channel_id)
}
if ($DryRun) { $AutopilotArgs += "--dry-run" }
Run-Logged $AutopilotArgs
Write-Host "ShortFactory cycle complete. Log: $Log"
