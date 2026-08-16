param(
  [switch]$Restart
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Logs = Join-Path $Root "logs"
$Ngrok = Join-Path $Root "tools\ngrok\ngrok.exe"

New-Item -ItemType Directory -Force -Path $Logs | Out-Null

function Stop-ProjectProcess {
  $processes = Get-CimInstance Win32_Process |
    Where-Object {
      ($_.Name -eq "node.exe" -and (
        $_.CommandLine -like "*server.js*" -or
        $_.CommandLine -like "*src/telegramBot.js*" -or
        $_.CommandLine -like "*src/telegramChannelBot.js*" -or
        $_.CommandLine -like "*run channel-bot*" -or
        $_.CommandLine -like "*--prefix*frontend*run dev*" -or
        $_.CommandLine -like "*next*dev -p 3001*" -or
        $_.CommandLine -like "*next*start-server.js*" -or
        $_.CommandLine -like "*frontend*.next*"
      )) -or
      ($_.Name -eq "ngrok.exe" -and $_.CommandLine -like "*AdminShoeStore*")
    }

  foreach ($process in $processes) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Start-LoggedProcess {
  param(
    [string]$Name,
    [string]$FilePath,
    [string[]]$ArgumentList
  )

  Start-Process `
    -FilePath $FilePath `
    -ArgumentList $ArgumentList `
    -WorkingDirectory $Root `
    -RedirectStandardOutput (Join-Path $Logs "$Name.log") `
    -RedirectStandardError (Join-Path $Logs "$Name.err.log") `
    -WindowStyle Hidden
}

if ($Restart) {
  Stop-ProjectProcess
  Start-Sleep -Seconds 2
}

Start-LoggedProcess -Name "backend" -FilePath "node" -ArgumentList @("server.js")
Start-LoggedProcess -Name "frontend" -FilePath "npm.cmd" -ArgumentList @("--prefix", "frontend", "run", "dev")
Start-LoggedProcess -Name "bot" -FilePath "npm.cmd" -ArgumentList @("run", "bot")
Start-LoggedProcess -Name "channel-bot" -FilePath "npm.cmd" -ArgumentList @("run", "channel-bot")
Start-LoggedProcess -Name "ngrok" -FilePath $Ngrok -ArgumentList @("http", "3001", "--log=stdout")

Write-Host "Started stack. Logs are in $Logs"
