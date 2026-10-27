# Start LocalFlix by itself (Windows 11)

With this guide, you do not need to type `py localflix.py` every day. A small helper starts LocalFlix for you. It does this **only when both of these are true**:

1. your laptop is on your **home** Wi-Fi, and
2. your **Android TV / Google TV** is on that same Wi-Fi.

Away from home, nothing starts. Ever.

> **This guide is only for a Windows 11 laptop on a home Wi-Fi.** It does not work on an Android phone, and it is not made for a phone hotspot. See [Use an Android phone as the server](phone-server.md) and [Use a phone hotspot](hotspot.md).

The helper is called the **TV monitor**. It runs hidden in the background. You will not see a window.

While the TV is using LocalFlix, the monitor also stops Windows from falling asleep on its own (see section 6).

**Before you start:** finish [the setup guide](setup-guide.md) (especially Step 7, the firewall). Your TV must be on the same Wi-Fi as the laptop.

**How to run the commands:** every command below is typed in **PowerShell in the LocalFlix folder**. See [how to open it](setup-guide.md#b-open-powershell-in-the-localflix-folder).

> "The TV is connected" means the laptop can see the TV on the Wi-Fi. Some TVs stay on the Wi-Fi when they are in standby (the screen is off). So LocalFlix may start even when the TV screen is off. This is harmless (see section 6).

---

## 1. (Recommended) Give the TV an address that does not change

Your router can give the TV a new address at any time. This guide finds the TV again if that happens, but it needs an extra scan. It is better to fix the address.

1. On the laptop, open your router page in a browser (see Way A in [Step 8 of the setup guide](setup-guide.md#step-8-give-the-laptop-an-address-that-does-not-change)).
2. Find the page for reserving an address. It may be called **DHCP reservation** or **Address reservation**.
3. Reserve one address for the **TV**. You need the TV's address and its MAC address. Look for them in the TV's **Settings** (try **Network & Internet**, or **About**, then **Status**). You can also do section 2 first. Its list shows the address and the MAC address of the TV.

On the TV, turn **off** "Private MAC" or "Randomized MAC" for your home Wi-Fi, if the TV offers it. Then the address stays the same.

If you skip this section, the monitor can still find the TV.

## 2. One-time setup

Do this one time. Be **at home**, on your **home Wi-Fi**, with the **TV switched on**.

```powershell
py tv_monitor.py --setup
```

What happens:

1. It shows your Wi-Fi name and your router address.
2. It asks: `Is this your home network? [Y/n]`. Type `y` and press Enter.
3. It looks for devices on your Wi-Fi. This takes about 10 seconds.
4. It shows a list of devices with a number, an IP address and a MAC address.
5. It asks: `Type the number from the list, or the TV's IP address:`. Type the number of your TV and press Enter. If you do not know which one is the TV, look at the TV address in the TV's **Settings**, **Network & Internet**, and type that address.

When it works, it says `Saved to tv_monitor.json`.

Now check it:

```powershell
py tv_monitor.py --check
```

> **You should see:** `At home?  YES` and `TV ... FOUND`.

Then turn the TV Wi-Fi **off** and run the check again. It should now say `not found`. This proves the monitor can tell when the TV is gone.

> **Wi-Fi name shows "not readable"?** Windows 11 (version 24H2 and later) hides the Wi-Fi name unless **Settings**, **Privacy & security**, **Location**, **Location services** is on. You can leave it off. The router address is saved too, and it is enough to know you are at home.

## 3. Install the task

Windows has a part called **Task Scheduler**. It runs programs at the right time. This command adds the monitor to it. You do not need administrator mode.

```powershell
powershell -ExecutionPolicy Bypass -File .\install_tv_monitor_task.ps1
```

> **You should see:** green text `Task 'LocalFlix TV Monitor' installed and started.`

This creates the task **LocalFlix TV Monitor**. What it does:

| Setting | What it means |
|---|---|
| Runs as | You. Only when you are signed in. No administrator rights. |
| Window | Hidden. You see nothing. |
| When it starts | When you sign in. Then **every minute**. Also every time Windows connects to a network. |
| On battery | Keeps working on battery |
| Two copies | A second copy is ignored |
| Home or TV is missing | The monitor stops within a second or two. The task shows `Ready`, not `Running`. |
| Home and TV are both there | The monitor stays `Running`. It starts LocalFlix. It keeps the laptop awake (if the charger is plugged in). |
| The TV (or home) is gone for about 2 minutes | The monitor **stops the LocalFlix it started** and ends. A short Wi-Fi problem does not stop anything. If you started LocalFlix yourself, the monitor never stops it. |
| Time limit | None |

To change how often it checks, add `-CheckEveryMinutes 5` (use any number from 1 to 60) at the end of the command.

**Remove it any time:**

```powershell
powershell -ExecutionPolicy Bypass -File .\install_tv_monitor_task.ps1 -Remove
```

### For advanced users: make the task by hand

You can use the Task Scheduler window instead of the command.

1. Start menu, **Task Scheduler**, **Create Task...** (not "Basic Task").
2. **General**: name `LocalFlix TV Monitor`. Choose **Run only when user is logged on**. Tick **Hidden**. Do **not** tick "Run with highest privileges".
3. **Triggers**, New, **At log on** (your user).
4. **Triggers**, New, "Begin the task": **On an event**. Choose **Custom**, **New Event Filter**, the **XML** tab. Tick *Edit query manually* and paste:
   ```xml
   <QueryList><Query Id="0" Path="Microsoft-Windows-NetworkProfile/Operational"><Select Path="Microsoft-Windows-NetworkProfile/Operational">*[System[Provider[@Name='Microsoft-Windows-NetworkProfile'] and EventID=10000]]</Select></Query></QueryList>
   ```
   Tick **Delay task for 15 seconds**.
5. **Actions**, New, Start a program:
   - Program: the full path of `pythonw.exe`. Find it with `py -c "import sys;print(sys.executable)"`, then change `python.exe` to `pythonw.exe`.
   - Arguments: `"C:\path\to\LocalFlix-Server\tv_monitor.py" --run`
   - Start in: `C:\path\to\LocalFlix-Server`
6. **Conditions**: untick *Start the task only if the computer is on AC power* and *Stop if the computer switches to battery power*.
7. **Settings**: untick *Stop the task if it runs longer than...*. For *If the task is already running*, choose **Do not start a new instance**.

## 4. Test it

1. Press the Windows key, type `Task Scheduler` and open it. Click **Task Scheduler Library**. Right-click **LocalFlix TV Monitor** and choose **Run**. Or sign out and sign in again.
2. Switch the TV Wi-Fi **off**. Wait one minute. Switch it **on**.
3. Within about 15 seconds, open `http://localhost:8080` on the laptop, or open LocalFlix on the TV.
4. Read the log. It is the file `tv_monitor.log` in the LocalFlix folder. You should see "At home and the TV is on the Wi-Fi" and "Starting LocalFlix".

**Test away from home:** connect the laptop to a phone hotspot and run `py tv_monitor.py --check`. It must say `At home? no`.

## 5. Settings file (`tv_monitor.json`) (advanced)

Most people never need to change this. The setup in section 2 writes it for you.

| Key | What it means |
|---|---|
| `home_ssids` | Wi-Fi names that count as home |
| `home_gateway_macs` | Router ID (MAC). When both lists are filled, both must match. |
| `tv_ip`, `tv_mac` | The TV. One of them is enough. Both is safest. |
| `stop_server_when_tv_leaves` | `true` (normal): stop the LocalFlix this monitor started, when the TV has been off the Wi-Fi (or you left home) for about 2 minutes. `false`: leave it running. |
| `keep_awake` | `true` (normal): Windows will not sleep on its own while LocalFlix runs, you are home and the TV is on the Wi-Fi. `false`: never touch the sleep settings. |
| `keep_awake_on_battery` | `false` (normal): keep awake only when the charger is plugged in. `true`: also on battery (the battery runs out faster). |
| `server_args` | Extra options for `localflix.py`. Normal: `["--no-browser"]` |
| `port` | `0` means: read it from `config.json` (8080) |

Changed your router or your Wi-Fi name? Run `py tv_monitor.py --setup` again. Then restart the task (right-click, **End**, then **Run**).

## 6. Will this slow the laptop, make it hot, or use the battery?

**The monitor itself: no. You will not notice it.**

- You are not home, or you are home without the TV: once a minute, Windows starts the monitor. It does a quick check (a Wi-Fi name look-up and one ping). It ends within a second or two. Nothing stays running between checks.
- You are home and the TV is on: the monitor stays on. It pings the TV once every 30 seconds. It ends about a minute after the TV is gone.
- Even with a start every minute, this is far below 1% of the processor and about 10 to 20 MB of memory, only while it is alive. There is no fan noise and no heat. The battery cost is too small to measure in normal use.

**LocalFlix itself is what uses power, and only while it runs.**

- LocalFlix doing nothing: almost nothing.
- Playing a movie that the TV can play directly: light.
- **Playing a converted movie (ffmpeg): heavy.** This is the only case that can make the laptop warm and loud, and empty the battery fast. Prefer movies that the TV plays directly (H.264/AAC MP4 or MKV). Keep the laptop plugged in for long sessions.

**Sleep.** A sleeping laptop freezes LocalFlix, so the TV cannot reach it. LocalFlix is not closed. It continues when the laptop wakes. That is why `keep_awake` is on by default:

- It asks Windows not to sleep **by itself**, only while all of these are true: LocalFlix is running, you are at home, the TV is found on the Wi-Fi, and the charger is plugged in.
- About 60 seconds after the TV disappears (it is switched off, or it left the Wi-Fi), the request ends. The normal sleep timer works again. On battery, it ends within 30 seconds.
- The **screen can still turn off** on its normal timer. This saves power.
- It does **not** stop sleep that **you** cause: closing the lid, pressing the sleep or power button, or choosing Sleep. For the lid: Control Panel, Power Options, *Choose what closing the lid does*, and set "When plugged in" to *Do nothing*.
- Some laptops, or company rules, can still override it. For example when the battery is almost empty.
- `py tv_monitor.py --check` shows if keep-awake is on and if the charger is plugged in. The file `tv_monitor.log` writes every ON and OFF change.

Want to manage sleep yourself? Set `"keep_awake": false` in `tv_monitor.json`, then restart the task.

## 7. When something does not work

| Problem | What to do |
|---|---|
| `At home? no` while you are at home | Run `py tv_monitor.py --setup` again. If you use a cable at home, the Wi-Fi name is empty. Then the setup uses the router address, and that still works. |
| `TV ... not found` but the TV is on | Is the TV on the same Wi-Fi (not a guest network)? Some routers stop devices from seeing each other (it is called "AP isolation" or "client isolation"). Turn that off in the router. |
| LocalFlix starts, but the TV cannot connect | Do the firewall step: [Step 7 in the setup guide](setup-guide.md#step-7-let-phones-and-tvs-connect) (`py localflix.py --firewall`). |
| Nothing happens, and the log says "No home network is set" | Run `py tv_monitor.py --setup`. |
| The task shows `Running` but the TV is off | It ends about a minute after the TV leaves the network. If it stays `Running`, run `py tv_monitor.py --check`. If it says `TV ... FOUND`, the TV still answers on the network (many TVs do in standby). |
| The task is `Ready` while you are home and the TV is on | It checks once a minute, so wait up to one minute. You can also right-click the task and choose **Run**. If it never starts, run `py tv_monitor.py --check` and read `tv_monitor.log`. |
| You updated the task files | After you change the schedule or update `install_tv_monitor_task.ps1`, run the install command again. It replaces the old task. |
| You want to stop LocalFlix now | See section 8. |
| You updated LocalFlix, but the site or TV still behaves the old way | The old hidden LocalFlix is still running, and the monitor leaves a running LocalFlix alone. Restart it: section 8. |
| LocalFlix keeps running after the TV left | You probably started it yourself, so the monitor leaves it alone. The monitor only stops a LocalFlix that it started (its number is kept in `tv_monitor.server.pid`). |

## 8. After you update LocalFlix: restart the hidden LocalFlix

The LocalFlix that the monitor starts has no window. And the monitor never restarts a LocalFlix that is already running. So after you change a file or install an update, the **old** LocalFlix keeps running until you stop it. A sign of this: you start `py localflix.py` by hand, but the site still behaves the old way, because the old LocalFlix still holds the port.

### The easy way

**Restart the laptop.** Everything stops. After the restart, the monitor starts the new LocalFlix when you are home and the TV is on.

### The other way: stop it yourself

Use this if you do not want to restart. Run these in PowerShell in the LocalFlix folder. `8080` is the normal port. If you changed it, use the port from `config.json`.

**1. Find what is using the port.** This also shows which program it is and where it runs from:

```powershell
Get-NetTCPConnection -LocalPort 8080 -State Listen | ForEach-Object {
  Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)" |
    Select-Object ProcessId, Name, ExecutablePath, CommandLine
}
```

`CommandLine` should contain the full path to `localflix.py`. If that path is a different folder than the one you updated, you updated the wrong copy.

The same idea with older tools, if the command above does not work:

```powershell
netstat -ano | findstr :8080
tasklist /FI "PID eq 1234" /V
```

(Replace `1234` with the last number on the `LISTENING` line.)

**2. Find every LocalFlix process**, whatever port it uses:

```powershell
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*localflix.py*' } |
  Select-Object ProcessId, Name, CommandLine
```

**3. Stop it.** Use the number from step 1 or 2:

```powershell
Stop-Process -Id 1234 -Force
```

Or stop whatever uses the port, in one go:

```powershell
Get-NetTCPConnection -LocalPort 8080 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

**4. Check that it is gone:**

```powershell
py tv_monitor.py --check
```

The line `Server on port 8080` should now say `not running`.

**5. Optional, after a Python update:** delete the old saved files so nothing old is used:

```powershell
Remove-Item lf\__pycache__ -Recurse -Force -ErrorAction SilentlyContinue
```

**6. Start it again.** Either let the monitor do it (it starts LocalFlix within a minute when you are home and the TV is on the Wi-Fi), or start it yourself. This shows the start screen with the version:

```powershell
py localflix.py
```

Then open `http://localhost:8080/api/movies`. It shows exactly what LocalFlix sends (titles, categories, posters). If a browser or TV still shows old data after that, it only needs a hard refresh (**Ctrl+F5**), or on the TV: close the app by force and open it again.

---

## 9. Uninstall

```powershell
powershell -ExecutionPolicy Bypass -File .\install_tv_monitor_task.ps1 -Remove
```

Then delete `tv_monitor.py`, `tv_monitor.json` and `tv_monitor.log` if you want.
