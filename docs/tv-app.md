# Android TV app

The LocalFlix TV app shows the same LocalFlix page as the browser. It plays movies with a better player, so it opens more kinds of files than a TV browser. You control it only with the remote (arrow keys, OK, Back). No mouse pointer appears.

This guide is for **Android TV** and **Google TV**. Many Sony, TCL, Hisense, Philips and Xiaomi TVs use one of these, and so do the Chromecast with Google TV and the Nvidia Shield. Samsung and LG TVs do **not**. For those, use the TV browser. If you are not sure, look for the Google Play Store on your TV.

The TV app is **optional**. You can also use the TV browser (see [Step 11 in the setup guide](setup-guide.md#step-11-open-localflix-on-a-tv)).

It takes about 45 to 90 minutes the first time. You do it once.

## Before you start

> **No laptop?** Making the app file needs Android Studio, and Android Studio runs only on a computer. A phone cannot do it. Ask someone with a computer to make the app file once, or use the TV browser. The app then works with a phone server. See [Use an Android phone as the server](phone-server.md#step-11-open-localflix-on-a-tv).

You need:

- LocalFlix working on the laptop. Finish [the setup guide](setup-guide.md) up to Step 8 first.
- The TV on the same Wi-Fi as the laptop.
- The address of your TV (you will find it in Part 2).
- About 8 GB of free space on the laptop for Android Studio and the files it downloads.

## How it works

The LocalFlix project has the TV app inside it. You use a free program called **Android Studio** to turn the project into an **app file** (it ends with `.apk`). Then you send the app file to your TV.

## Part 1. Make the app file

### 1.1 Install Android Studio

1. Open **https://developer.android.com/studio** in your browser.
2. Download Android Studio. Open the file you downloaded.
3. Follow the screens. Choose the standard choices. Click **Next** and **Finish**.
4. Open Android Studio. The first time, it downloads more files. Wait until it finishes. This can take several minutes.

### 1.2 Open the LocalFlix project

1. In Android Studio, click **Open**. (If a project is already open, choose **File**, then **Open**.)
2. Choose your **LocalFlix folder** (the one that has the `app` folder and `settings.gradle` inside).
3. Click **OK**.
4. If Android Studio asks "Trust this project?", click **Trust Project**.
5. Wait. At the bottom of the window you see a progress bar. The first time, Android Studio downloads many files and this can take 5 to 15 minutes. Wait until the bar is gone.

> **If it does not work:**
> - A message says a part is missing (for example an Android "SDK platform") and has a blue link such as **Install**. Click the link and follow the screens.
> - A red message says the sync failed. Check that you have internet. Click **Try Again** (or **File**, then **Sync Project with Gradle Files**).

### 1.3 Build the app file

1. In the top menu, click **Build**.
2. Choose **Generate App Bundles or APKs**, then **Generate APKs**.
   - In an older Android Studio, the menu says **Build Bundle(s) / APK(s)**, then **Build APK(s)**.
3. Wait. At the bottom right, a message says that the APK was generated. Click **locate** in that message.

The app file is here:

```
app\build\outputs\apk\debug\app-debug.apk
```

This path starts inside your LocalFlix folder. Do not delete this file yet.

## Part 2. Get the TV ready

You must turn on "developer mode" on the TV. This lets your laptop send an app to the TV. Menu names are a little different on each TV. These are the usual ones:

1. On the TV, open **Settings**, then **Device Preferences**, then **About**. (On some TVs: **Settings**, **System**, **About**.)
2. Find **Build** (it may say **Android TV OS build**). Press **OK** on it **7 times**. A message says "You are now a developer".
3. Go back. Open **Developer options**. (It is in **Device Preferences** or in **System**.)
4. Turn on **USB debugging**.
5. Turn on **ADB debugging over network**, or **Network debugging**, or **Wireless debugging**. The name depends on your TV.
6. The TV shows an address with a number, for example `192.168.1.34:5555`. **Write it down.** This is the TV address.

You can also see the TV address in **Settings**, **Network & Internet**, your Wi-Fi name.

## Part 3. Send the app to the TV

Choose **Way A** first. If it does not work, use **Way B**.

### Way A. Send it from the laptop (ADB)

ADB is a small free tool that sends the app to the TV. Android Studio already put it on your laptop.

1. Open **PowerShell in the LocalFlix folder** (see [the setup guide](setup-guide.md#b-open-powershell-in-the-localflix-folder)).
2. Type this line and press Enter. It tells PowerShell where ADB is:

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
```

3. Connect to the TV. Use **your** TV address from Part 2:

```powershell
& $adb connect 192.168.1.34:5555
```

> **You should see:** `connected to 192.168.1.34:5555`.

4. Look at the TV screen. It may ask **Allow USB debugging?** Choose **Always allow from this computer**, then **OK** (or **Allow**).
5. Send the app:

```powershell
& $adb install -r "app\build\outputs\apk\debug\app-debug.apk"
```

> **You should see:** the word `Success`.

The **LocalFlix** icon now appears on the TV home screen. If you do not see it, open the list of all apps.

The `-r` in the command keeps the saved server address when you update the app later.

> **If it does not work:**
> - PowerShell says it cannot find `adb.exe`: your Android Studio is in another place. Open **https://developer.android.com/tools/releases/platform-tools**, download the platform-tools ZIP, extract it, and change the first command to point to the `adb.exe` inside that folder.
> - `unable to connect` or `connection refused`: check that the TV is on, that **ADB debugging over network** is on, and that the address is right. Try again.
> - Newer TVs show **Wireless debugging** with a **pairing code**. Choose **Pair device with pairing code**. The TV shows an address and a 6 digit code. Run `& $adb pair ADDRESS:PORT`, type the code, and then run `& $adb connect` with the address shown on the main Wireless debugging screen. The pairing port and the connect port are different numbers.
> - `INSTALL_FAILED_...` or `device unauthorized`: look at the TV screen, and allow the connection from your laptop. Then run the install command again.

### Way B. Use a USB stick

1. Copy `app-debug.apk` to a USB stick.
2. Put the USB stick in the TV.
3. On the TV, open a file manager app. If you do not have one, install a free one from the Play Store on the TV (for example "File Commander" or "X-plore").
4. Open the USB stick and choose `app-debug.apk`.
5. The TV may say it cannot install apps from this source. Choose **Settings**, and turn on **Allow from this source**. Go back and choose **Install**.

The **LocalFlix** icon appears on the TV home screen.

## Part 4. First start of the TV app

1. Make sure LocalFlix is running on the laptop.
2. On the TV, open **LocalFlix**.
3. The app first checks the address it saved. Then it looks for the laptop by itself. This takes about 2 seconds.
4. If it finds the laptop, the LocalFlix page opens. You type nothing.
5. If not, a screen asks for the address. Type the **Direct IP** shown in the laptop window, for example `192.168.1.10` (or `http://192.168.1.10:8080`). Press **Connect**.
6. The app saves the address after the laptop answers.

If the laptop is off, or the address is wrong, a friendly screen with **Retry** shows. It does not show an ugly browser error. Turn on LocalFlix on the laptop and press **Retry**.

### Change the laptop address later

- Press the **Menu** key on the remote (any time), or
- open **Settings** (the sliders icon at the top right) and choose **Change TV server...**

## Part 5. Using the app

Choose the LocalFlix logo or the **Home** tab: the app looks for new movies, so you do not need to restart anything.

| Remote button | When you browse | While a movie plays |
|---|---|---|
| Arrow keys | Move the blue ring | Left or Right: go back or forward 10 seconds (hold for bigger steps). Up or Down: show the controls, then move between the time bar and the buttons. |
| OK | Open the movie or button | Controls hidden: pause or play. Controls shown: press the chosen button. |
| Back | Close the search list, a window or a screen. On the Home screen it closes the app. | Closes the Subtitles or Audio list, then hides the controls, then closes the player. |
| Menu | Change the laptop address | |
| Media keys | | Play, Pause, Play/Pause, Rewind, Fast-forward, Next, Previous, Stop |

In the player, the **Subtitles** and **Audio** buttons open a list. Subtitles stay off until you choose one. The app remembers your choice. See [Subtitles](subtitles.md) for size, position and delay.

**Movies that the TV cannot play** (for example some AVI files, or HEVC without hardware help): if ffmpeg is installed on the laptop (Step 4 of the setup guide), the app says "Converting for this TV..." and plays a converted movie. Jumping forward or back takes a moment in a converted movie, because it starts again. Without ffmpeg, a clear message appears.

**Where you stopped** is saved. The app offers it next time. When a movie in a folder ends, an **Up next** question appears.

## Update the app later

Build a new app file (Part 1.3) and run the install command again (Part 3, Way A). The `-r` keeps your saved laptop address.

## Test list

Use this list after you build the app. It checks that everything works.

1. New install, laptop running: the app finds the laptop by itself and shows the LocalFlix page (same colours, tabs, posters and search as the browser).
2. New install, laptop **not** running: the connect screen shows, with **Retry** and an address box (not a browser error). Start LocalFlix, press **Retry**: it connects.
3. Type a wrong address and press **Connect**: a clear message appears, and nothing is saved.
4. No mouse pointer appears anywhere, in the pages or in the player.
5. The arrow keys move the blue ring between tabs, search, buttons and movies in the right direction. Nothing gets stuck (also in Browse, Search and Settings).
6. OK on a movie opens its details. OK on **Play** starts the player.
7. In the player: Left and Right jump, OK pauses, Up and Down show the controls. The controls hide after about 4 seconds.
8. Back, in the player: first the list closes, then the controls hide, then the player closes. Back, in the pages: first a window closes, then the screen before, and on Home the app closes.
9. Play an AVI or HEVC file: the app says "Converting for this TV..." (needs ffmpeg). Without ffmpeg, a clear message appears.
10. Subtitles: choose Off, then one track, then another. Audio: choose another track (in a converted movie it starts again).
11. Stop a movie halfway and open it again: it continues from there. After the last file in a folder, **Up next** appears (OK plays it).
12. After the player closes, the blue ring is on the movie you came from.
13. In the search box, OK opens the on-screen keyboard.
14. The logo and **Home** look for new movies and show a short message.
15. Press **Menu**: the server screen opens. Back returns to the page.
16. Open the same address on a phone or laptop browser: it works as before.
17. Update the app with the install command (with `-r`): the saved address is still there.

If something does not work, see [Fixes for common problems](troubleshooting.md).
