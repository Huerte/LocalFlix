"""Config, filename parsing, library scanning and subtitle handling."""
from __future__ import annotations

import hashlib
import json
import os
import re
import threading
import time

VERSION = "2.0.0"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

VIDEO_EXTS = {".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".mpg", ".mpeg", ".ts", ".3gp", ".ogv"}
SUB_EXTS = {".srt", ".vtt", ".ass", ".ssa", ".sub"}
IMG_EXTS = (".jpg", ".jpeg", ".png", ".webp")


# --------------------------------------------------------------------------- config
class Config:
    DEFAULTS = {
        "movies_dir": r"C:\Users\hp\Videos\Movies",
        "subtitle_dir": r"C:\Users\hp\Videos\Movies\subtitle",
        "port": 8080,
        "online_lookup": True,
        "tmdb_key": "",
    }

    def __init__(self):
        self.path = os.path.join(ROOT, "config.json")
        self.data = dict(self.DEFAULTS)
        self.host = "0.0.0.0"
        self.allow_remote_admin = False
        self.open_browser = True
        self.data_dir = os.environ.get("LOCALFLIX_DATA") or os.path.join(ROOT, "localflix_data")
        self.itunes_url = os.environ.get("LOCALFLIX_ITUNES_URL", "https://itunes.apple.com/search")

    def load(self):
        try:
            with open(self.path, "r", encoding="utf-8") as fh:
                self.data.update(json.load(fh))
        except (OSError, ValueError):
            pass

    def save(self):
        try:
            with open(self.path, "w", encoding="utf-8") as fh:
                json.dump(self.data, fh, indent=2)
        except OSError:
            pass

    def get(self, key):
        return self.data.get(key, self.DEFAULTS.get(key))

    def set(self, key, value, persist=True):
        self.data[key] = value
        if persist:
            self.save()

    @property
    def movies_dir(self):
        return self.get("movies_dir")

    @property
    def port(self):
        return int(self.get("port") or 8080)

    @property
    def subtitle_dirs(self):
        out = []
        sd = self.get("subtitle_dir")
        if sd and os.path.isdir(sd):
            out.append(sd)
        guess = os.path.join(self.movies_dir, "subtitle")
        if os.path.isdir(guess) and guess not in out:
            out.append(guess)
        return out


cfg = Config()


# --------------------------------------------------------------------------- naming
JUNK = re.compile(
    r"^(2160p|1080p|1080i|720p|480p|360p|4k|uhd|hdr|hdr10|dv|bluray|blu|ray|brrip|bdrip|webrip|web|webdl|hdrip|dvdrip|dvd|"
    r"hdtv|hdcam|cam|ts|x264|x265|h264|h265|hevc|avc|xvid|divx|aac|ac3|eac3|dts|ddp5|dd5|atmos|10bit|8bit|"
    r"yts|yify|rarbg|ettv|etrg|amzn|nf|extended|unrated|remastered|proper|repack|multi|dual|sub|subs|subbed|dubbed|"
    r"5\.1|7\.1|mx|am|lt|ag|bone|galaxyrg|psa|ntb|evo|fgt|sparks|tigole|qxr|ion10|mp4|mkv)$",
    re.I,
)
YEAR = re.compile(r"(?<![0-9])((?:19|20)\d{2})(?![0-9])")
LANGS = {
    "en": "English", "eng": "English", "english": "English", "tl": "Tagalog", "tgl": "Tagalog", "tagalog": "Tagalog",
    "fil": "Filipino", "filipino": "Filipino", "es": "Spanish", "spa": "Spanish", "spanish": "Spanish",
    "fr": "French", "fre": "French", "fra": "French", "french": "French", "de": "German", "ger": "German",
    "deu": "German", "german": "German", "it": "Italian", "ita": "Italian", "italian": "Italian",
    "pt": "Portuguese", "por": "Portuguese", "portuguese": "Portuguese", "ru": "Russian", "rus": "Russian",
    "russian": "Russian", "ja": "Japanese", "jpn": "Japanese", "japanese": "Japanese", "ko": "Korean",
    "kor": "Korean", "korean": "Korean", "zh": "Chinese", "chi": "Chinese", "zho": "Chinese", "chinese": "Chinese",
    "ar": "Arabic", "ara": "Arabic", "arabic": "Arabic", "id": "Indonesian", "ind": "Indonesian",
    "indonesian": "Indonesian", "ms": "Malay", "may": "Malay", "malay": "Malay", "th": "Thai", "tha": "Thai",
    "vi": "Vietnamese", "vie": "Vietnamese", "hi": "Hindi", "hin": "Hindi", "tr": "Turkish", "tur": "Turkish",
    "nl": "Dutch", "dut": "Dutch", "pl": "Polish", "pol": "Polish", "sv": "Swedish", "swe": "Swedish",
}
STOP = {"the", "a", "an", "of", "and"}


def tokens(text: str):
    return re.findall(r"[a-z0-9]+", text.lower())


def _bracket_repl(mo):
    """Replace bracketed groups: keep year bare, keep legit words, strip junk."""
    inner = mo.group(0)[1:-1].strip()
    if YEAR.fullmatch(inner):
        return " " + inner + " "
    toks = re.findall(r"[a-z0-9]+", inner.lower())
    # If every token is junk (resolution, codec, source, etc.) — strip entirely
    if not toks or all(JUNK.match(t) for t in toks):
        return " "
    # Legit content inside brackets (e.g. [Rec], [REC], [The Thing]) — keep the text
    return " " + re.sub(r"[._]+", " ", inner) + " "


def parse_name(stem: str):
    """Return (title, year) from a messy release name like [Rec].720p.BluRay.mp4."""
    s = re.sub(r"[\[\(\{][^\]\)\}]*[\]\)\}]", _bracket_repl, stem)
    s = re.sub(r"[._]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    year = None
    m = None
    for m in YEAR.finditer(s):
        pass
    parts = s.split(" ")
    if m and m.start() > 0:
        year = int(m.group(1))
        s = s[: m.start()].strip(" -")
        parts = s.split(" ")
    else:
        keep = []
        for p in parts:
            if JUNK.match(p.strip("-")) and keep:
                break
            keep.append(p)
        parts = keep
    title = " ".join(parts).strip(" -") or stem
    title = re.sub(r"-[A-Za-z0-9]+$", "", title) if re.search(r"-[A-Z0-9]{2,}$", title) and year is None else title
    return title.strip() or stem, year


def title_key(title: str):
    return [t for t in tokens(title) if t not in STOP]


def sort_key(text: str):
    t = re.sub(r"^(the|a|an)\s+", "", text.strip().lower())
    return re.sub(r"(\d+)", lambda m: m.group(1).zfill(6), t)


def human_size(b: int) -> str:
    n = float(b)
    for unit in ("KB", "MB", "GB"):
        n /= 1024
        if n < 1024 or unit == "GB":
            return f"{n:.1f} {unit}"
    return str(b)


# --------------------------------------------------------------------------- library
def mid_for(rel: str) -> str:
    return hashlib.sha1(rel.lower().encode("utf-8", "replace")).hexdigest()[:12]


def added_time(st) -> int:
    t = getattr(st, "st_birthtime", None)
    if t is None:
        t = st.st_ctime if os.name == "nt" else st.st_mtime
    return int(min(t, st.st_mtime) if os.name != "nt" else t)


class Library:
    def __init__(self, subs: "SubtitleIndex"):
        self.subs = subs
        self._movies: list = []
        self._by_id: dict = {}
        self._at = 0.0
        self._lock = threading.Lock()

    def scan(self, force=False):
        with self._lock:
            if not force and self._movies and time.time() - self._at < 20:
                return self._movies
            base = cfg.movies_dir
            movies = []
            if os.path.isdir(base):
                sub_dirs = [os.path.normcase(os.path.abspath(d)) for d in cfg.subtitle_dirs]
                for root, dirs, files in os.walk(base):
                    nroot = os.path.normcase(os.path.abspath(root))
                    if any(nroot == d or nroot.startswith(d + os.sep) for d in sub_dirs):
                        dirs[:] = []
                        continue
                    for fname in files:
                        stem, ext = os.path.splitext(fname)
                        if ext.lower() not in VIDEO_EXTS:
                            continue
                        full = os.path.join(root, fname)
                        try:
                            st = os.stat(full)
                        except OSError:
                            continue
                        rel = os.path.relpath(full, base).replace("\\", "/")
                        folder = os.path.relpath(root, base).replace("\\", "/")
                        folder = "" if folder == "." else folder
                        title, year = parse_name(stem)
                        movies.append({
                            "id": mid_for(rel), "name": stem, "title": title, "year": year, "path": rel,
                            "full": full, "ext": ext[1:].upper(), "size": st.st_size, "size_str": human_size(st.st_size),
                            "folder": folder, "added": added_time(st), "mtime": int(st.st_mtime),
                        })
            self.subs.rebuild(movies)
            for m in movies:
                m["subs"] = len(self.subs.match(m))
            movies.sort(key=lambda m: sort_key(m["title"]))
            self._movies = movies
            self._by_id = {m["id"]: m for m in movies}
            self._at = time.time()
            return movies

    def get(self, mid):
        self.scan()
        return self._by_id.get(mid)

    def by_path(self, rel):
        self.scan()
        for m in self._movies:
            if m["path"] == rel:
                return m
        return None


# --------------------------------------------------------------------------- subtitles
def decode_bytes(raw: bytes) -> str:
    if raw.startswith(b"\xef\xbb\xbf"):
        return raw[3:].decode("utf-8", "replace")
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        return raw.decode("utf-16", "replace")
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        pass
    if len(raw) > 300:
        try:
            from charset_normalizer import from_bytes  # type: ignore
            best = from_bytes(raw).best()
            enc = (best.encoding if best else "") or ""
            if enc.lower().startswith(("gb", "big5", "shift", "cp932", "euc", "cp949", "cp1251", "koi8", "windows-1251",
                                      "cp866", "cp1253", "cp1255", "cp1256", "cp874", "iso8859", "johab")):
                return raw.decode(enc, "replace")
        except Exception:
            pass
    return raw.decode("cp1252", "replace")


TIME = re.compile(r"(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})")
TAGS = re.compile(r"<[^>]+>|\{\\[^}]*\}")


def _t(m) -> float:
    h, mi, s, ms = m
    return int(h or 0) * 3600 + int(mi) * 60 + int(s) + int(ms.ljust(3, "0")) / 1000


def _clean(text: str) -> str:
    text = TAGS.sub("", text)
    text = text.replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
    return "\n".join(l.strip() for l in text.replace("\r", "").split("\n")).strip()


def parse_subtitles(raw: bytes, ext: str, fps: float = 23.976):
    """Return a list of [start, end, text]."""
    text = decode_bytes(raw).replace("\r\n", "\n").replace("\r", "\n")
    ext = ext.lower().lstrip(".")
    cues = []
    if ext in ("ass", "ssa"):
        fmt = None
        for line in text.split("\n"):
            line = line.strip()
            if line.lower().startswith("format:") and fmt is None and "text" in line.lower():
                fmt = [x.strip().lower() for x in line.split(":", 1)[1].split(",")]
            elif line.lower().startswith("dialogue:") and fmt:
                parts = line.split(":", 1)[1].split(",", len(fmt) - 1)
                if len(parts) < len(fmt):
                    continue
                row = dict(zip(fmt, parts))
                try:
                    def at(v):
                        h, m_, s = v.strip().split(":")
                        return int(h) * 3600 + int(m_) * 60 + float(s)
                    a, b = at(row["start"]), at(row["end"])
                except (KeyError, ValueError):
                    continue
                body = re.sub(r"\{[^}]*\}", "", row.get("text", "")).replace("\\N", "\n").replace("\\n", "\n").replace("\\h", " ")
                body = _clean(body)
                if body:
                    cues.append([a, b, body])
        cues.sort(key=lambda c: c[0])
        return cues
    if ext == "sub" and re.search(r"^\{\d+\}\{\d+\}", text, re.M):
        for m in re.finditer(r"^\{(\d+)\}\{(\d+)\}(.*)$", text, re.M):
            body = _clean(m.group(3).replace("|", "\n"))
            if body:
                cues.append([int(m.group(1)) / fps, int(m.group(2)) / fps, body])
        return cues
    blocks = re.split(r"\n\s*\n", text.strip())
    for blk in blocks:
        lines = [l for l in blk.split("\n")]
        for i, l in enumerate(lines):
            if "-->" in l:
                left, right = l.split("-->", 1)
                a, b = TIME.search(left), TIME.search(right)
                if not a or not b:
                    break
                body = _clean("\n".join(lines[i + 1:]))
                if body:
                    cues.append([_t(a.groups()), _t(b.groups()), body])
                break
    return cues


def to_vtt(cues) -> str:
    def f(x):
        h, r = divmod(x, 3600)
        m, s = divmod(r, 60)
        return "%02d:%02d:%06.3f" % (h, m, s)
    out = ["WEBVTT", ""]
    for a, b, t in cues:
        t = t.replace("&", "&amp;").replace("<", "&lt;")
        out += [f"{f(a)} --> {f(b)}", t, ""]
    return "\n".join(out)


def lang_of(stem: str):
    toks = tokens(stem)
    for t in reversed(toks):
        if t in LANGS:
            return LANGS[t]
    return ""


class SubtitleIndex:
    def __init__(self):
        self.entries: list = []
        self._lock = threading.Lock()

    @staticmethod
    def _dirs():
        return list(cfg.subtitle_dirs)

    def rebuild(self, movies):
        entries = []
        seen = set()
        movie_dirs = {os.path.dirname(m["full"]) for m in movies}
        up = os.path.join(cfg.data_dir, "uploaded_subs")
        roots = [(d, "folder") for d in self._dirs()] + [(up, "upload")]
        for d, kind in roots:
            if not os.path.isdir(d):
                continue
            for root, _, files in os.walk(d):
                for fn in files:
                    stem, ext = os.path.splitext(fn)
                    if ext.lower() not in SUB_EXTS:
                        continue
                    full = os.path.join(root, fn)
                    if full in seen:
                        continue
                    seen.add(full)
                    entries.append(self._entry(full, d, root, stem, ext, kind))
        for d in movie_dirs:  # sidecar files next to the movie
            try:
                for fn in os.listdir(d):
                    stem, ext = os.path.splitext(fn)
                    full = os.path.join(d, fn)
                    if ext.lower() in SUB_EXTS and full not in seen and os.path.isfile(full):
                        seen.add(full)
                        entries.append(self._entry(full, d, d, stem, ext, "sidecar"))
            except OSError:
                pass
        with self._lock:
            self.entries = entries

    def _entry(self, full, base, root, stem, ext, kind):
        parent = os.path.basename(root) if os.path.normcase(root) != os.path.normcase(base) else ""
        clean_stem = " ".join(t for t in tokens(stem) if t not in LANGS)
        t1, y1 = parse_name(re.sub(r"\b(" + "|".join(LANGS) + r")\b", " ", stem.replace(".", " "), flags=re.I))
        keys = [(title_key(t1), y1)]
        if parent:
            t2, y2 = parse_name(parent)
            keys.append((title_key(t2), y2))
        sid = hashlib.sha1(full.lower().encode("utf-8", "replace")).hexdigest()[:12]
        upload_id = None
        if kind == "upload":
            rel = os.path.relpath(full, os.path.join(cfg.data_dir, "uploaded_subs"))
            upload_id = rel.replace("\\", "/").split("/")[0]
        return {"id": sid, "full": full, "ext": ext.lower().lstrip(".").upper(), "name": os.path.basename(full),
                "lang": lang_of(stem), "keys": keys, "kind": kind, "upload_id": upload_id, "stem": clean_stem}

    def match(self, movie):
        mk = title_key(movie["title"])
        my = movie.get("year")
        out = []
        with self._lock:
            entries = list(self.entries)
        for e in entries:
            if e["kind"] == "upload":
                if e["upload_id"] == movie["id"]:
                    out.append(e)
                continue
            if e["kind"] == "sidecar" and os.path.dirname(e["full"]) == os.path.dirname(movie["full"]):
                if os.path.splitext(e["name"])[0].lower().startswith(movie["name"].lower()):
                    out.append(e)
                    continue
            for sk, sy in e["keys"]:
                if not sk or not mk:
                    continue
                if my and sy and my != sy:
                    continue
                num_a = {t for t in sk if t.isdigit()}
                num_b = {t for t in mk if t.isdigit()}
                if num_a != num_b:
                    continue
                a, b = set(sk), set(mk)
                if a == b or len(a & b) / len(a | b) >= 0.8:
                    out.append(e)
                    break
        out.sort(key=lambda e: (e["lang"] != "English", e["lang"], e["name"]))
        return out

    def find(self, sid):
        with self._lock:
            for e in self.entries:
                if e["id"] == sid:
                    return e
        return None


def track_label(e, idx_by_lang):
    lang = e["lang"] or "Subtitles"
    n = idx_by_lang.get(lang, 0)
    idx_by_lang[lang] = n + 1
    return lang if n == 0 else f"{lang} {n + 1}"
