# Optional local translation runtime for IMPERION on the authorized Windows PC.
# Safe default: inspection ONLY; no install, download or daemon by default.
# Official upstream: https://github.com/ggml-org/llama.cpp/blob/master/docs/install.md
# Model: https://huggingface.co/tencent/Hy-MT2-1.8B-GGUF
param(
    [switch]$Install,
    [switch]$Serve,
    [switch]$Probe
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$model = 'tencent/Hy-MT2-1.8B-GGUF:Q4_K_M'
$binary = Get-Command llama -ErrorAction SilentlyContinue
Write-Output "Hy-MT2 check: llama CLI installed = $([bool]$binary)"
Write-Output "Model: $model (download occurs only on -Serve)"

if ($Install) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw 'WINGET_NOT_FOUND: Install a trusted Windows Package Manager first.'
    }
    if (-not $binary) {
        & winget install llama.cpp --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -ne 0) { throw 'LLAMA_INSTALL_FAILED' }
        # winget may modify PATH for future shells; do not guess installation paths.
        $binary = Get-Command llama -ErrorAction SilentlyContinue
        if (-not $binary) {
            Write-Output 'llama.cpp installed, but PATH not yet refreshed. Open a new terminal and run -Serve.'
        }
    } else {
        Write-Output 'Existing llama executable found; leaving version unchanged.'
    }
}

if ($Probe) {
    try {
        $models = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/v1/models' -TimeoutSec 5
        if (-not $models.data) { throw 'EMPTY_MODEL_LIST' }
        $models.data | ForEach-Object { Write-Output "Available local model: $($_.id)" }
    } catch {
        throw 'LOCAL_MODEL_SERVER_UNAVAILABLE: Start -Serve in a separate terminal and retry -Probe.'
    }
}

if ($Serve) {
    $binary = Get-Command llama -ErrorAction SilentlyContinue
    if (-not $binary) { throw 'LLAMA_NOT_FOUND: Run -Install first, then open a new terminal.' }
    Write-Output 'Starting loopback-only local translator; first start may download about 1.13 GB of model weights.'
    Write-Output 'Never pass participant, financial or internal data to models without source-rights review.'
    & llama serve -hf $model --host 127.0.0.1 --port 8000
    if ($LASTEXITCODE -ne 0) { throw 'HYMT2_SERVER_EXITED_UNSUCCESSFULLY' }
}
