# Installation

## Requirements

| Item | Details |
|---|---|
| Windows 10 or 11 laptop | The server. It has to stay on while you watch. |
| Python 3.10 or newer | Free from python.org |
| ffmpeg | Optional, but recommended |
| Movie files | MP4, MKV, AVI, MOV and similar |
| A phone, tablet or TV | Any device on the same Wi-Fi |

## Python

1. Download Python from https://www.python.org/downloads/
2. In the installer, tick "Add python.exe to PATH" before you click Install.
3. Check it in PowerShell:

```powershell
py --version
```

## Dependencies

Open PowerShell in the LocalFlix folder and run:

```powershell
py -m pip install -r requirements.txt
```

| Package | Use |
|---|---|
| `flask` | The web server (required) |
| `waitress` | A faster, steadier server |
| `charset-normalizer` | Reads subtitle files in other languages |
| `zeroconf` | Lets iPhone, Mac and Windows open `http://localflix.local:8080` |

## ffmpeg

ffmpeg grabs poster images from your video files and converts formats that browsers and TVs cannot play, such as AVI and WMV. LocalFlix runs without it.

1. Download `ffmpeg-master-latest-win64-gpl.zip` from https://github.com/BtbN/FFmpeg-Builds/releases
2. Extract it, for example to `C:\ffmpeg`.
3. Add `C:\ffmpeg\bin` to the system Path: press Win + S, search "environment variables", open "Edit the system environment variables", click "Environment Variables", select Path under System variables, click Edit, then New.
4. Open a new PowerShell window and check:

```powershell
ffmpeg -version
```

## First run

```powershell
py localflix.py
```

The startup banner looks like this:

```
 LocalFlix 2.0.1
 Movies     : C:\Users\you\Videos\Movies  (101 found)
 Subtitles  : C:\Users\you\Videos\Movies\subtitle  (90 files)
 ffmpeg     : found
 This computer   ->  http://localhost:8080
 Apple/Windows   ->  http://localflix.local:8080
 Direct IP       ->  http://192.168.1.33:8080
 Android / TV: scan the QR at  http://localhost:8080/qr
```

The browser opens on the laptop. Type the Direct IP on phones and TVs. Your numbers will differ.

## Options

| Option | Effect |
|---|---|
| `--movies "D:\Films"` | Use another movie folder |
| `--subtitles "D:\Subs"` | Use another subtitle folder |
| `--port 9000` | Use another port (default 8080) |
| `--tmdb-key KEY` | Use a free TMDB key for better posters |
| `--no-online` | Never contact the internet |
| `--no-browser` | Do not open the browser on start |
| `--local-only` | Accept connections from this computer only |
| `--remote-admin` | Let other devices change the folder settings |
| `--firewall` | Allow the port through Windows Firewall, then exit |

Next: [organise your movie folder](library.md), then [open the firewall](network.md).
