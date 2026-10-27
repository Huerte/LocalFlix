# Your movie folder

LocalFlix reads one folder and everything inside it.

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

Set the folder with `--movies` or in the Settings screen. A `subtitle` folder inside it is picked up automatically, and you can point to another one in Settings.

## Categories

Every folder directly inside the movie folder becomes a category. Each one gets a row on Home and an entry in the Category filter on Browse. Loose files go under Other.

```
Heat.mkv                        Other
Horror\Saw (2004).mp4           Horror
Horrors\The Ring.mp4            Horror
Horror movies\Hereditary.mp4    Horror
Comedy\Superbad.mp4             Comedy
```

- Folder names that mean the same thing are merged. Case, plurals, words like movies, films, list, collection and pack, and spellings like Sci-Fi, SciFi and sci_fi are ignored.
- Names that differ by a number, such as Toy Story 2 and Toy Story 3, are never merged.
- Only the first folder level counts. `Horror\Slashers\Scream.mp4` is in Horror.
- Folders with no video file make no category. Hidden and system folders (`.something`, `$RECYCLE.BIN`, `@eaDir`) are skipped.
- A category can be bookmarked: `http://<ip>:8080/#/browse?cat=horror`

## File names

- Put the title first. `Inception.2010.1080p.BluRay.mkv` and `Inception (2010).mkv` both work.
- A year such as `2010` or `(2010)` sets the year.
- Brackets are fine. `[Rec]` shows as Rec.
- Tags like 1080p, BluRay, x264, YIFY and RARBG are removed from the title.
