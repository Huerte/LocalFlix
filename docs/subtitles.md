# Subtitles

## Subtitles that are found by themselves

Put your subtitle files in the **subtitle folder**. LocalFlix accepts these file types: `.srt`, `.vtt`, `.ass`, `.ssa` and `.sub`.

LocalFlix matches the subtitle name to the movie name. The names do not need to be exactly the same.

```
Movies\subtitle\
├── Inception.srt             matches Inception (2010).mkv
├── Inception.English.srt     the same movie, with the label English
├── Rec.srt                   matches [Rec].720p.mp4
└── The.Dark.Knight.srt
```

Subtitles that are **inside** the movie file are listed too.

By default, LocalFlix looks for a folder called `subtitle` inside your movie folder. To use another folder, open **Settings** in LocalFlix on the laptop, type the folder address, and click **Save & Rescan**. Or start LocalFlix with `--subtitles "D:\Subs"`.

## Turn on a subtitle

1. Start a movie.
2. Open the **Subtitles** menu in the player (the **CC** button).
3. Choose a subtitle from the list.

Subtitles are **off** until you choose one. LocalFlix remembers your choice.

## Add a subtitle while you watch

Open the **Subtitles** menu and look under **Add subtitles**:

- **Browse subtitle folder** (in the TV app: **Browse subtitle files**): search all the subtitle files LocalFlix knows, and pick one.
- **Upload from this device** (browser only): send a subtitle file from your phone or computer.

## Change the size, position, colour and timing

Open **Subtitles**, then **Appearance and timing**. You can change:

- **Size** and **Position**
- **Delay**, in steps of 0.1 seconds
  - Use **+** when the subtitles appear **too early**.
  - Use **-** when the subtitles appear **too late**.
  - On the TV, hold **OK** to keep stepping.
  - The delay is saved for each movie.
- **Color** and **Background**
- **Reset to defaults**

**In the browser** there is also a **Subtitle sync** screen. It has quick buttons (from -5 s to +5 s) and small steps (-1 s, -0.5 s, -0.1 s, +0.1 s, +0.5 s, +1 s). While you watch, the keys `[` and `]` move the timing by 0.5 seconds. **Reset offset to 0** puts it back. The TV app does not have this screen. Use **Appearance and timing** there.

## Subtitles not found?

1. Check that the file is in the subtitle folder, and that its type is one of the types above.
2. Check that the subtitle folder address in **Settings** is right.
3. Click **Save & Rescan** in **Settings**.
4. Choose the file by hand: **Subtitles**, then **Browse subtitle folder**.

More help: [Fixes for common problems](troubleshooting.md).
