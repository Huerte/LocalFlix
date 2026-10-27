# Android TV app

The app shows the same LocalFlix page as the browser inside a WebView and plays video with the native ExoPlayer. It is controlled only with the remote (arrows, OK, Back, media keys), and no mouse cursor appears.

## Requirements

- Android Studio, free from https://developer.android.com/studio
- An Android TV on the same Wi-Fi as the laptop
- LocalFlix running on the laptop, with the [firewall rule](network.md) in place

## Build the APK

1. Open Android Studio, then File, Open, and select the LocalFlix folder.
2. Wait for the Gradle sync. The first one downloads files and takes a few minutes.
3. Build, Build Bundle(s) / APK(s), Build APK(s). Or in a terminal: `gradlew assembleDebug`
4. The APK is at `app\build\outputs\apk\debug\app-debug.apk`.

## Install it on the TV

Turn on developer mode on the TV:

1. Settings, Device Preferences, About. Press OK on Build seven times.
2. Settings, Device Preferences, Developer options. Turn on USB debugging and ADB debugging over network.
3. Note the address shown, for example `192.168.1.34:5555`.

Then install over the network:

```powershell
adb connect 192.168.1.34:5555
adb install -r "app\build\outputs\apk\debug\app-debug.apk"
```

The LocalFlix icon appears on the TV home screen. The `-r` flag keeps the saved server address when you update.

## First start

The app checks the saved address, then looks for the laptop by itself with a UDP broadcast on port 50505 (about 2 seconds). If it finds the laptop, the page opens. If not, type the Direct IP from the laptop window, for example `192.168.1.10` or `http://192.168.1.10:8080`, and press Connect. The address is saved once the server answers.

To change the server later, press Menu on the remote, or open Settings and choose "Change TV server...". If the laptop is off or the address is wrong, a Retry screen shows instead of a browser error.

## Using the app

Selecting the LocalFlix logo or the Home tab also rescans the library, so new movies show up without restarting anything.

| Remote | Browsing | While a video plays |
|---|---|---|
| Arrows | Move the focus ring | Left, Right: 10 s back or forward (hold for bigger steps). Up, Down: show the controls and move between the seek bar and buttons |
| OK | Open the item | Controls hidden: pause or play. Controls shown: press the selected button |
| Back | Close search suggestions, a window or a screen. At Home it exits | Close the Subtitles or Audio list, then hide the controls, then close the player |
| Menu | Change TV server | |
| Media keys | | Play, Pause, Play/Pause, Rewind, Fast-forward, Next, Previous, Stop |

In the player, Subtitles and Audio open a list. Subtitles stay off until you pick one, and the app remembers the choice. See [subtitles](subtitles.md) for size, position and delay.

If the TV cannot play a file, for example AVI or HEVC without hardware support, and ffmpeg is installed on the laptop, the app shows "Converting for this TV..." and plays a converted stream. Seeking in a converted stream takes a moment because it restarts. Where you stopped is saved and offered next time.

## Test checklist

1. Fresh install with the laptop running: the app finds it and shows the web UI.
2. Fresh install with the laptop off: the connect screen shows with Retry. Start LocalFlix, press Retry, and it connects.
3. A wrong address shows a clear message and is not saved.
4. Arrows move the focus ring through tabs, search, buttons and cards without getting stuck, also in Browse, Search and Settings.
5. OK on a movie opens details, and OK on Play starts the player.
6. Player: Left and Right seek, OK pauses, Up and Down show the controls, and they hide after about 4 seconds.
7. Back order in the player: list, controls, player. In the web UI: window, previous screen, exit at Home.
8. An AVI or HEVC file falls back to "Converting for this TV..." with ffmpeg, and shows a clear message without it.
9. Stop a movie halfway and open it again: it resumes. After the last file in a folder, "Up next" appears.
10. After the player closes, the focus ring is on the card you came from.
11. In the search box, OK opens the on-screen keyboard.
12. The logo and Home rescan the library and show a toast.
13. `adb install -r` keeps the saved address.
