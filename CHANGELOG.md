# Changelog

Notable changes to LocalFlix. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added
- GNU GPL v3 license
- Contributing guide, code of conduct, security policy, and issue and pull request templates
- Selecting the logo or the Home tab in the TV app rescans the library and refreshes the page

### Changed
- README shortened, with the detailed guides moved to `docs/`
- All guides rewritten in simple words for readers who are not technical and whose first language is not English
- New `docs/setup-guide.md`: one complete step-by-step manual from installing Python to watching on a phone or TV. It replaces `docs/installation.md` and `docs/network.md`
- `docs/tv-app.md` now explains Android Studio, developer mode on the TV and installing the app file in detail
- `docs/troubleshooting.md` is grouped by what you see on the screen
- TV auto-start guide moved from `TV_AUTOSTART_GUIDE.md` to `docs/tv-autostart.md`
- Removed the separate Subtitle sync screen in the TV app. Delay is set in Appearance and timing
- Removed the Next button from the TV app player. The Next media key and the end-of-file prompt still work

### Fixed
- Guides no longer tell readers to run `gradlew assembleDebug`, because the project has no `gradlew` file. Use Android Studio's Build menu
- Subtitle guide used the wrong menu name for the browser (it is Browse subtitle folder)
- The search box in the TV app did not show the keyboard when OK was pressed and held

## 2.0.1

Version in the code at the time this changelog was started. Earlier history is not listed.
