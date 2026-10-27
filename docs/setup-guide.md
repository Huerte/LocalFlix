# Complete setup guide

This guide takes you from nothing to watching your own movies on your phone or TV.

You do not need to know about computers. Follow the steps in order. Do one step at a time. Take your time.

The first time, it takes about 30 to 60 minutes.

> **No laptop?** Use an Android phone as the server. See [Use an Android phone as the server](phone-server.md).
>
> **No router?** Use a phone hotspot. See [Use a phone hotspot instead of a router](hotspot.md).

## Before you start

### How LocalFlix works

```
[Your laptop]  LocalFlix is running here. The movies are here too.
      |
      |   same Wi-Fi at home
      |
[Phone / Tablet / TV]  Open LocalFlix here and watch.
```

- Your movies stay on your laptop.
- LocalFlix runs on the laptop and shares the movies on your home Wi-Fi.
- Your phone, tablet or TV opens LocalFlix like a web page.
- The laptop must be **on**, and LocalFlix must be **running**, while you watch.
- Nothing goes to the internet. You do not need an account.

### What you need

| Item | Notes |
|---|---|
| A Windows laptop | Windows 10 or Windows 11. It stays on while you watch. |
| Your movie files | MP4, MKV, AVI, MOV and similar files |
| A phone, tablet or TV | It must use the same Wi-Fi as the laptop |
| Internet | Only for the setup, to download the free programs |
| About 1 GB of free space | For the programs LocalFlix needs |

### How to read this guide

- Text in a grey box is either something you **type** or an example of what you will **see**. The words just before the box tell you which one. When you must type it, type it exactly as shown, or copy and paste it.
- **You should see:** tells you what the screen looks like when the step worked.
- **If it does not work:** tells you what to do when it did not.

### Words used in this guide

| Word | What it means |
|---|---|
| PowerShell | A window where you type a command and press Enter. It is already on your laptop. |
| Command | A line of text you type in PowerShell to ask the laptop to do something. |
| Folder address | The text that shows where a folder is. Example: `C:\Users\Anna\Documents` |
| Router | The box from your internet company that makes your Wi-Fi. |
| IP address | The number address of a device on your Wi-Fi. Example: `192.168.1.33` |
| Firewall | The part of Windows that protects your laptop. It can block other devices. |
| Administrator | A special mode in Windows. A few steps need it. |

### Quick checklist

Use this list to see where you are. Each line is a step in this guide.

- [ ] Step 1. Install Python
- [ ] Step 2. Get LocalFlix
- [ ] Step 3. Install the parts LocalFlix needs
- [ ] Step 4. Install ffmpeg
- [ ] Step 5. Put your movies in one folder
- [ ] Step 6. Start LocalFlix
- [ ] Step 7. Let phones and TVs connect
- [ ] Step 8. Give the laptop an address that does not change
- [ ] Step 9. Stop the laptop from sleeping
- [ ] Step 10. Open LocalFlix on a phone or tablet
- [ ] Step 11. Open LocalFlix on a TV

## Learn these things first

Many steps use PowerShell. You will open it in three different ways. Read this part once. You can come back to it later.

### A. Open a normal PowerShell window

1. Press the **Windows key** on your keyboard.
2. Type `PowerShell`.
3. Press **Enter**.

A window opens, blue or black, with some text. You can type here.

### B. Open PowerShell in the LocalFlix folder

Most steps need this one. It opens PowerShell already inside the LocalFlix folder.

1. Open the LocalFlix folder in File Explorer (you will get this folder in Step 2).
2. Click the **address bar** at the top of the window. This is the long box that shows the folder address.
3. The address turns blue. Type `powershell` and press **Enter**.

A PowerShell window opens. The first line in the window ends with the name of your LocalFlix folder. We call this "PowerShell in the LocalFlix folder".

On Windows 11 you can also right-click an empty place inside the folder and choose **Open in Terminal**.

### C. Open PowerShell as administrator

Only Step 7 needs this.

1. Press the **Windows key**.
2. Type `PowerShell`.
3. Right-click **Windows PowerShell**. Choose **Run as administrator**.
4. Windows asks "Do you want to allow this app to make changes?". Click **Yes**.

The window title says "Administrator". This window starts in a different folder, so Step 7 shows you how to go to the LocalFlix folder.

### How to type and paste in PowerShell

