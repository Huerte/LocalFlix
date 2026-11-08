# Changelog

Notable changes to LocalFlix. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.2.0] - 2026-11-08

### Added
- TV player aspect ratio controls: cycle button on the player control bar (Fit, Fill, Stretch) and choices in the Playback settings menu
- High-definition poster frames: video frame grabs now generate at 960px with high-quality JPEG encoding (`-q:v 2`), removing blurry poster cards
- TV poster thumbnails upgraded to 540px width with `-q:v 2` compression for crisp rendering on 1080p and 4K screens
- Safe poster placeholders: cards with pending or missing posters display movie titles on a clean dark card, avoiding blank cards or broken image icons
- TV app connection screen now displays the installed version badge (`v2.2.0`)
- Continuous integration workflow running syntax checks, unit tests, and Android debug builds

### Changed
- Removed online poster lookup completely: all external TMDb and iTunes lookups, API keys, and related settings are gone. Posters are sourced locally from folder sidecars, embedded container art, or video frames
- Device-neutral language: replaced "laptop" and "computer" terms with "server device" across the web player, TV app, and server output

### Fixed
- Subtitle black background overflow: transcode and offset subtitles now wrap text tightly instead of stretching a black box across the full width of the screen
- Subtitle vertical positioning: embedded subtitles in direct play mode now translate correctly when adjusting vertical position in the appearance menu
- Web subtitle position persistence: dynamic CSS variables ensure custom subtitle positions stay in place when playback controls show or hide
- Poster self-healing: poster status now verifies physical file existence on disk before reporting ready, automatically queueing generation for missing files

## [2.1.0]

### Added
- `.github/workflows/release.yml`: pushing a `v*` tag builds `LocalFlix-Server.zip` and publishes a GitHub Release
- The TV app guide explains how to download `LocalFlix-TV.apk` from Releases, with building it yourself as the second way
- "Making a release" section in CONTRIBUTING.md
- `docs/phone-server.md`: a complete guide to run the LocalFlix server on an Android phone with Termux, with a list of the Windows steps and commands that do not work on a phone
- `docs/hotspot.md`: a guide to use a phone hotspot instead of a router (laptop server, phone server, or two phones), with a list of what does not work
- GNU GPL v3 license
- Contributing guide, code of conduct, security policy, and issue and pull request templates
- Selecting the logo or the Home tab in the TV app rescans the library and refreshes the page

### Changed
- The repo is now split into `server/` (everything needed to run LocalFlix) and `android-tv/` (the TV app). `docs/` and the project files stay at the top
- The server is now downloaded from the Releases page as `LocalFlix-Server.zip`, so you no longer need the whole repo ZIP. The guides and the extracted folder name changed from `LocalFlix-main` to `LocalFlix-Server`
- Open the `android-tv` folder in Android Studio (not the repo root). The built app file is now at `android-tv\app\build\outputs\apk\debug\app-debug.apk`
- Guides and project files are written in my own words (first person) instead of "the author" and "we"
- `.gitignore` paths now point to `server/` and `android-tv/`
- README shortened, with the detailed guides moved to `docs/`
- All guides rewritten in simple words for readers who are not technical and whose first language is not English
- New `docs/setup-guide.md`: one complete step-by-step manual from installing Python to watching on a phone or TV. It replaces `docs/installation.md` and `docs/network.md`
- `docs/tv-app.md` now explains Android Studio, developer mode on the TV and installing the app file in detail
- `docs/troubleshooting.md` is grouped by what you see on the screen
- TV auto-start guide moved from `TV_AUTOSTART_GUIDE.md` to `docs/tv-autostart.md`
- Removed the separate Subtitle sync screen in the TV app. Delay is set in Appearance and timing
- Removed the Next button from the TV app player. The Next media key and the end-of-file prompt still work

### Fixed
- The default movie folder was a fixed path from my own laptop (`C:\Users\hp\...`). It is now made from the home folder of whoever runs LocalFlix, and the default subtitle folder is empty, so it follows the movie folder
- `fix_firewall.ps1` no longer uses a fixed Python path from my own laptop. It finds the real `python.exe` that `py` starts (or you give it with `-PythonPath`), stops with a clear message if it cannot find Python or is not run as administrator, and does not make a double rule when you run it twice
- Guides no longer tell readers to run `gradlew assembleDebug`, because the project has no `gradlew` file. Use Android Studio's Build menu
- Subtitle guide used the wrong menu name for the browser (it is Browse subtitle folder)
- The search box in the TV app did not show the keyboard when OK was pressed and held

## 2.0.1

Version in the code at the time this changelog was started. Earlier history is not listed.

[2.2.0]: https://github.com/Huerte/LocalFlix/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/Huerte/LocalFlix/compare/v2.0.1...v2.1.0
