# IMPERION Agent #5 review-only, fixed-script Windows audit.
# Only validated -AuditId is accepted. No arbitrary shell, app close, Defender change,
# registry/task edits, file deletion, external communication or privileged scan.
param([Parameter(Mandatory=$true)][string]$AuditId)
$ErrorActionPreference = 'Stop'
if ($AuditId -cnotmatch '^IMP-PC5-[A-Z0-9-]{4,64}$') { exit 2 }
function ReparseGuard([string]$Path) {
    if (Test-Path -LiteralPath $Path) {
        $entry = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
        if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'REPARSE_DENIED' }
    }
}
function SafeGet([scriptblock]$Action, $Fallback) {
    try { & $Action } catch { $Fallback }
}
try {
    $root = Join-Path $env:LOCALAPPDATA 'IMPERION\Agent5\audits'
    $parent = Split-Path -Parent $root
    ReparseGuard (Join-Path $env:LOCALAPPDATA 'IMPERION')
    ReparseGuard $parent
    ReparseGuard $root
    New-Item -ItemType Directory -Path $root -Force -ErrorAction Stop | Out-Null
    ReparseGuard $root
    $file = Join-Path $root ('audit-pc-' + $AuditId + '.json')
    ReparseGuard $file
    if (Test-Path -LiteralPath $file) { throw 'EXISTING_SNAPSHOT_REQUIRES_RECEIPT' }
    $now = Get-Date
    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
    $ramtotal = [math]::Round([double]$os.TotalVisibleMemorySize/1024,1)
    $ramfree = [math]::Round([double]$os.FreePhysicalMemory/1024,1)
    $cpu = SafeGet { @(Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average)[0].Average } 0
    $procs = @(Get-Process -ErrorAction SilentlyContinue)
    $groups = @($procs | Group-Object ProcessName | ForEach-Object {
        $sum = ($_.Group | Measure-Object WorkingSet64 -Sum).Sum
        $priv = ($_.Group | Measure-Object PrivateMemorySize64 -Sum).Sum
        [pscustomobject]@{name=$_.Name;count=$_.Count;working_set_mb=[math]::Round($sum/1MB,1);private_mb=[math]::Round($priv/1MB,1)}
    } | Sort-Object working_set_mb -Descending | Select-Object -First 50)
    $chromeGroup = @($groups | Where-Object {$_.name -eq 'chrome'} | Select-Object -First 1)
    $chromeMB = if ($chromeGroup.Count) { [double]$chromeGroup[0].working_set_mb } else { 0 }
    $chromeCount = @($procs | Where-Object {$_.ProcessName -eq 'chrome'}).Count
    $pagefile = @(SafeGet { @(Get-CimInstance Win32_PageFileUsage | Select-Object AllocatedBaseSize,CurrentUsage,PeakUsage) } @())
    $disks = @(SafeGet { @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object {
        [pscustomobject]@{drive=$_.DeviceID;size_gb=[math]::Round($_.Size/1GB,1);free_gb=[math]::Round($_.FreeSpace/1GB,1)}
    }) } @())
    $physical = @(SafeGet { @(Get-PhysicalDisk | Select-Object FriendlyName,HealthStatus,OperationalStatus,MediaType) } @())
    $diskPerf = @(SafeGet { @(Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk | Where-Object {$_.Name -eq '_Total'} | Select-Object PercentDiskTime,CurrentDiskQueueLength) } @())
    $services = @(SafeGet { @(Get-CimInstance Win32_Service | Select-Object Name,State,StartMode) } @())
    $start = @(SafeGet { @(Get-CimInstance Win32_StartupCommand | Select-Object Name,Location) } @())
    $run = @()
    $runKeys = @(
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run',
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce',
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run',
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce',
        'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run'
    )
    foreach ($key in $runKeys) {
        try {
            if (-not (Test-Path -LiteralPath $key)) { continue }
            $item = Get-Item -LiteralPath $key -ErrorAction Stop
            foreach ($n in $item.GetValueNames()) {
                # Never store Run command values: they may contain passwords/tokens.
                $run += [pscustomobject]@{key=$key;name=$n}
            }
        } catch { $run += [pscustomobject]@{key=$key;status='UNAVAILABLE'} }
    }
    $startFolders = @()
    foreach ($base in @([Environment]::GetFolderPath('Startup'), [Environment]::GetFolderPath('CommonStartup'))) {
        if ($base -and (Test-Path -LiteralPath $base)) {
            $startFolders += @(Get-ChildItem -LiteralPath $base -Force -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name)
        }
    }
    $tasks = @(SafeGet { @(Get-ScheduledTask | ForEach-Object {
        # Do not copy private scheduled task commands, args, URLs or account names.
        [pscustomobject]@{name=$_.TaskName;task_path=$_.TaskPath;state=[string]$_.State}
    }) } @())
    $defender = @{status='UNAVAILABLE';realtime=$null;detections_count=$null}
    try {
        $m = Get-MpComputerStatus -ErrorAction Stop
        $defender = @{status='AVAILABLE';enabled=$m.AntivirusEnabled;realtime=$m.RealTimeProtectionEnabled;tamper=$m.IsTamperProtected;
            signature_updated=[string]$m.AntivirusSignatureLastUpdated;engine=$m.AMEngineVersion;detections_count=$null}
        try { $detections = @(Get-MpThreatDetection -ErrorAction Stop | Select-Object -First 30 ThreatID,InitialDetectionTime,ActionSuccess)
              $defender.detections_count = $detections.Count
              $defender['recent_detections'] = $detections
        } catch { $defender['detections_status']='UNAVAILABLE' }
    } catch { $defender['error_code']='DEFENDER_QUERY_UNAVAILABLE' }
    $events = @{}
    foreach ($log in @('System','Application')) {
        try {
            $bad = @(Get-WinEvent -FilterHashtable @{LogName=$log;Level=2,3;StartTime=$now.AddHours(-24)} -MaxEvents 250 -ErrorAction Stop)
            $events[$log] = @{sampled=$bad.Count;frequent_ids=@($bad | Group-Object Id | Sort-Object Count -Descending | Select-Object -First 10 Name,Count)}
        } catch { $events[$log]=@{status='UNAVAILABLE'} }
    }
    $candidates = @()
    $seen = @{}
    foreach ($p in ($procs | Sort-Object WorkingSet64 -Descending | Select-Object -First 50)) {
        try { $exe = [string]$p.Path } catch { $exe='' }
        if (-not $exe -or $seen.ContainsKey($exe)) { continue }
        $seen[$exe] = 1
        $reasons = @()
        if ($exe.StartsWith($env:TEMP,[StringComparison]::OrdinalIgnoreCase)) { $reasons += 'EXECUTABLE_IN_USER_TEMP' }
        $sig = 'UNAVAILABLE'
        $publisher = $null
        try { $auth = Get-AuthenticodeSignature -LiteralPath $exe -ErrorAction Stop
            $sig = [string]$auth.Status
            if ($auth.SignerCertificate) { $publisher = $auth.SignerCertificate.Subject -replace ',.*$','' }
        } catch {}
        $level = if ($reasons.Count -gt 0 -and $sig -ne 'Valid') { 'SUSPICIOUS_NEEDS_REVIEW' } elseif ($sig -eq 'Valid') { 'LIKELY_LEGITIMATE' } else { 'INSUFFICIENT_INFORMATION' }
        $candidates += [pscustomobject]@{process=$p.ProcessName;executable=$exe;signature=$sig;publisher=$publisher;observations=$reasons;classification=$level}
    }
    $suspects = @($candidates | Where-Object {$_.classification -eq 'SUSPICIOUS_NEEDS_REVIEW'}).Count
    $summary = [ordered]@{
        ram_total_mb=$ramtotal;ram_available_mb=$ramfree;cpu_load_pct=[math]::Round([double]$cpu,1);
        chrome_process_count=$chromeCount;chrome_working_set_mb=$chromeMB;
        startup_count=$start.Count;scheduled_task_count=$tasks.Count;
        suspicious_candidate_count=$suspects;disks=$disks;
        defender=@{status=$defender.status;realtime=$defender.realtime;detections_count=$defender.detections_count}
    }
    $snap = [ordered]@{schema_version='IMP-PC5-AUDIT-1';case_id='IMP-PC5-MAINT-20261110';audit_id=$AuditId;
        captured_local=$now.ToString('o');read_only=$true;summary=$summary;
        os=@{uptime_hours=[math]::Round((New-TimeSpan -Start $os.LastBootUpTime -End $now).TotalHours,2);
            pagefile=$pagefile;disk_perf=$diskPerf;physical_disks=$physical};
        process_groups=$groups;process_signature_sample=$candidates;
        services=$services;autostart=$start;registry_autostart=$run;
        startup_folder_entries=$startFolders;scheduled_tasks=$tasks;
        defender=$defender;event_counts=$events}
    $json = ConvertTo-Json -InputObject $snap -Depth 11 -Compress
    if ([Text.Encoding]::UTF8.GetByteCount($json) -gt 1048576) { throw 'AUDIT_SIZE_LIMIT' }
    $tmp = $file + '.tmp'
    ReparseGuard $tmp
    [IO.File]::WriteAllText($tmp,$json,[Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $tmp -Destination $file -ErrorAction Stop
    $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    @{status='LOCAL_AUDIT_SAVED';file_name=[IO.Path]::GetFileName($file);sha256=$hash} | ConvertTo-Json -Compress
    exit 0
} catch {
    # Do not print paths, private events, Defender diagnostic details or exceptions.
    @{status='BLOCKED';reason='LOCAL_AUDIT_FAILED'} | ConvertTo-Json -Compress
    exit 2
}