- To run a command: type it, then press **Enter**.
- To paste text you copied: **right-click** inside the window. You can also press **Ctrl+V**.
- After you press Enter, wait. When the window shows a new line that ends with `>` and the cursor blinks, the command is finished.
- To stop a program that is running: click the window, then press **Ctrl+C**.

## Step 1. Install Python

Python is a free program. LocalFlix needs it to run.

1. Open your web browser and go to **https://www.python.org/downloads/**
2. Click the big yellow button to download Python. A file downloads.
3. Open the downloaded file. It is in your **Downloads** folder.
4. Follow the screens.
   - If you see a box called **Add python.exe to PATH**, tick it. It is at the bottom. This is important.
   - If you see a button called **Install** or **Install Now**, click it.
   - If a question asks you to press `Y` or says "Install", say yes.
5. Wait until it says it is finished. Click **Close**.

Python now has two kinds of installer. The new one is called "Python install manager". The old one is a normal installer window. Both work for LocalFlix. You can use the one you get.

Now check that it worked. Open a **new** normal PowerShell window (see A above) and type:

```powershell
py --version
```

> **You should see:** something like `Python 3.14.2`. Any number that starts with 3.10 or higher is fine.

> **If it does not work:**
> - Windows says it does not know `py`: close all PowerShell windows and open a new one. A window that was already open does not see the new program.
> - Still not working: run the Python installer again. If it has the box **Add python.exe to PATH**, tick it.

## Step 2. Get LocalFlix

1. Open the LocalFlix page on GitHub in your browser.
2. Click the green **Code** button.
3. Click **Download ZIP**. A ZIP file downloads.
4. Open your **Downloads** folder. Right-click the ZIP file. Choose **Extract All**.
5. Windows asks where to put the files. Click **Browse** and choose a place you will not delete, for example your **Documents** folder. Click **Extract**.

You now have a folder called `LocalFlix-main`. This is your **LocalFlix folder**. Open it.

> **You should see:** files such as `localflix.py`, `README.md` and `requirements.txt`, and folders such as `docs` and `static`.

> **If it does not work:** if you only see one more folder called `LocalFlix-main` inside, open that one. The LocalFlix folder is the one that has `localflix.py` inside.

Do not move or rename this folder later. Some settings are saved inside it.

## Step 3. Install the parts LocalFlix needs

LocalFlix uses a few small free parts. This command downloads them. You need internet for this step.

1. Open **PowerShell in the LocalFlix folder** (see B above).
2. Type this and press Enter:

```powershell
py -m pip install -r requirements.txt
```

Many lines appear. Wait until they stop. It can take one or two minutes.

> **You should see:** the last line says `Successfully installed` and some names.

> **If it does not work:**
> - A yellow message about a new version of `pip` is not a problem. Ignore it.
> - Red text and the word `error`: check that you have internet and try the same command again.
> - Windows says it does not know `py`: go back to Step 1.

What these parts do:

| Part | What it does |
|---|---|
| `flask` | Runs LocalFlix. It is required. |
| `waitress` | Makes LocalFlix faster and steadier |
| `charset-normalizer` | Reads subtitle files in other languages correctly |
| `zeroconf` | Lets iPhone, Mac and Windows open `http://localflix.local:8080` |

## Step 4. Install ffmpeg

ffmpeg is a free helper program. LocalFlix can work without it, but we strongly suggest you install it. With ffmpeg:

- LocalFlix makes poster pictures from your videos.
- LocalFlix can change a movie that your TV cannot play (for example AVI or WMV files) so that it plays.

This step has many small parts. Go slowly.

### 4.1 Download it

1. Open **https://github.com/BtbN/FFmpeg-Builds/releases/tag/latest** in your browser.
2. Scroll down to the list of files. Find the file called **`ffmpeg-master-latest-win64-gpl.zip`**.
3. Click the file name to download it. It is a big file, about 180 MB. Wait for it to finish.

> **If it does not work:** if you do not see the file, click **Show all assets** at the bottom of the list.

### 4.2 Put it in the right place

