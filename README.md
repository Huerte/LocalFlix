# LocalFlix — Setup Guide

Stream your personal movie library to any phone, tablet, or TV on your home Wi-Fi.
No account. No subscription. No internet required during playback.

```
[Your Laptop]  localflix.py  (Flask server — must be running)
       ↕  same Wi-Fi network
[Phone / Tablet / Smart TV / Android TV]  — open a browser or use the TV app
```

---

## Table of Contents

1. [What you need](#1-what-you-need)
2. [Install Python](#2-install-python)
3. [Install LocalFlix dependencies](#3-install-localflix-dependencies)
4. [Install ffmpeg (for frame grabs + compat mode)](#4-install-ffmpeg-recommended)
5. [Organise your movie files](#5-organise-your-movie-files)
6. [First run](#6-first-run)
7. [Allow phones and TVs to connect (Firewall)](#7-allow-phones-and-tvs-to-connect-firewall)
8. [Open on a phone or tablet](#8-open-on-a-phone-or-tablet)
9. [Open on a Smart TV / Android TV](#9-open-on-a-smart-tv--android-tv)
10. [Install the Android TV app (optional, better TV experience)](#10-install-the-android-tv-app-optional)
11. [Subtitles](#11-subtitles)
12. [Auto-start when Windows boots](#12-auto-start-when-windows-boots)
13. [Troubleshooting](#13-troubleshooting)

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

Open PowerShell in the LocalFlix folder (right-click the folder → "Open in Terminal") and run:

```powershell
pip install flask waitress charset-normalizer
```

Flask is the web server. Waitress makes it production-grade. charset-normalizer handles non-English subtitles correctly.

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

You should see:

```
--------------------------------------------------------------
 LocalFlix 2.0.0
--------------------------------------------------------------
 Movies     : C:\Users\hp\Videos\Movies  (101 found)
 Subtitles  : C:\Users\hp\Videos\Movies\subtitle  (90 files)
 ffmpeg     : found
--------------------------------------------------------------
 This computer   ->  http://localhost:8080
 Phone / TV      ->  http://192.168.1.33:8080
--------------------------------------------------------------
 Press Ctrl+C to stop.
```

The browser opens automatically on your laptop. Write down the **Phone / TV** address — you will need it on all other devices.

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

## 8. Open on a phone or tablet

1. Make sure your phone is on the **same Wi-Fi network** as the laptop
2. Open Chrome, Firefox, or Safari
3. Type the address shown in the terminal, e.g. `http://192.168.1.33:8080`
4. Your movie library loads in the browser

**Tip:** On Android Chrome, tap the 3-dot menu → **Add to Home screen** to create a shortcut that looks like a native app.

### If the IP address changes after reconnecting

Your laptop may get a new IP from the router each time. Either:
- Run `py localflix.py` — it always prints the current address
- Or check: PowerShell → `ipconfig` → look for "IPv4 Address" under your Wi-Fi adapter
- Or set a **static IP** (see the Troubleshooting section)

---

## 9. Open on a Smart TV / Android TV

Most Smart TVs have a built-in browser (Samsung, LG, Sony, Hisense).

### Using the built-in TV browser

1. On the TV, open the **Internet** or **Browser** app (usually in the app list)
2. Navigate to: `http://192.168.1.33:8080` (your laptop's address)
3. Use the remote to browse

### Remote control navigation

| Remote button | Action |
|---|---|
| Directional pad (arrow keys) | Move between movie cards |
| OK / Select / Enter | Open a movie / confirm |
| Back | Close player / go back |
| Left / Right while playing | Skip back 10s / forward 10s |
| Up / Down while playing | Volume up/down |
| Double-tap OK on video | Toggle fullscreen |
| Back button | Exit player, back to library |

**Focus is always visible** — the selected card has a bright blue glow so you always know where the remote cursor is.

---

## 10. Install the Android TV app (optional)

The Android TV app gives a native 10-foot interface with ExoPlayer. This is the best experience on a TV box or Android TV device.

### Requirements

- Android Studio (free from https://developer.android.com/studio)
- Your Android TV on the same Wi-Fi

### Build the APK

1. Open Android Studio
2. **File → Open** → select the LocalFlix project folder
3. Wait for Gradle sync (first time downloads dependencies, takes a few minutes)
4. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
5. APK saved to: `app\build\outputs\apk\debug\app-debug.apk`

### Enable Developer Mode on the TV

1. Settings → Device Preferences → About
2. Press OK on **Build** seven times quickly — *"You are now a developer"* appears
3. Settings → Device Preferences → Developer options
4. Enable **USB debugging** AND **ADB debugging over network**
5. Note the IP shown, e.g. `192.168.1.20:5555`

### Install via ADB (no USB cable needed)

ADB comes with Android Studio. Open a terminal and:

```powershell
# Connect to the TV over Wi-Fi
adb connect 192.168.1.20:5555

# Install the app
adb install "app\build\outputs\apk\debug\app-debug.apk"
```

The **LocalFlix** icon appears on the TV home screen.

### First launch on the TV app

1. Open LocalFlix
2. Enter the server address: `http://192.168.1.33:8080`
3. Press Connect — your movie library loads

---

## 11. Subtitles

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

## 12. Auto-start when Windows boots

Start LocalFlix quietly in the background every time you sign in — so the TV always works without opening PowerShell:

```powershell
py localflix.py --autostart
```

To remove auto-start:

```powershell
py localflix.py --no-autostart
```

---

## 13. Troubleshooting

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

### Server shows a different IP each time (DHCP issue)

Set a static IP on your laptop so the address never changes:

1. Settings → Network & Internet → Wi-Fi → your network → Properties
2. Under **IP assignment**, click **Edit**
3. Switch to **Manual**
4. Fill in:
   - **IP address:** `192.168.1.200` (or any number above 100 that your router does not hand out via DHCP)
   - **Subnet mask:** `255.255.255.0`
   - **Gateway:** `192.168.1.1` (your router — check with `ipconfig`, look for "Default Gateway")
5. Save

After this the address printed by LocalFlix will always be the same.

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
```

---

*LocalFlix 2.0 — for personal use on your home network.*
