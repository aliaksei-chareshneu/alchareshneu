# Offline-only, read-only workstation preflight. Does not authenticate or install software.
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
$code = Get-Command 'code' -ErrorAction SilentlyContinue
if ($null -ne $code) {
    try {
        $extensions = @( & code --list-extensions 2>$null )
        foreach ($extension in @('GitHub.copilot','GitHub.copilot-chat')) {
            if ($extensions -contains $extension) {
                Write-Output "$extension : INSTALLED (account and entitlement NOT VERIFIED)"
            } else {
                Write-Output "$extension : NOT FOUND"
            }
        }
    } catch {
        Write-Output 'VS Code extensions : NOT VERIFIED'
    }
}
Write-Output 'Microsoft 365 Copilot / Outlook / SharePoint licensing: check authenticated tenant admin UI; NOT VERIFIED here.'
Write-Output 'No secrets, sign-ins, installations, provider actions, PR merges or deployments performed.'