1. Open your **Downloads** folder. Right-click the ZIP file. Choose **Extract All**, then click **Extract**.
2. A new folder opens. Its name starts with `ffmpeg-master-latest-win64-gpl`. Inside it, you can see a folder called `bin`.
3. Go back one level. Right-click the folder that starts with `ffmpeg-master-latest...` and choose **Cut**.
4. Open **This PC**, then open the **C:** drive. Right-click an empty place and choose **Paste**.
5. Right-click the pasted folder. Choose **Rename**. Type `ffmpeg` and press Enter.
6. Open the `C:\ffmpeg` folder, then the `bin` folder. Check that you can see files called `ffmpeg`, `ffplay` and `ffprobe`.

If Windows asks for permission to paste into the C: drive, click **Continue**.

### 4.3 Tell Windows where ffmpeg is

1. Press the **Windows key**. Type `environment variables`.
2. Click **Edit the system environment variables**.
3. A window opens. Click the button **Environment Variables...** (at the bottom).
4. Find the **lower** box called **System variables**. Click the line called **Path**. Click **Edit...**.
5. Click **New**. Type this, exactly:

```
C:\ffmpeg\bin
```

6. Click **OK**. Click **OK** again. Click **OK** one more time.

### 4.4 Check it

1. Close **all** PowerShell windows.
2. Open a **new** normal PowerShell window.
3. Type this and press Enter:

```powershell
ffmpeg -version
```

> **You should see:** `ffmpeg version` and some numbers and letters.

> **If it does not work:** Windows says it does not know `ffmpeg`.
> - Check that the folder is exactly `C:\ffmpeg` and that `C:\ffmpeg\bin` contains `ffmpeg`.
> - Check the line you typed in 4.3. It must be exactly `C:\ffmpeg\bin`.
> - Close PowerShell and open a new one.

## Step 5. Put your movies in one folder

Put all your movies in **one folder**. You can have more folders inside it. For example:

```
C:\Users\YourName\Videos\Movies
```

Every folder inside your movie folder becomes a group (a category) in LocalFlix, for example Horror or Comedy. To learn how folder names and file names work, read [Your movie folder](library.md). You can read it later.

## Step 6. Start LocalFlix

1. Open **PowerShell in the LocalFlix folder** (see B above).
2. Type this and press Enter:

```powershell
py localflix.py
```

### The first time: LocalFlix asks for your movie folder

The first time, LocalFlix may say it cannot find your movie folder. Then it asks:

```
Type the full path of your movie folder (or press Enter to quit):
```

This means: "Type the folder address of your movies."

1. Open your movie folder in File Explorer.
2. Click the **address bar** at the top. The address turns blue.
3. Press **Ctrl+C** to copy it.
4. Click inside the PowerShell window. **Right-click** to paste.
5. Press **Enter**.

LocalFlix saves the folder. It does not ask again.

You can also give the folder in the command. Use your own folder address:

```powershell
py localflix.py --movies "D:\Films"
```

### Windows may show a warning window

The first time, Windows may show a window that says Windows Defender Firewall has blocked some features of Python. Click **Allow access**. If you click Cancel, Windows makes a hidden block that Step 7 removes.

### What you should see

After a few seconds you see a block of text like this:

```
 --------------------------------------------------------------
  LocalFlix 2.0.1
 --------------------------------------------------------------
  Movies     : C:\Users\you\Videos\Movies  (101 found)
  Subtitles  : C:\Users\you\Videos\Movies\subtitle  (90 files)
  ffmpeg     : found
 --------------------------------------------------------------
  This computer   ->  http://localhost:8080
  Apple/Windows   ->  http://localflix.local:8080
  Direct IP       ->  http://192.168.1.33:8080
 --------------------------------------------------------------
  Press Ctrl+C to stop.
```

Your web browser opens by itself and shows your movies.

Look at the line **Direct IP**. The address after the arrow is the address you will type on your phone and TV. **Your numbers will be different. This is normal.**

> **If it does not work:**
> - `(0 found)` or no movies in the browser: the movie folder is wrong or empty. Press Ctrl+C, and start again with `py localflix.py --movies "your folder address"`.
> - `ffmpeg : not found`: do Step 4 again, then close PowerShell and open a new one.
> - `Could not start on port 8080`: another program uses that number. Type `py localflix.py --port 8090` instead.

### Important

**Keep this window open.** If you close it, LocalFlix stops. To stop LocalFlix on purpose, click the window and press **Ctrl+C**.

## Step 7. Let phones and TVs connect

Windows protects your laptop with a firewall. It can block your phone and TV. You must allow LocalFlix **one time** on each laptop. This step has two parts, and you need both.

