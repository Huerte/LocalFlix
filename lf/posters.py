"""Poster pipeline: local image -> embedded art -> video frame grab."""
from __future__ import annotations

import json
import os
import threading
import time

from .core import IMG_EXTS, cfg


class Posters:
    def __init__(self, lib, media):
        self.lib, self.media = lib, media
        self.dir = os.path.join(cfg.data_dir, "posters")
        self.meta_path = os.path.join(cfg.data_dir, "meta.json")
        os.makedirs(self.dir, exist_ok=True)
        self.meta = {}
        try:
            with open(self.meta_path, "r", encoding="utf-8") as fh:
                self.meta = json.load(fh)
        except (OSError, ValueError):
            pass
        self._lock = threading.Lock()
        self._queue = []
        self._queued = set()
        self._cv = threading.Condition()
        threading.Thread(target=self._worker, daemon=True).start()

    # ---- public
    def info(self, mid):
        return self.meta.get(mid) or {}

    def path(self, mid):
        for e in ("jpg", "png", "webp"):
            p = os.path.join(self.dir, f"{mid}.{e}")
            if os.path.isfile(p):
                return p
        return None

    def state(self, m):
        i = self.meta.get(m["id"])
        if not i:
            return "pending", 0
        if i.get("kind"):
            return "ready", i.get("ver", 0)
        return "none", 0

    def pending_count(self):
        with self._cv:
            return len(self._queue)

    def schedule(self, movies, refresh=False):
        with self._cv:
            for m in movies:
                i = self.meta.get(m["id"])
                if refresh or not i:
                    if m["id"] not in self._queued:
                        self._queued.add(m["id"])
                        self._queue.append(m)
            self._cv.notify()

    def set_custom(self, mid, data):
        self._save_image(mid, data)
        self._record(mid, {"kind": "custom", "tried": time.time()})

    # ---- internals
    def _record(self, mid, info):
        with self._lock:
            old = self.meta.get(mid, {})
            old.update(info)
            old["ver"] = int(time.time())
            self.meta[mid] = old
            try:
                tmp = self.meta_path + ".tmp"
                with open(tmp, "w", encoding="utf-8") as fh:
                    json.dump(self.meta, fh)
                os.replace(tmp, self.meta_path)
            except OSError:
                pass

    def _save_image(self, mid, data):
        if not data or len(data) < 500:
            return False
        ext = "jpg"
        if data[:8] == b"\x89PNG\r\n\x1a\n":
            ext = "png"
        elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
            ext = "webp"
        elif data[:3] != b"\xff\xd8\xff":
            return False
        for e in ("jpg", "png", "webp"):
            try:
                os.unlink(os.path.join(self.dir, f"{mid}.{e}"))
            except OSError:
                pass
        tmp = os.path.join(self.dir, f"{mid}.tmp")
        with open(tmp, "wb") as fh:
            fh.write(data)
        os.replace(tmp, os.path.join(self.dir, f"{mid}.{ext}"))
        return True

    def _worker(self):
        while True:
            with self._cv:
                while not self._queue:
                    self._cv.wait()
                m = self._queue.pop(0)
            try:
                self._process(m)
            except Exception:
                self._record(m["id"], {"kind": None, "tried": time.time()})
            finally:
                with self._cv:
                    self._queued.discard(m["id"])

    def _local_image(self, m):
        d = os.path.dirname(m["full"])
        stem = os.path.splitext(os.path.basename(m["full"]))[0]
        names = [stem, stem + "-poster", stem + ".poster", "poster", "folder", "cover", "movie", "front"]
        for n in names:
            for e in IMG_EXTS:
                p = os.path.join(d, n + e)
                if os.path.isfile(p):
                    return p
        return None

    def _process(self, m):
        mid = m["id"]
        info = {"tried": time.time()}
        kind = None

        probe = self.media.probe(m["full"]) if self.media.ffprobe else None
        dur = probe["duration"] if probe else None
        if dur:
            info["dur"] = dur

        # Step 1: image file sitting next to the video (poster.jpg / folder.jpg / etc.)
        p = self._local_image(m)
        if p:
            try:
                with open(p, "rb") as fh:
                    if self._save_image(mid, fh.read()):
                        kind = "local"
            except OSError:
                pass

        # Step 2: cover art embedded inside the video container (MKV attachments, MP4 tags)
        if not kind and probe:
            out = os.path.join(self.dir, f"{mid}.cover.jpg")
            if self.media.extract_cover(m["full"], probe, out):
                try:
                    with open(out, "rb") as fh:
                        data = fh.read()
                    os.unlink(out)
                    if self._save_image(mid, data):
                        kind = "embedded"
                except OSError:
                    pass

        # Step 3: grab a representative frame directly from the video
        if not kind and self.media.available:
            out = os.path.join(self.dir, f"{mid}.frame.jpg")
            if self.media.grab_frame(m["full"], dur, out):
                try:
                    with open(out, "rb") as fh:
                        data = fh.read()
                    os.unlink(out)
                    if self._save_image(mid, data):
                        kind = "frame"
                except OSError:
                    pass

        info["kind"] = kind
        self._record(mid, info)
