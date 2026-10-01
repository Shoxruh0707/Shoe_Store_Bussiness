$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root ".local-test\backend.pid"
if (!(Test-Path $pidFile)) { Write-Host "Phone-test backend is not running."; exit 0 }
$backendPid = [int](Get-Content $pidFile)
$process = Get-Process -Id $backendPid -ErrorAction SilentlyContinue
if ($process) { Stop-Process -Id $backendPid; $process.WaitForExit() }
Remove-Item -LiteralPath $pidFile -Force
Write-Host "Phone-test backend stopped."
