param([switch]$Restart)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$logDir = Join-Path $root "logs"
$pidFile = Join-Path $logDir "backend.pid"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

if ($Restart -and (Test-Path $pidFile)) {
    $backendPid = [int](Get-Content $pidFile)
    Stop-Process -Id $backendPid -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

if (Test-Path $pidFile) {
    $backendPid = [int](Get-Content $pidFile)
    if (Get-Process -Id $backendPid -ErrorAction SilentlyContinue) {
        Write-Host "Backend is already running (PID $backendPid)."
        exit 0
    }
}

$process = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir "backend.log") -RedirectStandardError (Join-Path $logDir "backend.err.log") -PassThru
$process.Id | Set-Content $pidFile
Write-Host "Backend started (PID $($process.Id)). Logs are in $logDir"
