# Authenticated Google Drive connector to local ShortFactory: private, hash-verified import.
# The ChatGPT connector supplies base64 part files; NO third-party service or public sharing is needed.
param(
  [Parameter(Mandatory=$true)][string]$PartsDir,
  [Parameter(Mandatory=$true)][string]$FileName,
  [Parameter(Mandatory=$true)][string]$Sha256,
  [Parameter(Mandatory=$true)][long]$ExpectedBytes,
  [Parameter(Mandatory=$true)][string]$DriveId
)
$ErrorActionPreference='Stop'
if($FileName -cnotmatch '^[A-Za-z0-9._-]{1,150}\.mp4$'){throw 'Unsafe file name'}
if($DriveId -notmatch '^[A-Za-z0-9_-]{15,}$'){throw 'Invalid Drive id'}
if($Sha256 -notmatch '^[A-Fa-f0-9]{64}$'){throw 'SHA256 required'}
if($ExpectedBytes -lt 10000 -or $ExpectedBytes -gt 500000000){throw 'File size outside supported limit'}
$parts=@(Get-ChildItem -LiteralPath $PartsDir -File -Filter 'part_*.txt' | Sort-Object Name)
if($parts.Count -lt 1){throw 'No encoded parts'}
$builder=New-Object System.Text.StringBuilder
foreach($part in $parts){
  if($part.Name -cnotmatch '^part_[0-9]{3,6}\.txt$'){throw "Invalid part name"}
  $value=[System.IO.File]::ReadAllText($part.FullName).TrimStart([char]0xFEFF)
  if($value -cnotmatch '^[A-Za-z0-9+/\r\n=]+$'){throw "Invalid base64 part"}
  [void]$builder.Append($value.Trim())
}
$bytes=[Convert]::FromBase64String($builder.ToString())
if($bytes.Length -ne $ExpectedBytes){throw "Size mismatch: $($bytes.Length) != $ExpectedBytes"}
$inbox=Join-Path $env:USERPROFILE 'Documents\ImperionMedia\IncomingApproved'
New-Item -ItemType Directory -Force -Path $inbox | Out-Null
$destination=Join-Path $inbox $FileName
$sha=$Sha256.ToLowerInvariant()
$existing=Test-Path -LiteralPath $destination
if($existing){
  $found=(Get-FileHash -Algorithm SHA256 -LiteralPath $destination).Hash.ToLowerInvariant()
  if($found -ne $sha){throw 'Existing file differs: no overwrite allowed'}
  Write-Output 'IDEMPOTENT_MATCH'
}else{
  $tmp=Join-Path $PartsDir ($FileName+'.partial')
  if(Test-Path $tmp){throw 'Unresolved partial file, no overwrite'}
  [System.IO.File]::WriteAllBytes($tmp,$bytes)
  $found=(Get-FileHash -Algorithm SHA256 -LiteralPath $tmp).Hash.ToLowerInvariant()
  if($found -ne $sha){Remove-Item -LiteralPath $tmp -Force;throw 'Checksum mismatch; rejected'}
  Move-Item -LiteralPath $tmp -Destination $destination
  Write-Output 'IMPORTED_NEW'
}
$ffprobe=Get-Command ffprobe -ErrorAction Stop
$probe=ffprobe -v error -show_entries format=duration,size:stream=codec_type,width,height -of json $destination | ConvertFrom-Json
if(-not @($probe.streams | Where-Object {$_.codec_type -eq 'video'}).Count){throw 'Video probe failed'}
$prov=[ordered]@{
  source='Authenticated connected Google Drive'
  source_drive_id=$DriveId
  imported_file=$FileName
  sha256=$sha
  bytes=$ExpectedBytes
  video_duration_seconds=$probe.format.duration
  rights_status='NOT_VERIFIED'
  people_consents='NOT_VERIFIED'
  soundtrack_rights='NOT_VERIFIED'
  publish_allowed=$false
  local_processing_allowed=$true
  import_method='verified_base64_chunks_no_public_link'
  timestamp=(Get-Date).ToUniversalTime().ToString('o')
}
$prov | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath ($destination+'.provenance.json') -Encoding UTF8
Write-Output ('READBACK_OK SHA256='+$sha+' DURATION='+$probe.format.duration+' PATH='+$destination+' PUBLISH_ALLOWED=FALSE')
