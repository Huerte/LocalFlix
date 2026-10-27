# Run this in an ADMINISTRATOR PowerShell window.
# It removes the Windows block on python.exe and adds a clean allow rule.
#
# It finds the Python that "py" starts, which is the one that runs LocalFlix.
# If you use another Python, give its full path:
#   .\fix_firewall.ps1 -PythonPath "C:\Path\To\python.exe"
param(
    [string]$PythonPath
)

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "This window is not running as Administrator." -ForegroundColor Red
    Write-Host "Open PowerShell as administrator and run this file again." -ForegroundColor Red
    exit 1
}

# Ask a Python launcher for the real python.exe it starts.
function Get-PythonExe($launcher) {
    try {
        $out = & $launcher -c "import sys; print(sys.executable)" 2>$null
        if ($LASTEXITCODE -eq 0 -and $out) {
            return ([string]($out | Select-Object -First 1)).Trim()
        }
    } catch { }
    return $null
}

if (-not $PythonPath) {
    $py = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($py) { $PythonPath = Get-PythonExe $py.Source }
}
if (-not $PythonPath) {
    $python = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($python) { $PythonPath = Get-PythonExe $python.Source }
}
if (-not $PythonPath -or -not (Test-Path $PythonPath)) {
    Write-Host "I could not find Python on this laptop." -ForegroundColor Red
    Write-Host "Install Python (see the setup guide), open a new administrator PowerShell, and try again." -ForegroundColor Red
    Write-Host "If Python is installed, give its full path:" -ForegroundColor Red
    Write-Host '  .\fix_firewall.ps1 -PythonPath "C:\Path\To\python.exe"' -ForegroundColor Red
    exit 1
}

Write-Host "Using Python: $PythonPath"

# Step 1 - Remove existing python.exe BLOCK rules
Get-NetFirewallRule -Action Block -Enabled True -Direction Inbound | ForEach-Object {
    $app = $_ | Get-NetFirewallApplicationFilter
    if ($app.Program -like "*python*") {
        Write-Host "Removing block rule: $($_.DisplayName)" -ForegroundColor Yellow
        $_ | Remove-NetFirewallRule
    }
}

# Step 2 - Remove an older LocalFlix allow rule (so running this twice does not make doubles), then add a clean one
Get-NetFirewallRule -DisplayName "LocalFlix Python Allow" -ErrorAction SilentlyContinue | Remove-NetFirewallRule

New-NetFirewallRule `
    -DisplayName  "LocalFlix Python Allow" `
    -Direction    Inbound `
    -Program      $PythonPath `
    -Action       Allow `
    -Profile      Any `
    -Protocol     TCP | Out-Null

Write-Host ""
Write-Host "Done. Restart localflix.py and try from your phone again." -ForegroundColor Green
