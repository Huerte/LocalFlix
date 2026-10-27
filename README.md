# LocalFlix

Stream your personal movie library to any phone, tablet or TV on your home Wi-Fi. No account, no subscription.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.10%2B-3776AB.svg)](docs/setup-guide.md#step-1-install-python)
[![Android TV](https://img.shields.io/badge/Android%20TV-app-3DDC84.svg)](docs/tv-app.md)

## About

LocalFlix is a small program for a Windows laptop. It reads one folder of movies and shows them as a web page. Any phone, tablet, TV or computer on the same Wi-Fi can open that page and play the movies. An Android TV app shows the same page and plays movies with a better player, so it opens more kinds of files than a TV browser. Nothing leaves your home network, and you do not need internet to watch.

- Home rows made from your folders, a Browse page with filters, and search
- Posters made from your video files (needs ffmpeg), or from TMDB if you give it a key
- Subtitles from a folder, from the video itself, or sent from your device
- Continue where you stopped, and a question for the next file in the folder
- Movies that a device cannot play are changed while they play (needs ffmpeg)
- A TV app made for the remote control, with no mouse pointer

## New here? Start with the setup guide

Read the **[Complete setup guide](docs/setup-guide.md)**. It explains every step in simple words, from installing Python to watching on your TV. You do not need to know about computers.

## Quick start (for people who know PowerShell)

You need Windows 10 or 11, Python 3.10 or newer, and ffmpeg (optional, but recommended).

```powershell
py -m pip install -r requirements.txt
py localflix.py --movies "D:\Films"
```

LocalFlix prints a **Direct IP** address, for example `http://192.168.1.33:8080`. Open it on any device on the same Wi-Fi. If a phone or TV cannot connect, Windows is probably blocking it. See [Step 7 of the setup guide](docs/setup-guide.md#step-7-let-phones-and-tvs-connect).

## Documentation

| What you want to do | Guide |
|---|---|
| Install everything and watch your first movie (Python, ffmpeg, firewall, fixed address, phone and TV) | [docs/setup-guide.md](docs/setup-guide.md) |
| Name your folders and files so titles and groups look right | [docs/library.md](docs/library.md) |
| Put the LocalFlix app on an Android TV | [docs/tv-app.md](docs/tv-app.md) |
| Add subtitles and fix the timing | [docs/subtitles.md](docs/subtitles.md) |
| Start LocalFlix by itself when your TV is on | [docs/tv-autostart.md](docs/tv-autostart.md) |
| Fix a problem | [docs/troubleshooting.md](docs/troubleshooting.md) |

## Project layout

```
localflix.py              server entry point
lf/                       server code: library scan, posters, media, routes
static/                   web interface (HTML, CSS, JS)
app/                      Android TV app (Kotlin)
fix_firewall.ps1          removes the hidden python.exe block rule
tv_monitor.py             starts the server when your TV is on the Wi-Fi
install_tv_monitor_task.ps1
docs/                     guides (written in simple words)
```

## Contributing

Bug reports, ideas and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first, and follow the [Code of Conduct](CODE_OF_CONDUCT.md). Security problems go through [SECURITY.md](SECURITY.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## License

LocalFlix is free software under the GNU General Public License v3.0. See [LICENSE](LICENSE).

Copyright (C) 2026 Huerte
