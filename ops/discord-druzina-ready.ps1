# Project 80 Discord pilot, interactive one-time setup. No scheduler, no token storage.
# Usage: powershell -NoProfile -File ops\discord-druzina-ready.ps1 [-Mode Preflight|Inspect|Apply]
[CmdletBinding()]
param(
  [ValidateSet('Preflight','Inspect','Apply')]
  [string]$Mode = 'Preflight'
)
$ErrorActionPreference = 'Stop'
$CaseId = 'JOB-IMP-COMMUNITY-PRESENCE-20261110'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ScriptPath = Join-Path $RepoRoot 'scripts\imperion-discord-bootstrap.cjs'
$TestPath = Join-Path $RepoRoot 'tests\imperion-discord-bootstrap.test.cjs'
$ExpectedName = $null
$SecureInput = $null
$PlainToken = $null
$Bstr = [IntPtr]::Zero

function RunNode([string[]]$NodeArgs) {
  & node @NodeArgs
  if ($LASTEXITCODE -ne 0) { throw ('Node command failed with exit code ' + $LASTEXITCODE) }
}
function RequirePreflight {
  if (-not (Test-Path -LiteralPath $ScriptPath) -or -not (Test-Path -LiteralPath $TestPath)) {
    throw 'BLOCKED: package files not found. Use the tested Project 80 Discord pilot ZIP or checkout PR #262 branch.'
  }
  $Node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $Node) { throw 'BLOCKED: Node.js is not installed or not on PATH. No automatic installation.' }
  $VersionString = (& node --version).Trim()
  $Version = [int](($VersionString -replace '^v','').Split('.')[0])
  if ($Version -lt 20) { throw 'BLOCKED: Node.js 20+ is required. No automatic installation.' }
  Write-Host ('NODE ' + $VersionString + ' available; running local no-network tests.')
  RunNode @('--check',$ScriptPath)
  RunNode @('--test',$TestPath)
  Write-Host 'LOCAL_TESTS_PASS (no Discord server modified)'
  RunNode @($ScriptPath,'--plan')
  try {
    $Gateway = Invoke-RestMethod -Uri 'https://discord.com/api/v10/gateway' -Method Get -TimeoutSec 12
    if (-not $Gateway.url) { throw 'Invalid gateway readback' }
    Write-Host 'DISCORD_PUBLIC_API_REACHABLE'
  } catch {
    Write-Warning 'DISCORD_API_NOT_VERIFIED: This computer may be offline or the API unavailable. No changes made.'
  }
}
try {
  Write-Host ('IMPERION Project 80 | '+$CaseId+' | '+$Mode)
  RequirePreflight
  if ($Mode -eq 'Preflight') {
    Write-Host 'READY_OFFLINE. To inspect the actual server, rerun with -Mode Inspect. Do not paste tokens into chat.'
    exit 0
  }
  $GuildId = Read-Host 'Exact Discord Server ID (enable Developer Mode, right-click server, Copy Server ID)'
  if ($GuildId -notmatch '^\d{15,22}$') { throw 'Invalid Guild ID. No network write performed.' }
  $ExpectedName = Read-Host 'Exact server name as displayed in Discord (e.g. Druzina Moravy)'
  if (-not $ExpectedName) { throw 'Expected guild name missing.' }
  $SecureInput = Read-Host 'Official BOT TOKEN only (hidden input; not stored)' -AsSecureString
  $Bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureInput)
  $PlainToken = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr)
  if (-not $PlainToken) { throw 'Bot token missing.' }
  $env:DISCORD_GUILD_ID = $GuildId
  $env:DISCORD_EXPECTED_GUILD_NAME = $ExpectedName
  $env:DISCORD_BOT_TOKEN = $PlainToken
  $PlainToken = $null
  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr)
  $Bstr = [IntPtr]::Zero
  $SecureInput = $null
  Write-Host 'AUTHENTICATED_READ_ONLY_INSPECTION'
  RunNode @($ScriptPath,'--inspect')
  if ($Mode -eq 'Inspect') {
    Write-Host 'INSPECT_COMPLETE: No external writes performed.'
    exit 0
  }
  Write-Host 'The next command can CREATE missing roles/categories/channels on the verified Discord server.'
  Write-Host 'It will NOT publish messages, invites or events, or import members.'
  $Go = Read-Host 'To proceed type exactly: APPROVE DISCORD STRUCTURE'
  if ($Go -cne 'APPROVE DISCORD STRUCTURE') {
    throw 'OWNER_GO_ABSENT: apply cancelled, no writes performed.'
  }
  $env:IMPERION_DISCORD_WRITE_GO = $CaseId + ':APPROVED'
  RunNode @($ScriptPath,'--apply')
  Write-Host 'FINAL_READ_ONLY_SOURCE_CHECK'
  RunNode @($ScriptPath,'--inspect')
  Write-Host 'STRUCTURE_VERIFIED. Human review of Community/onboarding, age rules and invites still required.'
} catch {
  Write-Error $_.Exception.Message
  exit 1
} finally {
  if ($Bstr -ne [IntPtr]::Zero) { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr) }
  Remove-Item Env:DISCORD_BOT_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:DISCORD_GUILD_ID -ErrorAction SilentlyContinue
  Remove-Item Env:DISCORD_EXPECTED_GUILD_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:IMPERION_DISCORD_WRITE_GO -ErrorAction SilentlyContinue
  $PlainToken = $null
  $SecureInput = $null
}
