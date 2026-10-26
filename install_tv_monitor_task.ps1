# Registers (or removes) the "LocalFlix TV Monitor" task in Windows Task Scheduler.
#
#   Install / update :  powershell -ExecutionPolicy Bypass -File .\install_tv_monitor_task.ps1
#   Remove           :  powershell -ExecutionPolicy Bypass -File .\install_tv_monitor_task.ps1 -Remove
#
# No administrator rights needed: the task runs as YOU, only while you are signed in, hidden, and keeps running on battery.
param(
    [switch]$Remove,
    [ValidateRange(1, 60)][int]$CheckEveryMinutes = 1,   # how often Windows looks for "home + TV" (the script ends at once if not)
    [string]$TaskName = "LocalFlix TV Monitor"
)
$ErrorActionPreference = 'Stop'

if ($Remove) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Task '$TaskName' removed." -ForegroundColor Green
    return
}

$here   = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $here 'tv_monitor.py'
if (-not (Test-Path $script)) { throw "tv_monitor.py not found next to this script ($here)." }
if (-not (Test-Path (Join-Path $here 'tv_monitor.json'))) {
    Write-Warning "tv_monitor.json not found. Run  py tv_monitor.py --setup  first, otherwise the monitor will stop right away."
}

# pythonw.exe = Python without a console window
$exe = (& py -c "import sys; print(sys.executable)" | Select-Object -First 1).Trim()
$pyw = $exe -replace 'python\.exe$', 'pythonw.exe'
if (-not (Test-Path $pyw)) { throw "pythonw.exe not found next to $exe" }

$me = "$env:USERDOMAIN\$env:USERNAME"

$action = New-ScheduledTaskAction -Execute $pyw -Argument "`"$script`" --run" -WorkingDirectory $here

# Trigger 1: when you sign in.
$logon = New-ScheduledTaskTrigger -AtLogOn -User $me
# ...and then again every few minutes. The script checks "home + TV", and if either is missing it ends within a second or two,
# so the task shows "Ready" (not "Running") unless you are home AND the TV is on the Wi-Fi.
$rep = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes $CheckEveryMinutes) `
    -RepetitionDuration (New-TimeSpan -Days 3650)
$logon.Repetition = $rep.Repetition

# Trigger 2: every time Windows connects to a network (Event ID 10000, log Microsoft-Windows-NetworkProfile/Operational).
# If the monitor is already running this does nothing (see MultipleInstances below).
$class = Get-CimClass -ClassName MSFT_TaskEventTrigger -Namespace Root/Microsoft/Windows/TaskScheduler
$net = New-CimInstance -CimClass $class -ClientOnly
$net.Enabled = $true
$net.Delay = 'PT20S'
$net.Subscription = @'
<QueryList><Query Id="0" Path="Microsoft-Windows-NetworkProfile/Operational"><Select Path="Microsoft-Windows-NetworkProfile/Operational">*[System[Provider[@Name='Microsoft-Windows-NetworkProfile'] and EventID=10000]]</Select></Query></QueryList>
'@

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -Hidden

$principal = New-ScheduledTaskPrincipal -UserId $me -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($logon, $net) `
    -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host "Task '$TaskName' installed and started." -ForegroundColor Green
Write-Host "  Checks every $CheckEveryMinutes minute(s); the task shows Running only while you are home AND the TV is on the Wi-Fi."
Write-Host "  Runs: $pyw `"$script`" --run"
Write-Host "  Log : $(Join-Path $here 'tv_monitor.log')"
