"""ffmpeg / ffprobe helpers. Everything here is optional: the app still works without ffmpeg."""
from __future__ import annotations

import json
import os
import shutil
import subprocess

from .core import cfg

NOWIN = getattr(subprocess, "CREATE_NO_WINDOW", 0)


def _find(name):
    p = shutil.which(name)
    if p:
        return p
    local = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), name + (".exe" if os.name == "nt" else ""))
    return local if os.path.isfile(local) else None


class Media:
    def __init__(self):
        self.ffmpeg = _find("ffmpeg")
        self.ffprobe = _find("ffprobe")

    @property
    def available(self):
        return bool(self.ffmpeg)

    def run(self, cmd, timeout=60):
        return subprocess.run(cmd, capture_output=True, timeout=timeout, creationflags=NOWIN)

    def probe(self, path):
        if not self.ffprobe:
            return None
        try:
            r = self.run([self.ffprobe, "-v", "error", "-print_format", "json", "-show_streams", "-show_format", path], 40)
            data = json.loads(r.stdout or b"{}")
        except Exception:
            return None
        out = {"duration": None, "video": None, "audio": [], "subs": [], "streams": data.get("streams", [])}
        try:
            out["duration"] = float(data.get("format", {}).get("duration"))
        except (TypeError, ValueError):
            pass
        a = s = 0
        for st in data.get("streams", []):
            tags = {k.lower(): v for k, v in (st.get("tags") or {}).items()}
            kind = st.get("codec_type")
            if kind == "video" and not (st.get("disposition") or {}).get("attached_pic") and out["video"] is None \
                    and "filename" not in tags:
                out["video"] = {"codec": st.get("codec_name"), "w": st.get("width"), "h": st.get("height")}
            elif kind == "audio":
                out["audio"].append({"n": a, "codec": st.get("codec_name"), "lang": tags.get("language", ""),
                                     "title": tags.get("title", ""), "ch": st.get("channels")})
                a += 1
            elif kind == "subtitle":
                out["subs"].append({"n": s, "codec": st.get("codec_name"), "lang": tags.get("language", ""),
                                    "title": tags.get("title", "")})
                s += 1
        return out

    def extract_cover(self, path, probe, out):
        if not self.ffmpeg or not probe:
            return False
        for st in probe["streams"]:
            if st.get("codec_type") != "video":
                continue
            tags = {k.lower(): str(v).lower() for k, v in (st.get("tags") or {}).items()}
            is_pic = bool((st.get("disposition") or {}).get("attached_pic"))
            is_att = st.get("codec_name") in ("mjpeg", "png", "bmp", "webp") and any(
                k in tags.get("filename", "") for k in ("cover", "poster", "folder", "front"))
            if not (is_pic or is_att):
                continue
            r = self.run([self.ffmpeg, "-y", "-v", "error", "-i", path, "-map", f"0:{st['index']}", "-frames:v", "1", out], 40)
            if r.returncode == 0 and os.path.isfile(out) and os.path.getsize(out) > 500:
                return True
        return False

    def grab_frame(self, path, duration, out):
        if not self.ffmpeg:
            return False
        at = 60.0
        if duration:
            at = min(max(duration * 0.12, 1.0), 300.0)
        for t in (at, 1.0):
            r = self.run([self.ffmpeg, "-y", "-v", "error", "-ss", f"{t:.2f}", "-i", path, "-frames:v", "1",
                          "-vf", "scale=480:-2", "-q:v", "4", out], 60)
            if r.returncode == 0 and os.path.isfile(out) and os.path.getsize(out) > 500:
                return True
        return False

    def embedded_sub_vtt(self, path, n):
        if not self.ffmpeg:
            return None
        r = self.run([self.ffmpeg, "-v", "error", "-i", path, "-map", f"0:s:{n}", "-f", "srt", "-"], 120)
        return r.stdout if r.returncode == 0 and r.stdout else None

    def transcode_cmd(self, path, start=0.0, audio=0):
        cmd = [self.ffmpeg, "-v", "error"]
        if start > 0:
            cmd += ["-ss", f"{start:.2f}"]
        cmd += ["-i", path, "-map", "0:v:0", "-map", f"0:a:{audio}?", "-c:v", "libx264", "-preset", "veryfast",
                "-crf", "23", "-vf", "scale='min(1920,iw)':-2,format=yuv420p", "-c:a", "aac", "-b:a", "160k", "-ac", "2",
                "-sn", "-movflags", "frag_keyframe+empty_moov+default_base_moof", "-f", "mp4", "-"]
        return cmd
