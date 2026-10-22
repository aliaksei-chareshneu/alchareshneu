# Read-only workstation preflight. No sign-in, installation, secrets or paid calls.
$ErrorActionPreference = 'Stop'
Write-Output 'AI TOOLCHAIN READ-ONLY PREFLIGHT'
$names = @('git', 'gh', 'code', 'agy', 'python', 'node')
foreach ($name in $names) {
    $entry = Get-Command $name -ErrorAction SilentlyContinue
    if ($null -ne $entry) {
        Write-Output "$name : AVAILABLE (binary only; login, quota and licence NOT VERIFIED)"
    } else {
        Write-Output "$name : NOT FOUND"
    }
}
$agyLocal = Join-Path $env:LOCALAPPDATA 'agy\bin\agy.exe'
if (Test-Path $agyLocal) {
    Write-Output 'agy : user-scope binary exists; current shell PATH may need refreshing'
}
$code = Get-Command 'code' -ErrorAction SilentlyContinue
if ($null -ne $code) {
    try {
        $lines = @( & code --version 2>$null )
        $ver = $null
        if ($lines.Count -gt 0) {
            $parsed = $null
            if ([version]::TryParse([string]$lines[0], [ref]$parsed)) { $ver = $parsed }
        }
        Write-Output ("VS Code version : " + [string]$lines[0])
        if (($null -ne $ver) -and ($ver -ge [version]'1.116.0')) {
            Write-Output 'GitHub Copilot Chat : BUILT INTO VS CODE (login, entitlement, quota NOT VERIFIED)'
        } else {
            $extensions = @( & code --list-extensions 2>$null )
            if (@($extensions | Where-Object { $_ -ieq 'github.copilot-chat' }).Count -gt 0) {
                Write-Output 'GitHub Copilot Chat : USER EXTENSION INSTALLED (login NOT VERIFIED)'
            } else {
                Write-Output 'GitHub Copilot Chat : INSTALLATION NOT VERIFIED'
            }
        }
        $settings = Join-Path $env:APPDATA 'Code\User\settings.json'
        if (Test-Path $settings) {
            $match = [regex]::Match((Get-Content -Path $settings -Raw), '"chat.disableAIFeatures"\s*:\s*(true|false)')
            if ($match.Success) { Write-Output ('chat.disableAIFeatures : ' + $match.Groups[1].Value) }
        }
    } catch {
        Write-Output 'VS Code built-in chat : NOT VERIFIED'
    }
}
Write-Output 'Microsoft 365 Copilot / Outlook / SharePoint licences and Graph scopes: verify in authorized tenant UI, not from installed binaries.'
Write-Output 'No sign-ins, installs, paid calls, approvals, PR merges or production changes performed by this preflight.'
