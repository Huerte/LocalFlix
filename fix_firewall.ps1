# Run this in an ADMINISTRATOR PowerShell window
# It removes the Windows block on python.exe and adds a clean allow rule.

# Step 1 – Remove existing python.exe BLOCK rules
Get-NetFirewallRule -Action Block -Enabled True -Direction Inbound | ForEach-Object {
    $app = $_ | Get-NetFirewallApplicationFilter
    if ($app.Program -like "*python*") {
        Write-Host "Removing block rule: $($_.DisplayName)" -ForegroundColor Yellow
        $_ | Remove-NetFirewallRule
    }
}

$pythonCommand = Get-Command py.exe -ErrorAction SilentlyContinue
$pythonPath = if ($pythonCommand) { $pythonCommand.Source } else { $null }
if (-not $pythonPath) {
    $pythonPath = "C:\users\hp\appdata\local\programs\python\python312\python.exe"
}

New-NetFirewallRule `
    -DisplayName  "LocalFlix Python Allow" `
    -Direction    Inbound `
    -Program      $pythonPath `
    -Action       Allow `
    -Profile      Any `
    -Protocol     TCP

Write-Host ""
Write-Host "Done. Restart localflix.py and try from your phone again." -ForegroundColor Green
