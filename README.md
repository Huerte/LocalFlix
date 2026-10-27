# LocalFlix

Stream your personal movie library to any phone, tablet or TV on your home Wi-Fi. No account, no subscription.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.10%2B-3776AB.svg)](docs/installation.md)
[![Android TV](https://img.shields.io/badge/Android%20TV-app-3DDC84.svg)](docs/tv-app.md)

## About

LocalFlix is a small Flask server that runs on a Windows laptop. It scans one movie folder and serves it as a browsable site to any device on the same network. An Android TV app shows the same site and plays video with ExoPlayer, so it opens more file types than a TV browser. Nothing leaves your network, and playback does not need internet.

- Home rows built from your folders, Browse with filters, and search
- Posters taken from your video files (ffmpeg), or from TMDB if you give it a key
- Subtitles from a folder, from the video itself, or uploaded from your device
- Resume where you stopped, and a prompt for the next file in the folder
- Automatic conversion of files a device cannot play (needs ffmpeg)
- A TV app made for the remote, with no mouse cursor

## Quick start

You need Windows 10 or 11, Python 3.10 or newer, and ffmpeg (optional, recommended).

```powershell
py -m pip install -r requirements.txt
py localflix.py --movies "D:\Films"
```

The server prints a Direct IP address, for example `http://192.168.1.33:8080`. Open it on any device on the same Wi-Fi. If a phone or TV cannot connect, the Windows firewall is the usual cause, see [docs/network.md](docs/network.md).

## Documentation

| Topic | File |
|---|---|
| Install Python, ffmpeg and the first run | [docs/installation.md](docs/installation.md) |
| How to organise your movie folder | [docs/library.md](docs/library.md) |
| Firewall, a fixed laptop address, connecting devices | [docs/network.md](docs/network.md) |
| Build and install the Android TV app | [docs/tv-app.md](docs/tv-app.md) |
| Subtitles and timing | [docs/subtitles.md](docs/subtitles.md) |
| Start the server automatically when your TV is on | [docs/tv-autostart.md](docs/tv-autostart.md) |
| Fixes for common problems | [docs/troubleshooting.md](docs/troubleshooting.md) |

## Project layout

```
localflix.py              server entry point
lf/                       server code: library scan, posters, media, routes
static/                   web interface (HTML, CSS, JS)
app/                      Android TV app (Kotlin)
fix_firewall.ps1          removes the hidden python.exe block rule
tv_monitor.py             starts the server when your TV is on the Wi-Fi
install_tv_monitor_task.ps1
docs/                     guides
```

## Contributing

Bug reports, ideas and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first, and follow the [Code of Conduct](CODE_OF_CONDUCT.md). Security problems go through [SECURITY.md](SECURITY.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## License

LocalFlix is free software under the GNU General Public License v3.0. See [LICENSE](LICENSE).

Copyright (C) 2026 Huerte
