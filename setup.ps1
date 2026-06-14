param(
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$App = Join-Path $Root "apps\shoe-store"
$Backend = Join-Path $App "backend"
$AdminFrontend = Join-Path $App "frontend"
$CustomerFrontend = Join-Path $App "frontend_user"
$Python = Join-Path $Root ".venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    $Python = "python"
}

function Start-ServiceWindow {
    param(
        [string]$Title,
        [string]$Command
    )

    Start-Process powershell.exe -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-Command",
        "`$Host.UI.RawUI.WindowTitle = '$Title'; $Command"
    )
}

if (-not $SkipInstall) {
    Write-Host "Installing backend dependencies..."
    & $Python -m pip install -r (Join-Path $Backend "requirements.txt")

    if (-not (Test-Path (Join-Path $CustomerFrontend "node_modules"))) {
        Write-Host "Installing customer frontend dependencies..."
        Push-Location $CustomerFrontend
        npm install
        Pop-Location
    }
}

Write-Host "Starting Shoe Store services..."
Write-Host "Backend API:        http://127.0.0.1:5000"
Write-Host "Admin frontend:    http://127.0.0.1:3000"
Write-Host "Customer frontend: http://127.0.0.1:3001"

$BackendCommand = "Set-Location '$Backend'; `$env:API_HOST='0.0.0.0'; `$env:API_PORT='5000'; & '$Python' app.py"
$AdminCommand = "Set-Location '$App'; `$env:UI_HOST='0.0.0.0'; `$env:UI_PORT='3000'; `$env:API_URL='http://127.0.0.1:5000'; npm start"
$CustomerCommand = "Set-Location '$CustomerFrontend'; npm run dev -- --hostname 0.0.0.0 --port 3001"

Start-ServiceWindow "shoe-store backend" $BackendCommand
Start-ServiceWindow "shoe-store admin frontend" $AdminCommand
Start-ServiceWindow "shoe-store customer frontend" $CustomerCommand

Write-Host "Opened three service windows. Close those windows to stop the services."