### 7.1 Open PowerShell as administrator

See C above. The window title must say **Administrator**.

### 7.2 Go to the LocalFlix folder

The administrator window does not start in your LocalFlix folder. So you must go there.

1. Open the LocalFlix folder in File Explorer.
2. Click the address bar. Press **Ctrl+C** to copy the folder address.
3. In the administrator window, type `cd ` (the letters c and d, then one space). Do not press Enter yet.
4. Type a quote mark `"`. Right-click to paste the address. Type a quote mark `"` again.
5. Press **Enter**.

It looks like this (your address will be different):

```powershell
cd "C:\Users\YourName\Documents\LocalFlix-main"
```

> **You should see:** the line in the window now ends with `LocalFlix-main>`.

### 7.3 Allow LocalFlix

Type this and press Enter:

```powershell
py localflix.py --firewall
```

> **You should see:** `Firewall rules added. Phones and TVs on your Wi-Fi can now connect.`

### 7.4 Remove the hidden block

The first time Windows sees Python use the network, it can quietly add a block for Python. That block is stronger than the allow rule from 7.3. Your phone and TV still cannot connect, and they show `ERR_CONNECTION_REFUSED`. This command removes the block:

```powershell
powershell -ExecutionPolicy Bypass -File .\fix_firewall.ps1
```

> **You should see:** green text that ends with `Done. Restart localflix.py and try from your phone again.` If there was a block, you also see yellow text `Removing block rule`.

### 7.5 Check (optional)

This command should show **nothing**. Nothing means there is no block:

```powershell
Get-NetFirewallRule -Action Block -Enabled True -Direction Inbound |
    Get-NetFirewallApplicationFilter |
    Where-Object { $_.Program -like "*python*" }
```

### 7.6 Start LocalFlix again

Close the administrator window. Close the LocalFlix window (press Ctrl+C in it first). Start LocalFlix again as in Step 6.

> **If it does not work later:** see [Fixes for common problems](troubleshooting.md).

## Step 8. Give the laptop an address that does not change

Every device on your Wi-Fi has an address made of numbers, like `192.168.1.33`. This is the **IP address**.

Your router can give the laptop a **new** address at any time. When this happens, the address you saved on your phone or TV stops working.

To stop this, make the laptop keep the **same** address all the time. Only the laptop needs this. Phones and TVs can change as they like.

There are two ways. Do **one** of them.

> **Using a phone hotspot instead of a router?** Skip this step. Both ways need a router or a normal Wi-Fi. They do not work with a hotspot. See [Use a phone hotspot](hotspot.md).

| Way | Good | Not so good |
|---|---|---|
| **A. Ask the router** | Clean. Does not change the laptop. | Every router looks different. Some are hard to use. |
| **B. Set it on the laptop** | Always works. | You must undo it when you use other Wi-Fi (school, work, cafe). |

If you are not sure, try A first. If A does not work, use B.

### 8.1 Collect some information first

1. Open a normal PowerShell window.
2. Type this and press Enter:

```powershell
ipconfig /all
```

3. A lot of text appears. Scroll up and find the part called **Wireless LAN adapter Wi-Fi**.
4. Write down these four things from that part:

| Name | Example | What it is |
|---|---|---|
| IPv4 Address | `192.168.1.33` | The address of the laptop now |
| Subnet Mask | `255.255.255.0` | Part of the address |
| Default Gateway | `192.168.1.1` | The address of your router |
| Physical Address | `A1-B2-C3-D4-E5-F6` | The ID of your laptop (it is also called the MAC address) |

### 8.2 Stop Windows from using a random ID

Windows can use a random ID for privacy. Then the router does not know your laptop. Turn it off:

1. Open **Settings**.
2. Click **Network & internet**, then **Wi-Fi**.
3. Click the name of your Wi-Fi network.
4. Find **Random hardware addresses** and set it to **Off**.

### Way A. Ask the router to keep the address

You tell the router: "Always give this laptop the same address."

