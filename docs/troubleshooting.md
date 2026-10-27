# Fixes for common problems

Find the message or problem you see. Then follow the steps under it.

**Open PowerShell in the LocalFlix folder** for the commands below. See [how to open it](setup-guide.md#b-open-powershell-in-the-localflix-folder).

## Problems while you install

### Windows says it does not know `py`

1. Close all PowerShell windows. Open a new one. A window that was open before the install does not see the new program.
2. Still the same? Run the Python installer again. If it has a box called **Add python.exe to PATH**, tick it.
3. See [Step 1 in the setup guide](setup-guide.md#step-1-install-python).

### Installing the parts shows red text (`pip install` fails)

1. Check that you have internet. Run the same command again: `py -m pip install -r requirements.txt`
2. A yellow message about a new version of `pip` is not a problem.
3. Still red text? You may have a very new Python that some parts are not ready for. Install Python 3.13 from https://www.python.org/downloads/ (open the page of the Python 3.13 release and choose **Windows installer (64-bit)**), open a new PowerShell, and try again. Please also tell us in an issue which Python version you had.

### `ffmpeg not found` in the start text

ffmpeg is not known to Windows yet.

1. Do the ffmpeg steps in [Step 4 of the setup guide](setup-guide.md#step-4-install-ffmpeg).
2. Close all PowerShell windows. Open a **new** one. Old windows do not see the change.
3. Type `ffmpeg -version`. You should see `ffmpeg version`.

### PowerShell says "running scripts is disabled"

Use this longer command. It works on every laptop:

```powershell
powershell -ExecutionPolicy Bypass -File .\fix_firewall.ps1
```

## Problems when you start LocalFlix

### LocalFlix cannot find the movie folder

LocalFlix asks you to type the folder address. Open your movie folder in File Explorer, click the address bar, press **Ctrl+C**, then paste it in the window (right-click) and press **Enter**. Or start it like this, with your own folder:

```powershell
py localflix.py --movies "D:\Films"
```

### `(0 found)`, or no movies show

The folder is wrong or has no video files. Check the folder address in the start text. Start again with the right folder, or open **Settings** in LocalFlix on the laptop and click **Save & Rescan**. See [Your movie folder](library.md).

### `Could not start on port 8080`

Another program uses that number. It can also be an old LocalFlix that is still running. Start LocalFlix on another number:

```powershell
py localflix.py --port 8090
```

Then use `8090` in the addresses on your phone and TV. If you think an old LocalFlix is running, see [section 8 of the auto-start guide](tv-autostart.md#8-after-you-update-localflix-restart-the-hidden-localflix).

### `/qr` shows 404 or an error

1. Stop LocalFlix (click its window, press **Ctrl+C**) and start it again. An old running copy does not know the new pages.
2. Open `/qr` on the **laptop** first: `http://localhost:8080/qr`
3. If `http://localhost:8080` itself shows an error (HTTP 500), update to the latest LocalFlix files.

## Problems when a phone or TV connects

### `ERR_CONNECTION_REFUSED`

Windows has a hidden block for `python.exe`. It is stronger than the allow rule. Do this once, in **PowerShell as administrator**, in the LocalFlix folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\fix_firewall.ps1
```

Then start LocalFlix again. See [Step 7 in the setup guide](setup-guide.md#step-7-let-phones-and-tvs-connect).

### `ERR_ADDRESS_UNREACHABLE`, or the address cannot be found

The phone or TV cannot reach the laptop at all.

1. Both devices must use the **exact same Wi-Fi**. Not one on a guest network and one on the main network.
2. Use the right address. On the laptop, type `ipconfig` and read the **IPv4 Address** of the Wi-Fi. Or read the **Direct IP** line in the LocalFlix window.
3. Turn off **AP isolation** or **client isolation** in the router settings. (Open the router page, for example `http://192.168.1.1`, and look in the Wi-Fi settings.)

### `DNS_PROBE_FINISHED_NXDOMAIN` on `localflix.local`

Android does not understand names that end in `.local`. This is not a mistake in your setup. Use the **IP address** instead. Make it permanent with [Step 8 of the setup guide](setup-guide.md#step-8-give-the-laptop-an-address-that-does-not-change).

### The phone or TV reaches the laptop only sometimes

The laptop may be asleep, or it may have a new address.

1. Check that LocalFlix is still running in PowerShell.
2. Do not let the laptop sleep while you watch. See [Step 9 in the setup guide](setup-guide.md#step-9-stop-the-laptop-from-sleeping).
3. Type `ipconfig` and check that the address is the one you expect.

### The TV app does not find the laptop

1. LocalFlix must be running on the laptop.
2. The TV and the laptop must use the same Wi-Fi.
3. Do the firewall step (above). The TV app looks for the laptop with a message that the firewall can block.
4. Type the **Direct IP** in the app by hand and press **Connect**. See [Android TV app](tv-app.md).

## The address changes

### The address keeps changing, or a router reservation does nothing

Follow [Step 8 of the setup guide](setup-guide.md#step-8-give-the-laptop-an-address-that-does-not-change). Check these things in this order:

1. Use an IP address **inside** the group of addresses the router gives out (the one the laptop already has).
2. Check that the MAC address is exactly the **Physical Address** from `ipconfig /all`. Try it with dashes, with colons, and with no symbols.
3. In Windows, set **Random hardware addresses** to **Off** (Settings, Network & internet, Wi-Fi, your network).
4. Click **Apply Changes** (or **Save**) on the main page of the router. Wait for the router to restart.
5. Turn the Wi-Fi off and on. Then type `ipconfig`.
6. Still not working? Use **Way B** (set the address on the laptop).

### No internet after you set a fixed address

The gateway or the DNS is wrong. Press the Windows key, type `ncpa.cpl` and press Enter. Open **Wi-Fi**, **Properties**, **Internet Protocol Version 4**. The **Default gateway** must be your router (often `192.168.1.1`). The DNS must be `8.8.8.8` and `1.1.1.1`.

To go back to normal: choose **Obtain an IP address automatically** and **Obtain DNS server address automatically**, then click **OK**.

## Problems with playing movies

### The movie plays on the laptop but not on the TV or phone

The TV or phone does not understand how this movie is made.

1. Install ffmpeg (see [Step 4](setup-guide.md#step-4-install-ffmpeg)). LocalFlix then changes the movie while it plays.
2. In the browser player, click the **Playback settings** button (the sliders icon). Under **Playback mode**, choose **Compatibility**.
3. Still not working? Change the movie once with **HandBrake** (free, from https://handbrake.fr). Choose the format **H.264 MP4**.

### The movie shows the wrong title (for example "1080P")

Rename the file so the real title is first:

```
Bad:   1080P.BluRay.Inception.2010.mkv
Good:  Inception.2010.1080p.BluRay.mkv
Good:  Inception (2010).mkv
Good:  [Rec].2007.720p.mkv       (brackets are fine, it shows as Rec)
```

Then open **Settings** in LocalFlix and click **Save & Rescan**.

## Problems with subtitles

### Subtitles not found

1. Check that the file is in your subtitle folder (for example `Movies\subtitle\`).
2. The file type must be `.srt`, `.vtt`, `.ass`, `.ssa` or `.sub`.
3. Open **Settings** in LocalFlix and check the subtitle folder address.
4. Click **Save & Rescan**.
5. In the player, open **Subtitles**, then **Browse subtitle folder**, and choose the file by hand.

More: [Subtitles](subtitles.md).

## Problems with the TV app

### The keyboard does not appear in the search box of the TV app

Update the app, and restart LocalFlix on the laptop. If it still does not work, open an issue. Please say if the box flashes and closes, or if nothing happens.

## Still stuck?

Open an issue on GitHub. Please write: your Windows version, your Python version, if ffmpeg is installed, the device you watch on (browser, phone or TV app), what you did, and the text you see on the screen. See [CONTRIBUTING.md](../CONTRIBUTING.md).
