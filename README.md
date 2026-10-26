# LocalFlix — Setup Guide

Stream your personal movie library to any phone, tablet, or TV on your home Wi-Fi.
No account. No subscription. No internet required during playback.

```
[Your Laptop]  localflix.py  (Flask server — must be running)
       ↕  same Wi-Fi network
[Phone / Tablet / Smart TV / Android TV]  — open a browser or use the TV app
```

---

## Quick checklist (new laptop + new TV)

Do these in order. Each item links to a detailed section.

- [ ] Install Python, tick "Add python.exe to PATH" -> [Section 2](#2-install-python)
- [ ] `pip install -r requirements.txt` -> [Section 3](#3-install-localflix-dependencies)
- [ ] Install ffmpeg -> [Section 4](#4-install-ffmpeg-recommended)
- [ ] Put movies in one folder -> [Section 5](#5-organise-your-movie-files)
- [ ] Run `py localflix.py` once -> [Section 6](#6-first-run)
- [ ] Open the firewall (2 steps, as Administrator) -> [Section 7](#7-allow-phones-and-tvs-to-connect-firewall)
- [ ] Give the laptop a **permanent IP address** -> [Section 8](#8-give-your-laptop-a-permanent-address)
- [ ] Open the address on phone / TV -> [Section 9](#9-open-on-a-phone-or-tablet), [Section 10](#10-open-on-a-smart-tv--android-tv)

---

## Table of Contents

1. [What you need](#1-what-you-need)
2. [Install Python](#2-install-python)
3. [Install LocalFlix dependencies](#3-install-localflix-dependencies)
4. [Install ffmpeg](#4-install-ffmpeg-recommended)
5. [Organise your movie files](#5-organise-your-movie-files)
6. [First run](#6-first-run)
7. [Allow phones and TVs to connect (Firewall)](#7-allow-phones-and-tvs-to-connect-firewall)
8. [Give your laptop a permanent address](#8-give-your-laptop-a-permanent-address)
9. [Open on a phone or tablet](#9-open-on-a-phone-or-tablet)
10. [Open on a Smart TV / Android TV](#10-open-on-a-smart-tv--android-tv)
11. [Install the Android TV app (optional)](#11-install-the-android-tv-app-optional)
12. [Subtitles](#12-subtitles)
13. [Auto-start when Windows boots](#13-auto-start-when-windows-boots)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. What you need

| Item | Details |
|---|---|
| A Windows 10/11 laptop | This is your server — it must stay on while you watch |
| Python 3.10 or newer | Free download — instructions below |
| ffmpeg | Free — gives you frame grabs and converts incompatible videos |
| Your movie files | MP4, MKV, AVI, MOV, etc. all work |
| A phone, tablet, or TV | Any device with a modern browser on the same Wi-Fi |

---

## 2. Install Python

1. Open **https://www.python.org/downloads/** and click **Download Python 3.x.x**
2. Run the installer
3. **Important:** on the first screen, tick **"Add python.exe to PATH"** before clicking Install
4. When done, open PowerShell and confirm it works:

```powershell
py --version
# Should print: Python 3.x.x
```

---

## 3. Install LocalFlix dependencies

Open PowerShell in the LocalFlix folder (right-click the folder -> "Open in Terminal") and run:

```powershell
py -m pip install -r requirements.txt
```

This installs:

| Package | What it does |
|---|---|
| `flask` | The web server (required) |
| `waitress` | A faster, more stable server |
| `charset-normalizer` | Reads non-English subtitle files correctly |
| `zeroconf` | Lets iPhone, Mac and Windows open `http://localflix.local:8080` (optional, see Section 9) |

---

## 4. Install ffmpeg (recommended)

ffmpeg is optional but **strongly recommended** — it enables:
- Poster images grabbed directly from your video files
- Compatibility mode that converts AVI, WMV, and other formats browsers cannot natively play

### Steps

1. Go to **https://github.com/BtbN/FFmpeg-Builds/releases**
2. Download **`ffmpeg-master-latest-win64-gpl.zip`** (first zip in the list)
3. Extract it anywhere, e.g. `C:\ffmpeg\`
4. Add the `bin` folder to Windows PATH:
   - Press `Win + S`, search **"environment variables"**
   - Click **"Edit the system environment variables"**
   - Click **"Environment Variables…"**
   - Under **System variables**, find **Path**, click **Edit**
   - Click **New** and paste: `C:\ffmpeg\bin`
   - Click OK on all dialogs
5. Open a **new** PowerShell window and confirm:

```powershell
ffmpeg -version
# Should print: ffmpeg version 7.x ...
```

---

## 5. Organise your movie files

LocalFlix reads one folder and all its sub-folders. A typical layout:

```
C:\Users\YourName\Videos\Movies\
├── Inception (2010).mkv
├── [Rec].2007.720p.mp4
├── The Dark Knight (2008)\
│   └── The.Dark.Knight.2008.1080p.BluRay.mkv
└── subtitle\
    ├── Inception.srt
    └── Rec.srt
```

**Subtitle folder:** LocalFlix automatically checks for a `subtitle` subfolder inside your movies folder. You can also set a different path in the Settings screen.

**File naming tips:**
- Titles in brackets like `[Rec]` are handled correctly — the title shows as **Rec**
- Year in the filename (`Inception.2010` or `Inception (2010)`) sets the year tag
- Junk tokens (`1080p`, `BluRay`, `x264`, `YIFY`, `RARBG`, etc.) are stripped automatically

---

## 6. First run

Open PowerShell in the LocalFlix folder and run:

```powershell
py localflix.py
```

You should see something like this:

```
--------------------------------------------------------------
 LocalFlix 2.0.0
--------------------------------------------------------------
 Movies     : C:\Users\hp\Videos\Movies  (101 found)
 Subtitles  : C:\Users\hp\Videos\Movies\subtitle  (90 files)
 ffmpeg     : found
--------------------------------------------------------------
 This computer   ->  http://localhost:8080
 Apple/Windows   ->  http://localflix.local:8080
 Direct IP       ->  http://192.168.1.33:8080

 Android / TV: scan the QR at  http://localhost:8080/qr
--------------------------------------------------------------
 Press Ctrl+C to stop.
```

The browser opens on your laptop. The **Direct IP** line is the address you type on Android phones and TVs.
(Your IP numbers will be different. That is normal.)

### Use a different movies folder

```powershell
py localflix.py --movies "D:\Films"
```

### Use a different port

```powershell
py localflix.py --port 9000
```

---

## 7. Allow phones and TVs to connect (Firewall)

This is a two-step process you do **once** on a new laptop.

### Step 1 — Add the port rule (Administrator PowerShell)

Right-click PowerShell and choose **"Run as Administrator"**, then:

```powershell
cd C:\path\to\LocalFlix
py localflix.py --firewall
```

Output: `Firewall rules added. Phones and TVs on your Wi-Fi can now connect.`

### Step 2 — Fix the python.exe block rule

This is the step most guides skip. Windows silently adds a **Block** rule for `python.exe` the first time it sees Python listening for network connections — it does this even if you have a port Allow rule. This block rule overrides everything and causes `ERR_CONNECTION_REFUSED` on phones and TVs.

Run the included fix script in **Administrator PowerShell**:

```powershell
cd C:\path\to\LocalFlix
.\fix_firewall.ps1
```

This removes the hidden python.exe block and adds a clean Allow rule.

### Verify the fix worked

```powershell
# Should show NO results (no more block rules for python)
Get-NetFirewallRule -Action Block -Enabled True -Direction Inbound |
    Get-NetFirewallApplicationFilter |
    Where-Object { $_.Program -like "*python*" }
```

Restart `py localflix.py` after running the fix.

---

## 8. Give your laptop a permanent address

### Why this matters

Your router uses **DHCP**: every time a device connects, the router can give it a different IP address.
If the laptop IP changes, the address saved on your phone and TV stops working.

You only need to fix the **laptop**. Phones and TVs can have any IP they like.

Choose **one** of the two options below. Option A is cleaner. Option B always works.

### Step 1 - Find the laptop information

Open PowerShell and run:

```powershell
ipconfig /all
```

Find the section **Wireless LAN adapter Wi-Fi** and write down:

| Item | Example | Where to find it |
|---|---|---|
| IPv4 Address | `192.168.1.33` | Your current IP |
| Subnet Mask | `255.255.255.0` | Same line group |
| Default Gateway | `192.168.1.1` | This is your router. You open it in a browser to change settings |
| Physical Address | `A1-B2-C3-D4-E5-F6` | This is the **MAC address** of the laptop |

### Step 2 - Turn off random Wi-Fi addresses

Windows can use a random MAC address for privacy. If it does, the router will not recognise your laptop.

1. Settings -> **Network & internet** -> **Wi-Fi**
2. Click your Wi-Fi network name
3. Set **Random hardware addresses** to **Off**

### Option A - Reserve the IP in the router (recommended)

You tell the router: "always give this MAC address the same IP."

1. On the laptop, open a browser and go to `http://192.168.1.1` (use your Default Gateway). Log in. The password is often printed on a sticker on the router.
2. Find the **LAN Settings** page. Look at the **DHCP Start IP** and **End IP**. This is the range the router gives out.
   Example: Start `192.168.1.33`, End `192.168.1.254`.
3. Click **Edit Reserved IP Address** (the name can be different, for example "Address Reservation", "Static DHCP" or "DHCP Binding").
4. In the table, enter:
   - **IP address:** your current laptop IP, for example `192.168.1.33`
   - **MAC address:** the Physical Address from Step 1
5. Click **Add**. The new row must appear in the table. Then click **Apply Changes** or **Save** on the main page. Some routers restart. Wait 1-2 minutes.
6. Turn the laptop Wi-Fi off, wait 10 seconds, turn it on. Run `ipconfig` to check the IP is the same.

Tips if the new row does not appear:
- Many routers accept only an IP **inside** the DHCP range. Use the IP the laptop already has (which is inside the range), not a random lower number.
- Try the MAC address in another format: with dashes `A1-B2-C3-D4-E5-F6`, with colons `A1:B2:C3:D4:E5:F6`, or without symbols `A1B2C3D4E5F6`. Use capital letters.
- Refresh the page after clicking Add.
- If it still fails, use Option B.

### Option B - Set a fixed IP on the laptop (always works)

You tell Windows to stop asking the router and to use one fixed address.

Choose an IP that is **outside** the router DHCP range, so no other device can take it.
Example: if the range starts at `.33`, use `192.168.1.10`.

1. Press the Windows key, type `ncpa.cpl`, press Enter
2. Right-click **Wi-Fi** -> **Properties**
3. Double-click **Internet Protocol Version 4 (TCP/IPv4)**
4. Select **Use the following IP address** and enter:

   | Field | Value |
   |---|---|
   | IP address | `192.168.1.10` |
   | Subnet mask | `255.255.255.0` |
   | Default gateway | `192.168.1.1` |

5. Select **Use the following DNS server addresses** and enter:

   | Field | Value |
   |---|---|
   | Preferred DNS | `8.8.8.8` |
   | Alternate DNS | `1.1.1.1` |

6. Click **OK**, then **Close**
7. Run `ipconfig` and check **IPv4 Address** is `192.168.1.10`

> **Warning:** this setting stays on the Wi-Fi adapter for every network. At school, work or a cafe, go back to
> **Obtain an IP address automatically** and **Obtain DNS server address automatically**, or the internet will not work.
>
> To go back to normal at any time: same window -> choose both "Obtain ... automatically" options -> OK.

### Step 3 - Restart LocalFlix and check

1. In the LocalFlix window press **Ctrl+C**, then run `py localflix.py`
2. The **Direct IP** line must show your permanent address, for example `http://192.168.1.10:8080`
3. Use this address on all your devices. It will not change any more.

---

## 9. Open on a phone or tablet

1. Make sure the phone is on the **same Wi-Fi network** as the laptop
2. Open Chrome, Firefox or Safari
3. Type the **Direct IP** address, for example `http://192.168.1.10:8080`
4. Your movie library opens

**Tip:** In Android Chrome, tap the 3-dot menu -> **Add to Home screen**. You get an icon that opens LocalFlix like an app.

### Three ways to connect

| Method | Address | iPhone / iPad | Android phone | Android TV / Smart TV | Mac / Windows |
|---|---|---|---|---|---|
| Direct IP | `http://192.168.1.10:8080` | Yes | **Yes** | **Yes** | Yes |
| QR code | `http://localhost:8080/qr` (open on laptop) | Yes | **Yes** | Scan with a phone | Yes |
| Name (mDNS) | `http://localflix.local:8080` | Yes | **Usually no** | **Usually no** | Yes |

**Why does `localflix.local` not work on Android?**
A `.local` name only works if the device asks the local network "who is localflix.local?" (this is called mDNS).
iPhone, Mac and Windows do that. Android Chrome and most Android TVs do not. They ask the router DNS, the router does not know
the name, and Chrome shows `DNS_PROBE_FINISHED_NXDOMAIN`. This is an Android limitation. It is not a LocalFlix error and not a mistake in your setup.
**On Android, always use the IP address (and make it permanent with Section 8).**

### Using the QR code

1. On the laptop, open `http://localhost:8080/qr` (or click the QR icon at the top right of LocalFlix)
2. Scan the code with your phone camera
3. It opens the current IP address. Nothing to type.

---

## 10. Open on a Smart TV / Android TV

Most Smart TVs have a built-in browser (Samsung, LG, Sony, Hisense).

### Using the built-in TV browser

1. Open the **Internet** or **Browser** app on the TV
2. Type the **Direct IP** address, for example `http://192.168.1.10:8080` (do not use `localflix.local`)
3. Use the remote control to browse

### Remote control

| Remote button | Action |
|---|---|
| Arrow keys | Move between movie cards |
| OK / Select / Enter | Open a movie / confirm |
| Back | Close player / go back |
| Left / Right while playing | Back 10s / forward 10s |
| Up / Down while playing | Volume up / down |
| Double-press OK on video | Fullscreen on / off |

The selected card has a bright blue glow, so you always see where the cursor is.

### New TV checklist

1. TV is on the **same Wi-Fi** as the laptop (not a guest network)
2. LocalFlix is running on the laptop
3. Firewall done (Section 7)
4. Laptop address is permanent (Section 8)
5. Type the Direct IP in the TV browser, or use the TV app (Section 11)

---

## 11. Install the Android TV app (optional)

The Android TV app gives a native TV interface with ExoPlayer. It is the best experience on a TV box or Android TV.
The app can also find the laptop automatically on the same Wi-Fi (it sends a UDP broadcast on port 50505), so you may not need to type the address.

### Requirements

- Android Studio (free: https://developer.android.com/studio)
- Android TV on the same Wi-Fi

### Build the APK

1. Open Android Studio
2. **File -> Open** -> select the LocalFlix project folder
3. Wait for the Gradle sync (the first time it downloads files and takes a few minutes)
4. **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**
5. The APK is here: `app\build\outputs\apk\debug\app-debug.apk`

### Turn on Developer Mode on the TV

1. Settings -> Device Preferences -> About
2. Press OK on **Build** seven times. A message says "You are now a developer".
3. Settings -> Device Preferences -> Developer options
4. Turn on **USB debugging** and **ADB debugging over network**
5. Write down the IP shown, for example `192.168.1.20:5555`

### Install with ADB (no USB cable)

```powershell
adb connect 192.168.1.20:5555
adb install "app\build\outputs\apk\debug\app-debug.apk"
```

The **LocalFlix** icon appears on the TV home screen.

### First start of the TV app

1. Open LocalFlix on the TV
2. If it does not find the laptop by itself, enter the Direct IP, for example `http://192.168.1.10:8080`
3. Press Connect

---

## 12. Subtitles

### Automatic matching

Put `.srt`, `.ass`, `.vtt`, or `.sub` files in your subtitle folder:

```
Movies\subtitle\
├── Inception.srt              ← matches Inception (2010).mkv
├── Inception.English.srt      ← same movie, labelled English
├── Rec.srt                    ← matches [Rec].720p.mp4
└── The.Dark.Knight.srt
```

LocalFlix fuzzy-matches subtitle filenames to movies automatically.

### Add a subtitle while watching

In the player, press the **CC (Subtitles)** button and choose:
- A matched subtitle track from your folder
- **Browse subtitle folder** to search all indexed files
- **Upload from this device** to upload a file directly from your phone or browser

### Fix subtitle timing (sync)

If subtitles are early or late:
1. Press CC → **Appearance and timing**
2. Use **Delay +** or **Delay −** buttons to shift by 0.1 seconds at a time

---

## 13. Auto-start when Windows boots

Start LocalFlix quietly in the background every time you sign in — so the TV always works without opening PowerShell:

```powershell
py localflix.py --autostart
```

To remove auto-start:

```powershell
py localflix.py --no-autostart
```

---

## 14. Troubleshooting

### Phone/TV gets ERR_CONNECTION_REFUSED

**Cause:** Windows has a hidden Block rule on `python.exe` that overrides all port rules.

**Fix (Administrator PowerShell):**

```powershell
cd C:\path\to\LocalFlix
.\fix_firewall.ps1
```

Restart `py localflix.py` afterward.

---

### Phone/TV gets ERR_ADDRESS_UNREACHABLE or cannot find the address

The phone cannot reach the laptop at all (a network-layer problem).

Checklist:
1. Both devices are on the **exact same Wi-Fi network** — not one on a guest network and one on the main network
2. You are using the right IP — run `ipconfig` on the laptop and look for the Wi-Fi IPv4 address
3. AP Isolation / Client Isolation is **off** in your router settings (log in to your router at `192.168.1.1` to check)

---

### Video plays on laptop browser but not on TV or phone

The TV browser does not support the video codec.

**Fix:**
1. Make sure ffmpeg is installed (see Section 4). LocalFlix uses it to automatically transcode incompatible files to H.264 MP4 on the fly
2. If ffmpeg is installed, try the Settings gear in the player → **Playback → Compatibility mode**
3. For stubborn files, convert them permanently with **HandBrake** (free at https://handbrake.fr) — export as H.264 MP4

---

### Movie shows wrong title (e.g. "1080P" instead of the real name)

Rename the file so the real title comes first:

```
# Problematic — junk before title
1080P.BluRay.Inception.2010.mkv

# Good — title first
Inception.2010.1080p.BluRay.mkv
Inception (2010).mkv
[Rec].2007.720p.mkv          ← brackets work: shows as "Rec"
```

---

### Subtitles are not found for a movie

1. Check the file is in your subtitle folder (`Movies\subtitle\`)
2. The extension must be `.srt`, `.vtt`, `.ass`, `.ssa`, or `.sub`
3. Open LocalFlix Settings and confirm the subtitle folder path is correct
4. Click **Save & Rescan** to re-index
5. In the player, press CC → **Browse subtitle folder** to manually pick any subtitle from the folder

---

### Android shows DNS_PROBE_FINISHED_NXDOMAIN on `localflix.local`

Android does not support `.local` names in most cases. Use the IP address instead.
Make it permanent with [Section 8](#8-give-your-laptop-a-permanent-address).

---

### `http://<ip>:8080/qr` shows 404 or an error

1. Stop LocalFlix (Ctrl+C) and start it again. An old running copy does not know new pages.
2. Open `/qr` on the **laptop** first: `http://localhost:8080/qr`
3. If `http://localhost:8080` itself shows an error (HTTP 500), update to the latest LocalFlix files.

---

### The IP address keeps changing

Follow [Section 8](#8-give-your-laptop-a-permanent-address). Option A (router reservation) is best. Option B (fixed IP on the laptop) always works.

---

### I added a reserved IP in the router but nothing appears or nothing changes

1. Use an IP **inside** the router DHCP range (the one the laptop already has)
2. Check the MAC address is exactly the **Physical Address** from `ipconfig /all`, and try dashes, colons, or no symbols
3. Turn **Random hardware addresses** Off in Windows Wi-Fi settings
4. Click **Apply Changes** on the main LAN page, wait for the router to restart
5. Turn Wi-Fi off and on, then run `ipconfig`
6. Still not working? Use Option B

---

### After setting a fixed IP, the internet does not work

Your DNS or gateway is wrong. Open `ncpa.cpl` -> Wi-Fi -> Properties -> IPv4 and check:
Default gateway = your router IP (usually `192.168.1.1`), DNS = `8.8.8.8` and `1.1.1.1`.
Or choose **Obtain ... automatically** to go back to normal.

---

### The phone can reach the laptop only sometimes

The laptop may be asleep or on another IP. Check:
1. LocalFlix is still running in PowerShell
2. Windows power settings: do not let the laptop sleep while you watch
3. `ipconfig` shows the address you expect

---

### "ffmpeg not found" in the startup banner

ffmpeg is missing from PATH.

1. Follow Section 4 to extract and add to PATH
2. Open a **new** PowerShell window (existing ones do not pick up PATH changes)
3. Run `ffmpeg -version` to confirm it is found

---

## Quick reference

```powershell
# Normal start
py localflix.py

# Use a different movies folder
py localflix.py --movies "D:\Films"

# Run without opening the browser
py localflix.py --no-browser

# First-time firewall setup (Administrator PowerShell)
py localflix.py --firewall
.\fix_firewall.ps1

# Windows auto-start on login
py localflix.py --autostart
py localflix.py --no-autostart

# Custom port
py localflix.py --port 9090

# Show the connect QR code (open on the laptop)
# http://localhost:8080/qr
```

---

*LocalFlix 2.0 — for personal use on your home network.*