1. On the laptop, open a web browser. In the address box, type the **Default Gateway** from 8.1, for example `http://192.168.1.1`, and press Enter.
2. Log in to the router. The user name and password are often printed on a sticker on the router.
3. Find the page about the local network. It may be called **LAN Settings**. Look at **DHCP Start IP** and **End IP**. This is the group of addresses the router gives out. Example: from `192.168.1.33` to `192.168.1.254`.
4. Find the button or page for reserving an address. The name is different on each router. Look for **Edit Reserved IP Address**, **Address Reservation**, **Static DHCP** or **DHCP Binding**.
5. Enter these two things:
   - **IP address:** the IPv4 Address of your laptop, for example `192.168.1.33`
   - **MAC address:** the Physical Address from 8.1
6. Click **Add**. A new line must appear in the table.
7. Click **Apply Changes** or **Save** on the main page. Some routers restart. Wait one or two minutes.
8. Turn the laptop Wi-Fi off. Wait 10 seconds. Turn it on.
9. Open PowerShell and type `ipconfig`. Check that the IPv4 Address is still the same.

If no new line appears:

- Use the address your laptop has now. It is inside the group of addresses. A random lower number often does not work.
- Try the Physical Address in another style. With dashes: `A1-B2-C3-D4-E5-F6`. With colons: `A1:B2:C3:D4:E5:F6`. With no symbols: `A1B2C3D4E5F6`. Use capital letters.
- Refresh the page after you click Add.
- If it still does not work, use Way B.

### Way B. Set the address on the laptop

You tell Windows to use one fixed address and to stop asking the router.

Choose an address that is **outside** the group the router gives out. Then no other device can take it. Example: if the group starts at `192.168.1.33`, use `192.168.1.10`.

1. Press the **Windows key**. Type `ncpa.cpl`. Press **Enter**.
2. Right-click **Wi-Fi**. Choose **Properties**.
3. Double-click **Internet Protocol Version 4 (TCP/IPv4)**.
4. Choose **Use the following IP address**. Fill in:

| Field | What to type |
|---|---|
| IP address | `192.168.1.10` |
| Subnet mask | `255.255.255.0` |
| Default gateway | your Default Gateway from 8.1, for example `192.168.1.1` |

5. Choose **Use the following DNS server addresses**. Fill in:

| Field | What to type |
|---|---|
| Preferred DNS server | `8.8.8.8` |
| Alternate DNS server | `1.1.1.1` |

6. Click **OK**. Click **Close**.
7. Open PowerShell and type `ipconfig`. Check that the IPv4 Address is `192.168.1.10`.

**Be careful.** This setting stays on your Wi-Fi for every network. At school, at work or in a cafe, the internet will not work. To go back to normal: open the same window again. Choose **Obtain an IP address automatically** and **Obtain DNS server address automatically**. Click **OK**.

If you use your own numbers (not `192.168.1.x`), copy the first three groups from your own IPv4 Address. For example, if your laptop is `192.168.0.25`, use `192.168.0.10`.

### 8.3 Check it

1. Stop LocalFlix (click its window and press **Ctrl+C**). Start it again with `py localflix.py`.
2. The **Direct IP** line must show your fixed address, for example `http://192.168.1.10:8080`.
3. Use this address on all your devices. It will not change any more.

## Step 9. Stop the laptop from sleeping

When the laptop sleeps, LocalFlix stops, and your TV cannot reach it. Tell Windows not to sleep while it is plugged in.

**Windows 11:**

1. Open **Settings**. Click **System**, then **Power & battery**.
2. Open **Screen, sleep, & hibernate timeouts**.
3. Find **When plugged in, put my device to sleep after**. Choose **Never**.

**Windows 10:**

1. Open **Settings**. Click **System**, then **Power & sleep**.
2. Find **When plugged in, PC goes to sleep after**. Choose **Never**.

Keep the laptop plugged in while you watch. The screen can still turn off. That saves power.

**The lid:** closing the lid makes many laptops sleep. To change this, open **Control Panel**, then **Power Options**, then **Choose what closing the lid does**. For **When plugged in**, choose **Do nothing**.

## Step 10. Open LocalFlix on a phone or tablet

1. Make sure the phone uses the **same Wi-Fi** as the laptop. Do not use a guest network.
2. Make sure LocalFlix is running on the laptop.
3. Open Chrome, Firefox or Safari on the phone.
4. In the address box, type the **Direct IP** address, for example `http://192.168.1.10:8080`. Press Go.
5. Your movies appear.

> **If it does not work:** see [Fixes for common problems](troubleshooting.md). The most common reasons are: not the same Wi-Fi, LocalFlix is not running, or Step 7 is not done.

