# Contributing

Thanks for helping with LocalFlix. Bug reports, ideas, docs fixes and code are all welcome.

## Reporting a bug

Open an issue and include your Windows version, Python version, whether ffmpeg is installed, the device you watch on (browser, phone or TV app), and the steps that trigger it. The startup banner and any error text help a lot.

Security problems go through [SECURITY.md](SECURITY.md), not a public issue.

## Running from source

```powershell
cd server
py -m pip install -r requirements.txt
py localflix.py --movies "D:\Films" --no-browser
```

The repo has two parts. Everything for the server is in `server/`: the code in `server/lf/` and the web interface in `server/static/`. The Android TV app is in `android-tv/` (open that folder in Android Studio, not the repo root). The web interface is served by the laptop, so changes in `server/static/` show after a refresh. Changes in `android-tv/` need a rebuilt APK, see [docs/tv-app.md](docs/tv-app.md).

## Making a release (for me)

People download the server from the [Releases page](https://github.com/Huerte/LocalFlix/releases/latest), not from the repo ZIP. The [release workflow](.github/workflows/release.yml) makes `LocalFlix-Server.zip` for me:

1. Change `VERSION` in `server/lf/core.py` and move the notes in [CHANGELOG.md](CHANGELOG.md) from **Unreleased** to the new version.
2. Commit, then push a tag: `git tag v2.1.0` and `git push origin v2.1.0`.
3. Watch the run in the [Actions tab](https://github.com/Huerte/LocalFlix/actions). When it is green, the new release has `LocalFlix-Server.zip`.
4. Build the TV app (see [docs/tv-app.md](docs/tv-app.md), Way B), rename the file to `LocalFlix-TV.apk`, and add it to the same release by hand.

If you send a pull request, you do not need to do any of this. I make the releases.

## Pull requests

1. Fork the repo and create a branch.
2. Keep the change small and focused on one thing.
3. Test it. For TV app changes, go through the checklist in [docs/tv-app.md](docs/tv-app.md).
4. Open a pull request that says what changed and why.

Guidelines:

- Python 3.10 or newer, and no new required dependency without a good reason. Optional packages must fail quietly when missing.
- Match the style of the file you edit.
- Update the docs when behaviour changes, and add a line to [CHANGELOG.md](CHANGELOG.md).
- In docs, write for readers who are **not technical** and whose first language is **not English**. Use short sentences and simple words. Use as few technical words as you can, and explain each one the first time. Give every step as a numbered action, say what the reader should see, and say what to do if it does not work.

## License

By contributing you agree that your work is released under the [GNU General Public License v3.0](LICENSE), the same as the rest of the project.
