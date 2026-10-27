# Your movie folder

LocalFlix reads **one folder** and everything inside it. You can have more folders inside it.

```
C:\Users\you\Videos\Movies\
├── Inception (2010).mkv
├── [Rec].2007.720p.mp4
├── Horror\
│   └── Saw (2004).mp4
└── subtitle\
    ├── Inception.srt
    └── Rec.srt
```

## Choose the folder

- When you start LocalFlix with `--movies`, it uses that folder: `py localflix.py --movies "D:\Films"`
- Or open **Settings** in LocalFlix on the laptop, type the folder address, and click **Save & Rescan**.
- If LocalFlix cannot find the folder, it asks you for the folder address when you start it. See [Step 6 in the setup guide](setup-guide.md#step-6-start-localflix).

A folder called `subtitle` inside your movie folder is found by itself. You can choose another subtitle folder in Settings. See [Subtitles](subtitles.md).

## Groups (categories)

Every folder **directly inside** your movie folder becomes a group. Each group gets its own row on the Home page. It also appears in the **Category** list on the Browse page. Movies that are loose in the movie folder go into **Other**.

You do not need to set anything. LocalFlix follows your folders:

```
Heat.mkv                        goes to Other
Horror\Saw (2004).mp4           goes to Horror
Horrors\The Ring.mp4            goes to Horror
Horror movies\Hereditary.mp4    goes to Horror
horror list\Midsommar.mp4       goes to Horror
Comedy\Superbad.mp4             goes to Comedy
```

Rules:

- Folder names that mean the same thing become one group. LocalFlix does not care about big or small letters, a plural (`Horrors`), extra words such as `movies`, `films`, `list`, `collection` and `pack`, and spellings such as `Sci-Fi`, `SciFi` and `sci_fi`.
- Names that are different by a number are **never** joined. `Toy Story 2` and `Toy Story 3` stay separate.
- Only the first folder level counts. `Horror\Slashers\Scream.mp4` is in **Horror**.
- A folder with no video file makes no group. Hidden and system folders are skipped (names that start with a dot, and `$RECYCLE.BIN` and `@eaDir`).
- You can save a link to a group. Example: `http://192.168.1.10:8080/#/browse?cat=horror` (use your own Direct IP).

## File names

LocalFlix reads the movie title and the year from the file name.

- Put the **title first**. `Inception.2010.1080p.BluRay.mkv` and `Inception (2010).mkv` both work.
- A year such as `2010` or `(2010)` becomes the year of the movie.
- Brackets are fine. `[Rec]` shows as **Rec**.
- Tags such as `1080p`, `BluRay`, `x264`, `YIFY` and `RARBG` are removed from the title.

Wrong title, for example `1080P`? Put the real title first. See [Fixes for common problems](troubleshooting.md).
