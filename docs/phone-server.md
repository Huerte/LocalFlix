# Use an Android phone as the server (no laptop)

This guide is for people who do **not** have a laptop. Your Android phone does the job of the laptop. The phone keeps the movies and shares them. Other phones, tablets and TVs watch them.

You do not need to know about computers. Follow the steps in order. Do one step at a time. Take your time.

The first time, it takes about 45 to 90 minutes.

> **Please read this honestly.** The LocalFlix program is normal Python code, so it should run on a phone. But the authors did not test every phone. Phones are different, and Android is different on every brand. If something does not work, go to the part called [Fixes for common problems on the phone](#fixes-for-common-problems-on-the-phone).

## Before you start

### How it works

```
[Android phone]  LocalFlix runs here (inside an app called Termux).
      |           The movies are here too.
      |
      |   same Wi-Fi  (a router, or a phone hotspot)
      |
[Other phone / Tablet / TV]  Open LocalFlix here and watch.
```

- Your movies stay on the server phone.
- The server phone must be **on**, **charging**, and LocalFlix must be **running** while you watch.
- Nothing goes to the internet. You do not need an account.
- You can also watch on the server phone itself. You do not even need Wi-Fi for that.

### What you need

| Item | Notes |
|---|---|
| An Android phone | Android 7 or newer. This is the **server**. It stays on while you watch. |
| Your movie files | MP4, MKV, AVI, MOV and similar files. They must be **in the phone memory or on the SD card**. |
| About 2 GB of free space | For the programs (Termux, Python, ffmpeg). The movies need their own space. |
| A phone charger | Keep the phone plugged in. The server uses a lot of battery. |
| Wi-Fi | A home router, **or** a phone hotspot. See [Use a phone hotspot](hotspot.md). |
| Internet | Only for the setup, to download the free programs |
| Another phone, tablet or TV | To watch. It must use the same Wi-Fi as the server phone. |

### Words used in this guide

| Word | What it means |
|---|---|
| Termux | A free app. It gives your phone a black window where you type commands. |
| Command | A line of text you type in Termux to ask the phone to do something. |
| Server phone | The phone that keeps the movies and runs LocalFlix. |
| IP address | The number address of a device on your Wi-Fi. Example: `192.168.1.33` |
| Router | The box from your internet company that makes your Wi-Fi. |
| Hotspot | Your phone makes its own Wi-Fi. Other devices can join it. |
| Wake lock | A switch that tells the phone: "do not fall asleep". |

## Read this first: what does NOT work on a phone

The normal [setup guide](setup-guide.md) was written for a Windows laptop. **Some parts of it do not work on a phone.** Do not follow those parts. This list stops you from getting lost.

> **DOES NOT WORK ON A PHONE. Do not use these:**

| Do NOT use this | Why | What to do instead |
|---|---|---|
| Steps 1 to 4 of the setup guide (Python, ffmpeg, PATH, `C:\ffmpeg`) | They are for Windows. | Use **Steps 2 to 6** of this guide. |
| The command `py` (for example `py localflix.py`) | `py` exists only on Windows. | Type `python` instead. |
| PowerShell, "administrator" windows | These are Windows only. | Use the Termux window. |
| Step 7 of the setup guide (firewall), `py localflix.py --firewall`, `fix_firewall.ps1` | Android has no firewall that blocks LocalFlix. `--firewall` only prints "only needed on Windows". | Skip. Nothing to do. |
| Step 8 of the setup guide (fixed address, Way A and Way B) | Windows only. Way A needs a router page. | See [Step 9 of this guide](#step-9-keep-the-address-from-changing-optional). |
| Step 9 of the setup guide (stop sleeping) | Windows settings. | Use the wake lock in [Step 8 of this guide](#step-8-keep-the-phone-awake). |
| The TV auto-start helper: `tv_monitor.py`, `install_tv_monitor_task.ps1`, the [Start LocalFlix by itself](tv-autostart.md) guide | It is for Windows 11 only. | Start LocalFlix by hand (see [Every day](#every-day-start-and-stop-localflix)). |
| Folder addresses like `C:\Users\Anna\Videos` | Phones do not use `C:\`. | Use phone addresses like `~/storage/shared/Movies`. |
| The name `http://localflix.local:8080` on Android phones and Android TVs | Android does not understand names that end in `.local`. | Use the numbers address, like `http://192.168.1.33:8080`. |
| The QR page `/qr` | It needs the internet to draw the picture. It may also show a wrong address on a phone. | Type the address by hand. |
| `--remote-admin` | Not needed, and it lets other devices change your settings. | Change settings on the server phone itself. |
| Making the TV app file with Android Studio ([Android TV app, Part 1](tv-app.md)) | Android Studio needs a **computer**. A phone cannot do it. | Use the TV browser, or ask a friend with a laptop to make the app file once. See [Step 11](#step-11-open-localflix-on-a-tv). |
| Letting the browser open by itself | A phone has no screen window for it. | Always add `--no-browser` when you start. |
| Converting big movies that your TV cannot play | It makes the phone very hot and slow. | Use movies that the TV plays directly (for example MP4). |

> **Always remember:** if a guide says "PowerShell", "Windows", "administrator" or `C:\`, that part is **not for your phone**.

## Quick checklist

Use this list to see where you are. Each line is a step in this guide.

- [ ] Step 1. Install Termux
- [ ] Step 2. Update Termux
- [ ] Step 3. Install Python and ffmpeg
- [ ] Step 4. Let Termux see your movies
- [ ] Step 5. Get LocalFlix
- [ ] Step 6. Install the parts LocalFlix needs
- [ ] Step 7. Start LocalFlix
- [ ] Step 8. Keep the phone awake
- [ ] Step 9. Keep the address from changing (optional)
- [ ] Step 10. Open LocalFlix on a phone or tablet
- [ ] Step 11. Open LocalFlix on a TV

## Learn these things first: how to use Termux

Termux is a black window with text. You type there. Read this part once.

- **To type:** tap the screen. The keyboard opens. If the keyboard does not open, swipe from the left edge of the screen to the right. A side menu opens. Tap **Keyboard**.
- **To run a command:** type it, then press **Enter** on the keyboard.
- **To paste text you copied:** press your finger on the black screen for one second. A small menu appears. Tap **Paste**.
- **Capital letters and small letters are different.** `Movies` and `movies` are two different names. Type exactly as shown.
- **Spaces matter.** Type them as shown.
- **When a command is finished:** the window shows a new line that ends with `$`. The cursor blinks after it.
- **The extra keys:** above the keyboard there is a row with keys like **ESC**, **CTRL**, **TAB** and arrows. You will use **CTRL**.
- **To stop a program that is running (Ctrl+C):** tap **CTRL** in the extra row, then tap the letter **c** on the keyboard. Another way: press **Volume Down** and the letter **c** together.
- **Two small commands you may use:**

| Command | What it does |
|---|---|
| `ls` | Shows the names of the files and folders here |
| `cd NAME` | Goes into the folder called NAME |

> **Important:** a command that asks "Do you want to continue? [Y/n]" wants an answer. Type `y` and press Enter. If it asks something else and you are not sure, just press **Enter**.

## Step 1. Install Termux

> **Do not install Termux from the Google Play Store.** That copy is old and does not work well. Use one of the two ways below.

**Way 1. F-Droid (easiest)**

1. Open your phone browser. Go to **https://f-droid.org**
2. Download the **F-Droid** app. Open the file. If Android asks "Allow installing from this source?", tap **Allow** or **Settings**, then allow it. Go back and install.
3. Open F-Droid. Wait until it finishes updating the list. This can take a few minutes.
4. Tap the search icon. Type `Termux`. Open **Termux** and tap **Install**.

**Way 2. GitHub**

1. Open your phone browser. Go to **https://github.com/termux/termux-app/releases**
2. Scroll down to **Assets**. Download the file that ends with `.apk`. If you are not sure which one, choose the file with `arm64-v8a` in its name (most phones made after 2016). If the phone says it cannot install it, try the file with `universal` in its name.
3. Open the downloaded file. Allow the install when Android asks.

> **You should see:** a new app called **Termux** with a black icon.

> **If it does not work:**
> - "App not installed": you may already have another Termux from a different place. Remove the old one first. Then install again.
> - Android blocks the file: when it asks, allow your browser (or F-Droid) to install apps.

## Step 2. Update Termux

1. Open the **Termux** app. The first time, it needs a few seconds.
2. Type this and press Enter:

```
pkg update
```

3. If it asks a question like `Continue? [Y/n]`, type `y` and press Enter. If it asks about a "configuration file", just press **Enter**.
4. Wait until the new line ends with `$`.
5. Now type this and press Enter:

```
pkg upgrade
```

6. Answer `y` if it asks. Wait until it is finished. It can take a few minutes.

> **You should see:** the window stops moving, and the last line ends with `$`.

> **If it does not work:**
> - Red text that says it cannot download, or a "mirror" problem: type `termux-change-repo`, press Enter, choose the first choice with the arrow keys and Enter, then try `pkg update` again.
> - Still not working: check that the phone has internet.

## Step 3. Install Python and ffmpeg

Python is a free program that LocalFlix needs to run. ffmpeg is a free helper program. LocalFlix works without it, but we suggest you install it. With ffmpeg, LocalFlix makes poster pictures from your videos.

Type this and press Enter:

```
pkg install -y python ffmpeg unzip
```

Many lines move. Wait until the line ends with `$`. It can take 5 to 10 minutes. The download is a few hundred MB.

Now check that it worked. Type:

```
python --version
```

> **You should see:** something like `Python 3.12.8`. Any number that starts with 3.10 or higher is fine.

Then type:

```
ffmpeg -version
```

> **You should see:** `ffmpeg version` and some numbers.

> **If it does not work:**
> - `python: command not found`: run `pkg install -y python` again.
> - Red text and an error: run `pkg update`, then try again. Check that you have internet and free space on the phone.

## Step 4. Let Termux see your movies

By default, Termux cannot see your photos and files. You must allow it **one time**.

1. Type this and press Enter:

```
termux-setup-storage
```

2. Android shows a question: **Allow Termux to access photos, media and files?** Tap **Allow**.

Now check. Type:

```
ls ~/storage
```

> **You should see:** names like `shared`, `downloads`, `movies`, `dcim`, `pictures`. If your phone has an SD card, you may also see `external-1`.

What these names mean:

| Name | What it is |
|---|---|
| `~/storage/shared` | The whole internal memory of the phone |
| `~/storage/downloads` | Your Downloads folder |
| `~/storage/movies` | The Movies folder of the phone |
| `~/storage/external-1` | The SD card (only if you have one) |

Now find your movie folder. Type this to see what is inside the phone memory:

```
ls ~/storage/shared
```

Look for your movie folder in the list. Write down its exact name. For example `Movies`.

If your movies are on the SD card, type `ls ~/storage/external-1`. Some phones show the SD card in a different way. If you see nothing, see the problems list at the end.

> **If it does not work:**
> - You tapped **Deny** by mistake: open the phone **Settings**, then **Apps**, then **Termux**, then **Permissions**. Allow **Files and media** (or **Storage**). Then type `termux-setup-storage` again.
> - `ls: cannot access`: type `termux-setup-storage` again, and allow it.

Your movie folder address will look like this:

```
~/storage/shared/Movies
```

This means: "the folder called Movies inside the phone memory". Every folder **inside** your movie folder becomes a group in LocalFlix, like Horror or Comedy. To learn how names work, read [Your movie folder](library.md). You can read it later.

## Step 5. Get LocalFlix

You will download LocalFlix as a ZIP file, then open it.

1. Open your phone browser (Chrome, for example).
2. Open the LocalFlix page on GitHub.
3. Tap the green **Code** button. Tap **Download ZIP**. A file called `LocalFlix-main.zip` goes to your **Downloads** folder. (If your browser shows the page as a small phone page, tap the three dots and choose **Desktop site**, then try again.)
4. Go back to **Termux**.
5. Check that the file is there. Type:

```
ls ~/storage/downloads
```

> **You should see:** `LocalFlix-main.zip` in the list. If you downloaded it two times, the name may be `LocalFlix-main (1).zip`. That is fine. Use the name you see in the next command.

6. Copy it to Termux's own folder. Type this and press Enter:

```
cp ~/storage/downloads/LocalFlix-main.zip ~/
```

If your file has another name, type that name instead. If the name has spaces, put quote marks around the path, like this: `cp "$HOME/storage/downloads/LocalFlix-main (1).zip" ~/`

7. Open the ZIP file:

```
unzip LocalFlix-main.zip
```

8. Go into the folder:

```
cd LocalFlix-main
```

9. Check:

```
ls
```

> **You should see:** files such as `localflix.py`, `README.md` and `requirements.txt`, and folders such as `docs` and `static`.

> **If it does not work:**
> - `No such file or directory`: Step 4 is not finished, or the ZIP file has another name. Type `ls ~/storage/downloads` and look at the name.
> - If you only see one more folder called `LocalFlix-main` inside, type `cd LocalFlix-main` once more. The right folder is the one that has `localflix.py` inside.

**Do not delete or rename this folder later.** Some settings are saved inside it.

## Step 6. Install the parts LocalFlix needs

LocalFlix uses a few small free parts. This command downloads them. You need internet for this step.

> **Do not use** `py -m pip install -r requirements.txt` from the other guide. On a phone, one of the parts (`zeroconf`) may fail and stop the whole install. Use this command instead.

Make sure you are in the LocalFlix folder (the line before `$` ends with `LocalFlix-main`). Type this and press Enter:

```
pip install flask waitress charset-normalizer
```

Many lines appear. Wait until they stop.

> **You should see:** the last lines say `Successfully installed` and some names.

> **If it does not work:**
> - A message about a new version of `pip` is not a problem. Ignore it. Do **not** try to update pip yourself in Termux.
> - Red text and the word `error`: check the internet and try the same command again.
> - `pip: command not found`: go back to Step 3.

What these parts do:

| Part | What it does |
|---|---|
| `flask` | Runs LocalFlix. It is required. |
| `waitress` | Makes LocalFlix faster and steadier |
| `charset-normalizer` | Reads subtitle files in other languages correctly |

You can **skip** the part called `zeroconf`. It only gives the name `localflix.local`, and Android phones and Android TVs cannot use that name anyway. If LocalFlix prints a line like `(mDNS off: run py -m pip install zeroconf ...)`, **ignore** it.

## Step 7. Start LocalFlix

1. Make sure you are in the LocalFlix folder. If you closed Termux, type:

```
cd ~/LocalFlix-main
```

2. Type this and press Enter. Use **your own** movie folder name instead of `Movies`:

```
python localflix.py --movies "$HOME/storage/shared/Movies" --no-browser
```

Look at the command piece by piece:

| Piece | Meaning |
|---|---|
| `python localflix.py` | Start LocalFlix |
| `--movies "..."` | The folder that has your movies. Keep the quote marks. |
| `$HOME/storage/shared/Movies` | The phone memory, then the folder called Movies |
| `--no-browser` | Do not try to open a browser window by itself |

If your movies are on the SD card, use `$HOME/storage/external-1/Movies` instead (use the name you saw in Step 4).

If you have no internet at the place where you watch (for example, a hotspot without mobile data), add `--no-online` at the end. It tells LocalFlix not to look for posters on the internet.

### What you should see

After a few seconds you see a block of text like this:

```
 --------------------------------------------------------------
  LocalFlix 2.0.1
 --------------------------------------------------------------
  Movies     : /data/data/com.termux/files/home/storage/shared/Movies  (101 found)
  Subtitles  : none set  (0 files)
  ffmpeg     : found
 --------------------------------------------------------------
  This computer   ->  http://localhost:8080
  Direct IP       ->  http://192.168.1.33:8080
 --------------------------------------------------------------
  Press Ctrl+C to stop.
```

**Your numbers will be different. This is normal.** Four things to know about this text:

1. **`This computer`** means this phone. Open `http://localhost:8080` in the browser **on the server phone** to see your movies.
2. **`Direct IP`** may be **wrong** on a phone. It may show `127.0.0.1`, or a strange number. A phone does not always know its own address. **Do not trust it.** Read the real address in Step 10.
3. The lines about the **firewall**, `py localflix.py --firewall` and `.\fix_firewall.ps1` (and the line about **Administrator**) are for Windows. **Ignore them.**
4. The line about the **QR** at `/qr` is **not** useful on a phone. **Ignore it.** (See the "does not work" list.)

Now check that it works. Open the phone browser (Chrome) and type this in the address box:

```
http://localhost:8080
```

> **You should see:** the LocalFlix page with your movies.

> **If it does not work:**
> - `Movie folder not found` or it asks you to type the full path: the folder name is wrong. Press **CTRL then c** to stop. Check the name with `ls ~/storage/shared`. Capital letters matter. Try again.
> - `(0 found)` or no movies in the browser: the folder is wrong or has no video files. Stop LocalFlix and start it again with the right folder.
> - `Could not start on port 8080`: another program uses that number. Type `python localflix.py --movies "$HOME/storage/shared/Movies" --no-browser --port 8090`. Then use `8090` in all addresses.
> - `No module named flask`: do Step 6 again.
> - `ffmpeg : not found`: do Step 3 again.

### Important

**Keep Termux open.** If Android closes Termux, LocalFlix stops. To stop LocalFlix on purpose, press **CTRL then c** in Termux.

To use the phone for other things while LocalFlix runs, press the **Home** button. Do **not** swipe Termux away from the list of recent apps.

## Step 8. Keep the phone awake

Android likes to stop apps that run in the background. Then your TV loses LocalFlix. Do these things **one time**. Without them, LocalFlix can stop after a few minutes when the screen is off.

### 8.1 Turn on the wake lock

Open Termux. Type this and press Enter:

```
termux-wake-lock
```

> **You should see:** the Termux notification at the top of the phone now says "wake lock held" (or shows a **Release wakelock** button).

You can also pull down the notification list. Find the Termux notification. Tap **Acquire wakelock**.

To turn it off later, type `termux-wake-unlock`.

> **Do this every time you start Termux.** The wake lock ends when Termux closes.

### 8.2 Stop battery saving for Termux

Names are different on each phone. Look for words like these:

1. Open the phone **Settings**.
2. Open **Apps**, then **Termux**.
3. Open **Battery**.
4. Choose **Unrestricted** (or **Don't optimize** or **No restrictions**). Turn off any switch called **Pause app activity if unused** or **Remove permissions if app is unused**.

On some brands (Xiaomi, Huawei, Oppo, Vivo, Samsung), there are extra lists called **Autostart**, **Protected apps** or **Sleeping apps**. Put Termux in the "allowed" list and **remove** it from any "sleeping" list.

### 8.3 Keep the phone plugged in

- Keep the phone on a **charger** while it serves movies.
- Take off the phone case, and keep the phone in a cool place. Do not leave it in the sun. A hot phone becomes slow and can stop.
- If your phone has a "limit charging to 80%" setting, turn it on. It is better for the battery when the phone stays plugged in for a long time.

### 8.4 If Termux still gets closed (newer Android)

Android 12 and newer can stop background programs by itself. You may see a message `[Process completed (signal 9)]` or LocalFlix stops without a reason.

- **Android 14 or newer:** open **Settings**, then **System**, then **Developer options**. Find **Disable child process restrictions** and turn it on. (To show Developer options: Settings, About phone, tap **Build number** 7 times.)
- **Android 12 or 13:** the fix needs a computer, so skip it. Keep the phone screen on and plugged in instead.

## Step 9. Keep the address from changing (optional)

Your server phone has an IP address on the Wi-Fi, like `192.168.1.33`. The router can give the phone a **new** address at any time. Then the address you saved on your TV stops working.

- **Easy way:** read the address again before you watch (Step 10). It takes one minute.
- **Better way, if you can use your router:** ask the router to always give the same address to the server phone.
  1. On the server phone, open **Settings**, then **Wi-Fi**. Tap your Wi-Fi network (or the small gear icon).
  2. Find **Privacy** (or **MAC address type**). Choose **Use device MAC** (not "random MAC"). Otherwise the router does not know your phone.
  3. On the same page, find the phone **IP address** and the **MAC address**. Write them down.
  4. Follow **Way A** in [Step 8 of the setup guide](setup-guide.md#step-8-give-the-laptop-an-address-that-does-not-change). Where it says "laptop", read "server phone". Use the phone IP address and the phone MAC address.
- **No router page, or a phone hotspot?** You cannot reserve an address. See [Use a phone hotspot](hotspot.md).

> **DOES NOT WORK on a phone:** "Way B" (set the address on the laptop with `ncpa.cpl`) and the `ipconfig` commands. They are for Windows only.

## Step 10. Open LocalFlix on a phone or tablet

### 10.1 Find the real address of the server phone

On the **server phone**:

1. Open the phone **Settings**.
2. Open **Wi-Fi** (on some phones: **Network & internet**, then **Wi-Fi**).
3. Tap the Wi-Fi network you use (or the small gear icon).
4. Find **IP address**. It looks like `192.168.1.33`.

If you cannot find it there, try: **Settings**, then **About phone**, then **Status** (or **Status information**), then **IP address**.

Write the address down. Your LocalFlix address is:

```
http://THE-ADDRESS:8080
```

For example `http://192.168.1.33:8080`.

### 10.2 Open it on the other phone

1. Make sure the other phone uses the **same Wi-Fi** as the server phone. Do not use a guest network.
2. Make sure LocalFlix is running on the server phone (Termux is open, and you see the "Press Ctrl+C to stop" text).
3. Open Chrome, Firefox or Safari on the other phone.
4. Type the address (for example `http://192.168.1.33:8080`) in the address box. Press Go.
5. Your movies appear.

**Make an icon on an Android phone:** in Chrome, tap the three dots, then **Add to Home screen**. You get an icon that opens LocalFlix like an app.

> **If it does not work:** see [Fixes for common problems on the phone](#fixes-for-common-problems-on-the-phone). The most common reasons are: not the same Wi-Fi, LocalFlix is not running, or the phone fell asleep (Step 8).

### Ways to connect, for a phone server

| Way | What to type | Works? |
|---|---|---|
| Address with numbers | `http://192.168.1.33:8080` | **Yes.** Use this. |
| The server phone itself | `http://localhost:8080` | **Yes**, but only on the server phone. |
| Name | `http://localflix.local:8080` | **No** on Android. Only some iPhones and Macs, and only if you installed `zeroconf`. Do not use it. |
| QR code page `/qr` | `http://localhost:8080/qr` | **Do not use.** It needs internet and may show the wrong address. |

### Change settings

The LocalFlix **Settings** page (movie folder, "Save & Rescan") can only be changed on the **server phone itself**, at `http://localhost:8080`. Other devices can watch, but cannot change the folder. This is on purpose, for safety. When you add new movies, open `http://localhost:8080` on the server phone, open **Settings** and tap **Save & Rescan**.

## Step 11. Open LocalFlix on a TV

You have two choices.

### Choice 1. The TV browser (easy, no computer)

This is the way for you, if you do not have a laptop.

1. The TV must use the **same Wi-Fi** as the server phone.
2. Open the browser app on the TV. It is often called **Internet** or **Browser**.
3. Type the numbers address, for example `http://192.168.1.33:8080`. Do **not** use `localflix.local`.
4. Use the remote control. The buttons are the same as in [Step 11 of the setup guide](setup-guide.md#step-11-open-localflix-on-a-tv).

### Choice 2. The LocalFlix TV app (better, but needs a computer once)

The TV app plays more kinds of files and is made for the remote. But the app file must be **made** with a program called Android Studio. That program runs only on a **computer** (Windows, Mac or Linux). **A phone cannot make it.**

If you really want the app:

1. Ask a friend, a relative or a computer shop to make the app file for you, one time. They follow [Android TV app](tv-app.md), Part 1. They give you the file `app-debug.apk` (on a USB stick, for example).
2. Put the file on the TV with a USB stick. The steps are in [Android TV app](tv-app.md).
3. In the app, the TV tries to find the server by itself. This **may work** with a phone server, but it was not tested. If it does not find the phone, type the address by hand (the same numbers address as above) and press **Connect**.

> **DOES NOT WORK without a computer:** building the TV app, and the `adb` commands in the TV app guide.

### Before you open LocalFlix on the TV, check these

1. The TV uses the same Wi-Fi as the server phone, not a guest network.
2. LocalFlix is running on the server phone.
3. You did the wake lock and battery steps (Step 8).
4. The server phone is plugged in.
5. You know the right address (Step 10).

## Every day: start and stop LocalFlix

**To start:**

1. Plug in the server phone. Connect it to the Wi-Fi.
2. Open **Termux**.
3. Type `termux-wake-lock` and press Enter.
4. Type `cd ~/LocalFlix-main` and press Enter.
5. Type `python localflix.py --movies "$HOME/storage/shared/Movies" --no-browser` and press Enter. (Tip: press the **up arrow** key in the extra row to bring back the last command.)
6. Read the address again if it may have changed (Step 10.1).
7. Open LocalFlix on your other phone or TV.

**To stop:** open Termux. Press **CTRL then c**. Type `termux-wake-unlock` and press Enter.

**Tired of typing?** You can make one short command. See [Make a short start command](#make-a-short-start-command-optional).

## Make a short start command (optional)

You can put the three start commands in one file. Then you type only one short line.

1. In Termux, copy and paste **all of this** at once. Change `Movies` to your own folder name first if it is different:

```
cat > ~/start-localflix.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock
cd "$HOME/LocalFlix-main"
python localflix.py --movies "$HOME/storage/shared/Movies" --no-browser
EOF
chmod +x ~/start-localflix.sh
```

2. From now on, to start LocalFlix, open Termux and type:

```
~/start-localflix.sh
```

## Update LocalFlix later

When there is a new version, download the new ZIP file (Step 5). Stop LocalFlix first. Then rename the old folder: type `mv ~/LocalFlix-main ~/LocalFlix-old`. Open the new ZIP as in Step 5. If you want to keep your saved settings, copy the file `config.json` from the old folder into the new folder:

```
cp ~/LocalFlix-old/config.json ~/LocalFlix-main/
```

If that command says the file does not exist, you have nothing to copy. That is fine.

## Fixes for common problems on the phone

Find the message or problem you see. Then follow the steps under it. For problems that are not about the phone, see [Fixes for common problems](troubleshooting.md). **Remember:** the Windows fixes there (firewall, PowerShell, `py`) are **not for a phone**.

### `pkg: command not found` or `python: command not found`

You are not inside Termux, or the install is not finished. Open the **Termux** app. Do Step 3 again.

### `pkg update` cannot download (mirror or repository error)

Type `termux-change-repo`, choose a mirror, and try again. If it is still not working, you may have the old Termux from the Play Store. Remove it and install Termux again from F-Droid or GitHub (Step 1).

### `No module named flask` (or `waitress`)

The parts are not installed. Do Step 6 again. Make sure you typed `pip install flask waitress charset-normalizer`.

### Termux cannot see my movies (`No such file or directory`, `Permission denied`)

1. Type `termux-setup-storage` and tap **Allow**.
2. If there was no question, open phone **Settings**, **Apps**, **Termux**, **Permissions**, and allow **Files and media** (or **Storage**).
3. Type `ls ~/storage/shared`. You must see your folders.
4. Check the movie folder name. Capital letters matter. `Movies` and `movies` are different.
5. Do not put your movies in the hidden folder `Android/data`. Put them in a normal folder like `Movies`.

### `(0 found)`, or no movies show

The folder is wrong or has no video files. Check the name in the start text. Stop LocalFlix (**CTRL then c**) and start it again with the right folder. If a folder name has spaces, keep the quote marks: `--movies "$HOME/storage/shared/My Films"`.

### The Direct IP line shows `127.0.0.1`, or a number that does not work

This is a known problem on phones. The program cannot read the phone address well. Read the address in **Settings**, **Wi-Fi**, your network. See [Step 10.1](#101-find-the-real-address-of-the-server-phone).

### `Could not start on port 8080`

Another program uses that number. Or an old LocalFlix is still running in another Termux window. Close the other window, or start on another number:

```
python localflix.py --movies "$HOME/storage/shared/Movies" --no-browser --port 8090
```

Then use `8090` in the addresses on your phone and TV.

### Other phones or the TV cannot connect

1. Both devices must use the **exact same Wi-Fi**. Not one on a guest network and one on the main network.
2. LocalFlix must be running on the server phone. Open `http://localhost:8080` on the server phone first. If it does not open, LocalFlix is not running.
3. Check the address. Read it again in **Settings** on the server phone. It may have changed.
4. The server phone must be on Wi-Fi, not only on mobile data.
5. Turn off any **VPN** app on the server phone and try again. Some VPN apps block other devices.
6. Some routers block devices from seeing each other. This is called **AP isolation** or **client isolation**. Turn it off in the router settings. See [Fixes for common problems](troubleshooting.md#err_address_unreachable-or-the-address-cannot-be-found).
7. The phone browser on the other phone must use `http://` and not `https://`.

### It works for a few minutes, then stops

The phone fell asleep, or Android closed Termux. Do all of Step 8 again: the wake lock, the battery setting for Termux, and the charger. Keep the phone screen on if it still stops. Do not swipe Termux away.

### `[Process completed (signal 9)]`, or `Killed`

Android stopped the program. See [8.4](#84-if-termux-still-gets-closed-newer-android).

### The phone becomes hot, or the movies stop and start

- Take off the phone case. Put the phone in a cool place.
- Do not convert movies on the phone. Use movies the TV can play directly (for example MP4).
- If many devices watch at the same time, try one device at a time.
- Use the 5 GHz Wi-Fi if your router has it. It is faster.

### There are no posters (pictures), or it is slow to start

Posters need ffmpeg, and may need the internet. If there is no internet, add `--no-online` when you start. The movies still play.

### My movies are on an SD card and I cannot see them

1. Type `termux-setup-storage` again.
2. Type `ls ~/storage`. Look for `external-1`.
3. Type `ls ~/storage/external-1`. If you see nothing, your phone may hide the SD card from Termux. Copy the movies to the phone memory (the Movies folder) with the phone Files app.

## What to read next

- [Use a phone hotspot instead of a router](hotspot.md): when you have no router or no Wi-Fi at home.
- [Your movie folder](library.md): how to name folders and files.
- [Subtitles](subtitles.md): add subtitles and fix the timing. (The folder addresses there use `C:\`. On the phone, use addresses like `~/storage/shared/Movies/subtitle`.)
- [Android TV app](tv-app.md): put the LocalFlix app on your TV. (Needs a computer, once.)
- [Fixes for common problems](troubleshooting.md): when something does not work.

## Quick reference

```
# Allow Termux to see your files (one time)
termux-setup-storage

# Keep the phone awake (every time you open Termux)
termux-wake-lock

# Start LocalFlix
cd ~/LocalFlix-main
python localflix.py --movies "$HOME/storage/shared/Movies" --no-browser

# Start without using the internet
python localflix.py --movies "$HOME/storage/shared/Movies" --no-browser --no-online

# Use another port number
python localflix.py --movies "$HOME/storage/shared/Movies" --no-browser --port 8090
```

To stop: **CTRL then c**.

Settings that work on a phone: `--movies`, `--subtitles`, `--port`, `--tmdb-key`, `--no-online`, `--no-browser`, `--local-only`.

Settings that do **not** work or are not needed on a phone: `--firewall`, `--remote-admin`.

LocalFlix is for personal use on your home network.
