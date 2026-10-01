$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root ".local-test"
$pidFile = Join-Path $logDir "backend.pid"
$stdout = Join-Path $logDir "backend.stdout.log"
$stderr = Join-Path $logDir "backend.stderr.log"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
if (Test-Path $pidFile) {
    $existingPid = [int](Get-Content $pidFile)
    if (Get-Process -Id $existingPid -ErrorAction SilentlyContinue) {
        Write-Host "Phone-test backend is already running (PID $existingPid)."
        exit 0
    }
}

$env:HOST = "0.0.0.0"
$env:PORT = "3000"
$env:NODE_ENV = "development"
$env:PUBLIC_URL = "http://192.168.1.6:3000"
$env:API_AUTH_REQUIRED = "false"
$env:LOCAL_PHONE_TEST_MODE = "true"
$process = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
$process.Id | Set-Content $pidFile
Start-Sleep -Seconds 2
if ($process.HasExited) {
    Write-Host "Backend did not start. See $stderr"
    Get-Content $stderr
    exit 1
}
Write-Host "Read-only phone-test backend is running at http://192.168.1.6:3000 (PID $($process.Id))."
Write-Host "Logs: $stdout and $stderr"
