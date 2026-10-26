# LocalFlix TV auto-start (Windows 11)

LocalFlix starts by itself, hidden in the background, **only when both are true**, and the monitor task is `Running` **only while both are true**:

1. your laptop is on your **home** network, and
2. your **Android TV / Google TV** is on that same Wi-Fi.

While the TV is using the server it also stops Windows from falling asleep on its own (section 6). Away from home nothing starts, ever.

Run every command below in PowerShell, opened in your LocalFlix folder.

> "TV is connected" means the TV is reachable on the Wi-Fi. Some TVs stay on the Wi-Fi in standby, so the server may start even if the screen is off. That is harmless (see section 6).

---

## 1. (Recommended) Give the TV a fixed address

In your router's admin page, find **DHCP reservation / Address reservation** and reserve one IP for the TV. If you skip this, the monitor can still find the TV by its MAC address, but it needs an occasional network scan.

On the TV, turn **off** "Private/Randomized MAC" for your home Wi-Fi if it is offered, so the address stays the same.

## 2. One-time setup

Be at home, on your home Wi-Fi, with the TV switched on:

```powershell
py tv_monitor.py --setup
```

It shows your Wi-Fi name and router, scans the network, and asks you to pick the TV from a list (or type the IP shown on the TV under Settings > Network). It saves `tv_monitor.json`.

Check it:

```powershell
py tv_monitor.py --check
```

You should see `At home? YES`, `TV ... FOUND`. Turn the TV's Wi-Fi off and run it again: it should say `not found`.

> Wi-Fi name shows as "not readable"? Windows 11 (24H2 and later) hides it unless **Settings > Privacy & security > Location > Location services** is on. You can leave it off: the router address is saved too and is enough to recognise home.

## 3. Install the Task Scheduler task

```powershell
powershell -ExecutionPolicy Bypass -File .\install_tv_monitor_task.ps1
```

This creates the task **LocalFlix TV Monitor**:

| Setting | Value |
|---|---|
| Runs as | you, only while signed in, no admin rights |
| Window | hidden (`pythonw.exe`) |
| Triggers | at sign-in, then **every minute** (change with `-CheckEveryMinutes`), **and** every time Windows connects to a network (Event 10000, 20 s delay) |
| Battery | keeps running on battery |
| Duplicates | a second copy is ignored |
| Home or TV missing | the monitor ends within a second or two, so the task shows `Ready`, not `Running` |
| Home and TV both there | the monitor stays `Running`: starts the server, keeps the laptop awake (if plugged in) |
| TV (or home) gone for about 2 minutes | the monitor **stops the server it started** (a server you started yourself is never touched), releases keep-awake and ends. A short Wi-Fi blip does not stop anything |
| Time limit | none |

Remove it any time:

```powershell
powershell -ExecutionPolicy Bypass -File .\install_tv_monitor_task.ps1 -Remove
```

### Prefer the Task Scheduler window? Do it by hand

1. Start menu > **Task Scheduler** > **Create Task...** (not "Basic Task").
2. **General**: name `LocalFlix TV Monitor`, choose **Run only when user is logged on**, tick **Hidden**. Do not tick "Run with highest privileges".
3. **Triggers** > New > **At log on** (your user).
4. **Triggers** > New > Begin the task: **On an event**. Choose **Custom** > New Event Filter > XML tab > tick *Edit query manually* and paste:
   ```xml
   <QueryList><Query Id="0" Path="Microsoft-Windows-NetworkProfile/Operational"><Select Path="Microsoft-Windows-NetworkProfile/Operational">*[System[Provider[@Name='Microsoft-Windows-NetworkProfile'] and EventID=10000]]</Select></Query></QueryList>
   ```
   Tick **Delay task for 15 seconds**.
5. **Actions** > New > Start a program:
   - Program: full path of `pythonw.exe` (find it with `py -c "import sys;print(sys.executable)"`, then change `python.exe` to `pythonw.exe`)
   - Arguments: `"C:\path\to\LocalFlix-main\tv_monitor.py" --run`
   - Start in: `C:\path\to\LocalFlix-main`
6. **Conditions**: untick *Start the task only if the computer is on AC power* and *Stop if the computer switches to battery power*.
7. **Settings**: untick *Stop the task if it runs longer than...*; set *If the task is already running* to **Do not start a new instance**.

## 4. Test it

1. Right-click the task > **Run** (or sign out and in).
2. Switch the TV Wi-Fi off, wait a minute, switch it on.
3. Within about 15 seconds, open `http://localhost:8080` on the laptop, or open LocalFlix on the TV.
4. Read the log: `tv_monitor.log` in the LocalFlix folder. You should see "At home and the TV is on the Wi-Fi" and "Starting LocalFlix".

