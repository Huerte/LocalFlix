# LocalFlix

Stream your personal movie library to any phone, tablet or TV on your Wi-Fi, from a Windows laptop or an Android phone. No account, no subscription.

[![Latest release](https://img.shields.io/github/v/release/Huerte/LocalFlix)](https://github.com/Huerte/LocalFlix/releases/latest)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.10%2B-3776AB.svg)](docs/setup-guide.md#step-1-install-python)
[![Android TV](https://img.shields.io/badge/Android%20TV-app-3DDC84.svg)](docs/tv-app.md)

## About

LocalFlix is a small program that reads one folder of movies and shows them as a web page. It runs on a Windows laptop. It can also run on an Android phone with the free Termux app, so you do not need a laptop (it should work, but I have not tested it on every phone). Any phone, tablet, TV or computer on the same Wi-Fi can open that page and play the movies. The Wi-Fi can come from a home router or from a phone hotspot. An Android TV app shows the same page and plays movies with a better player, so it opens more kinds of files than a TV browser. Nothing leaves your own network, and you do not need internet to watch.

- Home rows made from your folders, a Browse page with filters, and search
- Posters made from your video files (needs ffmpeg), or from TMDB if you give it a key
- Subtitles from a folder, from the video itself, or sent from your device
- Continue where you stopped, and a question for the next file in the folder
- Movies that a device cannot play are changed while they play (needs ffmpeg)
- A TV app made for the remote control, with no mouse pointer
- Runs on a Windows laptop, or on an Android phone with Termux
- Works with a home router or with a phone hotspot (no internet needed to watch)

## Download

You do not need the whole project to run LocalFlix. Get only what you need from the **[Releases page](https://github.com/Huerte/LocalFlix/releases/latest)**:

| I want to... | Download | Then read |
|---|---|---|
| Run the server (Windows laptop, or Android phone with Termux) | `LocalFlix-Server.zip` | [Setup guide](docs/setup-guide.md) |
| Put the app on my Android TV | `LocalFlix-TV.apk` | [TV app guide](docs/tv-app.md) |

The green **Code** button on this page gives you the whole project, with the TV app source too. You only need that if you want to change the code or build the TV app yourself.

## New here? Start with the setup guide

Read the **[Complete setup guide](docs/setup-guide.md)**. It explains every step in simple words, from installing Python to watching on your TV. You do not need to know about computers.

## Quick start (for people who know PowerShell)

You need Windows 10 or 11, Python 3.10 or newer, and ffmpeg (optional, but recommended). Download and extract `LocalFlix-Server.zip`, open PowerShell in the extracted folder, then:

```powershell
py -m pip install -r requirements.txt
py localflix.py --movies "D:\Films"
```

If you cloned the repo instead of using the ZIP, run `cd server` first.

LocalFlix prints a **Direct IP** address, for example `http://192.168.1.33:8080`. Open it on any device on the same Wi-Fi. If a phone or TV cannot connect, Windows is probably blocking it. See [Step 7 of the setup guide](docs/setup-guide.md#step-7-let-phones-and-tvs-connect).

## Documentation

| What you want to do | Guide |
|---|---|
| Install everything and watch your first movie (Python, ffmpeg, firewall, fixed address, phone and TV) | [docs/setup-guide.md](docs/setup-guide.md) |
| Name your folders and files so titles and groups look right | [docs/library.md](docs/library.md) |
| Put the LocalFlix app on an Android TV | [docs/tv-app.md](docs/tv-app.md) |
| Add subtitles and fix the timing | [docs/subtitles.md](docs/subtitles.md) |
| Start LocalFlix by itself when your TV is on | [docs/tv-autostart.md](docs/tv-autostart.md) |
| Use an Android phone as the server, with no laptop (Termux) | [docs/phone-server.md](docs/phone-server.md) |
| Use a phone hotspot instead of a router | [docs/hotspot.md](docs/hotspot.md) |
| Fix a problem | [docs/troubleshooting.md](docs/troubleshooting.md) |

## Project layout

```
server/                   everything you need to run LocalFlix (this is what LocalFlix-Server.zip contains)
  localflix.py            server entry point
  lf/                     server code: library scan, posters, media, routes
  static/                 web interface (HTML, CSS, JS)
  requirements.txt        Python packages
  fix_firewall.ps1        removes the hidden python.exe block rule
  tv_monitor.py           starts the server when your TV is on the Wi-Fi
  install_tv_monitor_task.ps1
android-tv/               Android TV app (Kotlin), open this folder in Android Studio
docs/                     guides (written in simple words)
.github/workflows/        release.yml builds LocalFlix-Server.zip for each release
```

I make a release by pushing a version tag. The [release workflow](.github/workflows/release.yml) then packs the `server/` folder into `LocalFlix-Server.zip` and adds it to the [Releases page](https://github.com/Huerte/LocalFlix/releases/latest).

## Contributing

Bug reports, ideas and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first, and follow the [Code of Conduct](CODE_OF_CONDUCT.md). Security problems go through [SECURITY.md](SECURITY.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## License

LocalFlix is free software under the GNU General Public License v3.0. See [LICENSE](LICENSE).
