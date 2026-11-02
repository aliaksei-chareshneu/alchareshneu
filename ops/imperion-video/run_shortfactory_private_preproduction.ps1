# Existing ShortFactory private PRE-production runner. No publisher, no cloud API.
# Reads existing trend_candidates.auto.csv and explicitly selected IncomingApproved.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $env:USERPROFILE "miniconda3\python.exe"
if(-not (Test-Path -LiteralPath $Python)) { throw "Existing Conda Python missing" }
$LogDir=Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Log=Join-Path $LogDir ("private-preproduction-"+(Get-Date -Format "yyyy-MM-dd")+".log")
$Started=Get-Date -Format o
"[BEGIN] $Started" | Out-File -LiteralPath $Log -Encoding utf8 -Append
function RunStage([string]$Script,[string[]]$Params) {
    $File=Join-Path $Root $Script
    if(-not (Test-Path -LiteralPath $File)) { throw "ShortFactory stage missing: $Script" }
    $text = (& $Python $File @Params 2>&1 | Out-String)
    $code=$LASTEXITCODE
    ("STAGE="+$Script+"; exit="+$code+"; result="+$text.Trim()) | Out-File -LiteralPath $Log -Encoding utf8 -Append
    if($code -ne 0) { throw "ShortFactory failed safely: $Script" }
}
RunStage "shortfactory_idea_worker.py" @("--trends",(Join-Path $Root "trend_candidates.auto.csv"),"--ideas",(Join-Path $Root "ideas"))
RunStage "youtube_reference_intake.py" @("--source",(Join-Path $Root "third_party_youtube_references_20261102.csv"),"--out",(Join-Path $Root "youtube_references"))
RunStage "shortfactory_edit_suggestions.py" @("--incoming",(Join-Path $env:USERPROFILE "Documents\ImperionMedia\IncomingApproved"),"--out",(Join-Path $Root "edit_suggestions"),"--max-sources","3")
RunStage "shortfactory_private_montage.py" @("--max-sources","3","--max-clips","3")
"[END] $(Get-Date -Format o); PUBLISHED=0; PAID_CALLS=0; OWNER_REVIEW_REQUIRED=true" | Out-File -LiteralPath $Log -Encoding utf8 -Append
Write-Output "PREPRODUCTION_PASS log=$Log; posted=0"