Away-from-home test: connect the laptop to a phone hotspot and run `py tv_monitor.py --check`: it must say `At home? no`.

## 5. Settings (`tv_monitor.json`)

| Key | Meaning |
|---|---|
| `home_ssids` | Wi-Fi names that count as home |
| `home_gateway_macs` | router MAC(s); both lists must match when both are filled |
| `tv_ip`, `tv_mac` | the TV (either is enough, both is safest) |
| `stop_server_when_tv_leaves` | `true` (default) = stop the server this monitor started once the TV has been off the Wi-Fi (or you left home) for about 2 minutes. `false` = leave it running |
| `keep_awake` | `true` (default) = Windows will not sleep on its own while the server runs, you are home and the TV is on the Wi-Fi. `false` = never touch sleep settings |
| `keep_awake_on_battery` | `false` (default) = keep awake only while the charger is plugged in. `true` = also on battery (drains it faster) |
| `server_args` | extra `localflix.py` options, default `["--no-browser"]` |
| `port` | `0` = read from `config.json` (8080) |

Changed router or Wi-Fi name? Run `py tv_monitor.py --setup` again, then restart the task (right-click > End, then Run).

## 6. Will this slow the laptop, heat it, or drain the battery?

**The monitor itself: no, not noticeably.**
- Not home, or home without the TV: once a minute Windows starts it, it does a quick check (a Wi-Fi-name lookup and one ping) and ends within a second or two. Nothing stays running in between.
- Home and TV on: it stays alive with one ping every 30 s, and ends about a minute after the TV is gone.
- Even with a launch every minute that is far below 1% CPU, roughly 10-20 MB of memory only while it is alive, and no fan or heat change. Battery cost is too small to measure in normal use.

**The LocalFlix server is what uses power, and only while it runs.**
- Idle server: nearly nothing.
- Streaming a file the TV can play directly: light (disk read plus network).
- **Converted playback with ffmpeg: heavy.** This is the only case that can make the laptop warm, loud, and drain the battery fast. Prefer files the TV plays natively (H.264/AAC MP4/MKV), and keep the laptop plugged in for long sessions.

**Sleep.** A sleeping laptop freezes LocalFlix, so the TV cannot reach it (the server is not shut down; it continues after the laptop wakes). That is why `keep_awake` is on by default:

- It asks Windows not to sleep **by itself** only while all of these are true: the server is running, you are at home, the TV is found on the Wi-Fi, and the charger is plugged in.
- About 60 seconds after the TV disappears (switched off, left the Wi-Fi), the request is released and the normal sleep timer applies again. On battery it is released within 30 seconds.
- The **screen can still turn off** on its normal timer, which saves power.
- It does **not** stop sleep that you cause: closing the lid, pressing the sleep/power button, or choosing Sleep. For the lid: Control Panel > Power Options > *Choose what closing the lid does* > set "When plugged in" to *Do nothing*.
- Some laptops or company policies may still override it, for example at critical battery.
- `py tv_monitor.py --check` shows whether keep-awake is on and whether the charger is plugged in; `tv_monitor.log` records every ON/OFF change.

Prefer to manage sleep yourself? Set `"keep_awake": false` in `tv_monitor.json`, then restart the task.

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| `At home? no` while at home | Run `--setup` again. If you use a cable at home, the Wi-Fi name is empty; setup then relies on the router address, which still works |
| TV `not found` but the TV is on | Is it on the same Wi-Fi (not a guest network)? Some routers block device-to-device traffic ("AP / client isolation"): turn that off |
| Server starts but the TV cannot connect | The firewall step in the main README (`py localflix.py --firewall`) |
| Nothing happens, log says "No home network is set" | Run `py tv_monitor.py --setup` |
| Task shows "Running" but the TV is off | It ends about a minute after the TV leaves the network. If it stays `Running`, run `py tv_monitor.py --check`: `TV ... FOUND` means the TV still answers on the network (many TVs do in standby). |
| Task is `Ready` while home and TV are on | It checks once a minute, so wait up to a minute. You can also right-click the task > Run. If it never starts, run `py tv_monitor.py --check` and read `tv_monitor.log` |
| Re-install after updating | After changing the schedule or updating `install_tv_monitor_task.ps1`, run the installer again (it replaces the old task) |
| Stop the server now | Task Manager > end `pythonw.exe` running `localflix.py` |
| Server keeps running after the TV left | It was probably started by you, so the monitor leaves it alone. Only a server the monitor started (pid kept in `tv_monitor.server.pid`) is stopped |

## 8. Uninstall

```powershell
powershell -ExecutionPolicy Bypass -File .\install_tv_monitor_task.ps1 -Remove
```

Then delete `tv_monitor.py`, `tv_monitor.json` and `tv_monitor.log` if you want.