**Make an icon on an Android phone:** in Chrome, tap the three dots, then **Add to Home screen**. You get an icon that opens LocalFlix like an app.

### Three ways to connect

| Way | What to type | iPhone, iPad, Mac, Windows | Android phone, Android TV |
|---|---|---|---|
| Direct IP | `http://192.168.1.10:8080` | Works | Works |
| QR code | On the laptop, open `http://localhost:8080/qr`. Scan it with the phone camera. | Works | Works |
| Name | `http://localflix.local:8080` | Works | Usually does not work |

**The QR code way:** on the laptop, open `http://localhost:8080/qr`. You can also click the QR icon at the top right of LocalFlix. Scan the picture with your phone camera. It opens the right address. You type nothing.

**Android shows `DNS_PROBE_FINISHED_NXDOMAIN` for the name?** Nothing is wrong with your setup. Android does not understand names that end in `.local`. Use the Direct IP address.

## Step 11. Open LocalFlix on a TV

You have two choices.

### Choice 1. The TV browser (easy)

Most smart TVs (Samsung, LG, Sony, Hisense) have a browser app. It is often called **Internet** or **Browser**.

1. Open it.
2. Type the **Direct IP** address, for example `http://192.168.1.10:8080`. Do **not** use `localflix.local`.
3. Use the remote control:

| Remote button | What it does |
|---|---|
| Arrow keys | Move between movies |
| OK | Open a movie, or confirm |
| Back | Close the player, or go back |
| Left or Right while playing | Go back or forward 10 seconds |
| Up or Down while playing | Volume up or down |
| OK twice on the video | Full screen on or off |

The movie you choose has a bright blue glow, so you always see where you are.

### Choice 2. The LocalFlix TV app (better)

For an Android TV or Google TV, the LocalFlix app is much better. It plays more kinds of movies and is made for the remote. You build it once. See [Android TV app](tv-app.md).

### Before you open LocalFlix on the TV, check these

1. The TV uses the same Wi-Fi as the laptop, not a guest network.
2. LocalFlix is running on the laptop.
3. You finished Step 7.
4. You finished Step 8.
5. The laptop is plugged in and does not sleep (Step 9).

## Every day: start and stop LocalFlix

**To start:**

1. Turn on the laptop and connect to your home Wi-Fi.
2. Open the LocalFlix folder. Click the address bar. Type `powershell`. Press Enter.
3. Type `py localflix.py` and press Enter.
4. Open LocalFlix on your phone or TV.

**To stop:** click the PowerShell window and press **Ctrl+C**. Then close the window.

**Tired of typing?** LocalFlix can start by itself when you are home and your TV is on. See [Start LocalFlix by itself](tv-autostart.md).

## What to read next

- [Android TV app](tv-app.md): put the LocalFlix app on your TV.
- [Your movie folder](library.md): how to name folders and files.
- [Subtitles](subtitles.md): add subtitles and fix the timing.
- [Start LocalFlix by itself](tv-autostart.md): no typing every day.
- [Fixes for common problems](troubleshooting.md): when something does not work.

## Extra settings (you can skip this)

Add these after `py localflix.py`. Example: `py localflix.py --port 9000`

| Setting | What it does |
|---|---|
| `--movies "D:\Films"` | Use another movie folder |
| `--subtitles "D:\Subs"` | Use another subtitle folder |
| `--port 9000` | Use another port number. The normal one is 8080. |
| `--tmdb-key KEY` | Use a free TMDB key to get better posters |
| `--no-online` | Never use the internet |
| `--no-browser` | Do not open the browser when LocalFlix starts |
| `--local-only` | Only this laptop can open LocalFlix |
| `--remote-admin` | Let other devices change the folder settings |
| `--firewall` | Allow LocalFlix through Windows protection, then stop (Step 7) |

## Quick reference

```powershell
# Start LocalFlix
py localflix.py

# Use another movie folder
py localflix.py --movies "D:\Films"

# Start without opening the browser
py localflix.py --no-browser

# Use another port number
py localflix.py --port 9090

# Allow phones and TVs (PowerShell as administrator, one time)
py localflix.py --firewall
powershell -ExecutionPolicy Bypass -File .\fix_firewall.ps1
```

To show the QR code, open `http://localhost:8080/qr` on the laptop.

LocalFlix is for personal use on your home network.
