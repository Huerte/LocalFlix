"""HTTP routes."""
from __future__ import annotations

import json
import mimetypes
import os
import re
import socket
import subprocess
import threading

from flask import Flask, Response, abort, jsonify, request, send_file, send_from_directory

from .core import ROOT, SUB_EXTS, VERSION, Library, SubtitleIndex, cfg, parse_subtitles, to_vtt, track_label
from .media import NOWIN, Media
from .posters import Posters

DISCOVERY_PORT = 50505
MIMES = {".mkv": "video/x-matroska", ".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm",
         ".avi": "video/x-msvideo", ".mov": "video/quicktime", ".ts": "video/mp2t", ".ogv": "video/ogg"}


def lan_addresses():
    ips = []
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            ips.append(s.getsockname()[0])
    except Exception:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith(("127.", "169.254.")) and ip not in ips:
                ips.append(ip)
    except Exception:
        pass
    return ips or ["127.0.0.1"]



def start_discovery(port):
    """Answer UDP broadcasts so the TV app can find this computer without typing an address."""
    def run():
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(("", DISCOVERY_PORT))
        except OSError:
            return
        while True:
            try:
                data, addr = s.recvfrom(256)
                if data.strip() == b"LOCALFLIX_DISCOVER":
                    s.sendto(json.dumps({"app": "LocalFlix", "port": port, "name": socket.gethostname()}).encode(), addr)
            except OSError:
                return
    threading.Thread(target=run, daemon=True).start()


def start_mdns(port):
    """Register localflix.local via mDNS (Bonjour/zeroconf).

    Phones and TVs can reach the server via http://localflix.local:<port>
    without ever knowing the laptop's IP address. Works natively on iOS,
    macOS, Windows 10+, and modern Android.
    Silently skipped if the 'zeroconf' package is not installed.
    """
    try:
        from zeroconf import ServiceInfo, Zeroconf  # pip install zeroconf
        ips = lan_addresses()
        # Prefer the real Wi-Fi IP — skip VMware/VirtualBox virtual adapters
        primary = next(
            (ip for ip in ips
             if not ip.startswith(("192.168.81.", "192.168.222.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20."))),
            ips[0]
        )
        info = ServiceInfo(
            "_http._tcp.local.",
            "LocalFlix._http._tcp.local.",
            addresses=[socket.inet_aton(primary)],
            port=port,
            properties={"path": "/", "app": "LocalFlix", "version": VERSION},
            server="localflix.local.",
        )
        zc = Zeroconf()
        zc.register_service(info)
        return zc  # caller must keep a reference or it gets garbage-collected
    except ImportError:
        print("   (mDNS off: run  py -m pip install zeroconf  to enable localflix.local)")
        return None
    except Exception as exc:
        print(f"   (mDNS could not start: {exc})")
        return None



def create_app():
    app = Flask(__name__, static_folder=os.path.join(ROOT, "static"), static_url_path="/static")
    app.config["MAX_CONTENT_LENGTH"] = 6 * 1024 * 1024
    subs = SubtitleIndex()
    lib = Library(subs)
    media = Media()
    posters = Posters(lib, media)
    app.services = {"lib": lib, "subs": subs, "media": media, "posters": posters}
    cache = {}

    def kick():
        posters.schedule(lib.scan())

    def pub(m):
        st, ver = posters.state(m)
        info = posters.info(m["id"])
        return {"id": m["id"], "name": m["name"], "title": m["title"], "year": m["year"] or _int(info.get("year_online")),
                "path": m["path"], "ext": m["ext"], "size": m["size"], "size_str": m["size_str"], "folder": m["folder"],
                "added": m["added"], "poster": st, "pv": ver, "subs": m.get("subs", 0), "dur": info.get("dur"),
                "genre": info.get("genre", "")}

    def _int(v):
        try:
            return int(v)
        except (TypeError, ValueError):
            return None

    def is_local():
        return request.remote_addr in ("127.0.0.1", "::1")

    # ------------------------------------------------------------------ pages
    @app.after_request
    def headers(resp):
        resp.headers["X-Content-Type-Options"] = "nosniff"
        if request.path.startswith("/api/"):
            resp.headers["Cache-Control"] = "no-store"
        return resp

    @app.route("/")
    def index():
        r = send_from_directory(app.static_folder, "index.html")
        r.headers["Cache-Control"] = "no-cache"
        return r

    @app.route("/qr")
    def qr_page():
        """Scan-to-connect page: shows QR code + direct URL so phones never need to type an IP."""
        ips = lan_addresses()
        # Prefer the real Wi-Fi IP over virtual adapter addresses
        primary = next(
            (ip for ip in ips
             if not ip.startswith(("192.168.81.", "192.168.222.", "172.16.", "172.17.", "172.18."))),
            ips[0]
        )
        url = f"http://{primary}:{cfg.port}"
        local_url = f"http://localflix.local:{cfg.port}"
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Connect to LocalFlix</title>
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{background:#0e1014;color:#eceef3;font-family:'Segoe UI',system-ui,sans-serif;
          min-height:100vh;display:flex;flex-direction:column;align-items:center;
          justify-content:center;padding:32px;text-align:center;gap:22px}}
    h1{{font-size:2rem;font-weight:800;color:#4f8cff;letter-spacing:-.02em}}
    .sub{{color:#a3abbb;font-size:1rem;max-width:420px;line-height:1.5}}
    #qr-wrap{{background:#fff;padding:18px;border-radius:18px;
               box-shadow:0 0 60px rgba(79,140,255,.35);display:inline-block}}
    .methods{{display:flex;flex-direction:column;gap:12px;width:100%;max-width:420px}}
    .method{{background:#1c2029;border:1px solid #2a2f3a;border-radius:14px;padding:16px 20px;text-align:left}}
    .lbl{{font-size:.72rem;letter-spacing:.09em;text-transform:uppercase;color:#a3abbb;margin-bottom:6px;display:flex;align-items:center;gap:8px}}
    .val{{font-family:Consolas,monospace;font-size:1rem;color:#4f8cff;word-break:break-all}}
    .note{{font-size:.82rem;color:#727d90;margin-top:5px}}
    .badge{{font-size:.68rem;padding:2px 8px;border-radius:999px;font-weight:700}}
    .best{{background:rgba(0,196,140,.2);color:#00c48c}}
    .ok{{background:rgba(79,140,255,.18);color:#4f8cff}}
    a{{color:#4f8cff;text-decoration:none}}
    a:hover{{text-decoration:underline}}
    .back{{margin-top:8px}}
    .back a{{font-size:.9rem;color:#a3abbb}}
    .back a:hover{{color:#fff}}
  </style>
</head>
<body>
  <h1>LocalFlix</h1>
  <p class="sub">Point your phone camera at the QR code to connect. No typing required.</p>
  <div id="qr-wrap"><canvas id="qr"></canvas></div>
  <div class="methods">
    <div class="method">
      <div class="lbl">Hostname <span class="badge ok">Apple / Windows</span></div>
      <div class="val"><a href="{local_url}">{local_url}</a></div>
      <div class="note">Works on iPhone/iPad, macOS and Windows. Most Android phones and Android TVs can NOT resolve .local names - use the IP below.</div>
    </div>
    <div class="method">
      <div class="lbl">Direct IP address <span class="badge best">Android / TV / any</span></div>
      <div class="val"><a href="{url}">{url}</a></div>
      <div class="note">Use this if the hostname above does not connect. This IP may change when Wi-Fi reconnects.</div>
    </div>
  </div>
  <p class="back"><a href="/">&larr; Back to LocalFlix</a></p>
  <script>
    const TARGET = {json.dumps(url)};
    function fallback() {{
      const img = document.createElement('img');
      img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(TARGET);
      img.alt = TARGET; img.width = 220; img.height = 220;
      document.getElementById('qr-wrap').innerHTML = '';
      document.getElementById('qr-wrap').appendChild(img);
    }}
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
    s.onload = () => {{
      document.getElementById('qr-wrap').innerHTML = '';
      try {{
        new QRCode(document.getElementById('qr-wrap'), {{
          text: TARGET, width: 220, height: 220,
          colorDark: '#000000', colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        }});
      }} catch(e) {{ fallback(); }}
    }};
    s.onerror = fallback;
    document.head.appendChild(s);
  </script>
</body></html>"""
        return Response(html, mimetype="text/html")

    # ------------------------------------------------------------------ api
    @app.route("/api/info")
    def info():
        movies = lib.scan()
        return jsonify({"name": "LocalFlix", "version": VERSION, "count": len(movies),
                        "movies_dir": cfg.movies_dir if is_local() else "", "movies_dir_ok": os.path.isdir(cfg.movies_dir),
                        "subtitle_files": len(subs.entries), "ffmpeg": media.available,
                        "online_lookup": bool(cfg.get("online_lookup")), "admin": is_local() or cfg.allow_remote_admin,
                        "poster_pending": posters.pending_count()})

    @app.route("/api/movies")
    def movies():
        ms = lib.scan()
        kick()
        return jsonify([pub(m) for m in ms])

    @app.route("/api/movies/<mid>")
    def movie(mid):
        m = lib.get(mid)
        if not m:
            abort(404)
        idx = {}
        tracks = [{"id": e["id"], "label": track_label(e, idx), "ext": e["ext"], "lang": e["lang"], "name": e["name"]}
                  for e in subs.match(m)]
        probe = media.probe(m["full"]) if media.ffprobe else None
        if probe:
            probe = {k: v for k, v in probe.items() if k != "streams"}
        d = pub(m)
        d.update({"tracks": tracks, "probe": probe, "overview": posters.info(mid).get("overview", ""),
                  "dur": (probe or {}).get("duration") or d["dur"]})
        sibs = [x for x in lib.scan() if x["folder"] == m["folder"] and x["id"] != mid]
        key = lambda x: x["name"].lower()
        nxt = [x for x in sorted(sibs + [m], key=key)]
        i = nxt.index(m)
        d["next"] = nxt[i + 1]["id"] if m["folder"] and i + 1 < len(nxt) else None
        return jsonify(d)

    @app.route("/poster/<mid>")
    def poster(mid):
        mid = re.sub(r"[^0-9a-f]", "", mid)
        w = request.args.get("w", type=int)
        p = posters.thumb(mid, w) if w else posters.path(mid)
        if not p:
            abort(404)
        r = send_file(p, conditional=True, max_age=86400)
        return r

    @app.route("/api/rescan", methods=["POST"])
    def rescan():
        lib.scan(force=True)
        kick()
        return jsonify({"count": len(lib._movies)})

    @app.route("/api/refresh-posters", methods=["POST"])
    def refresh_posters():
        if not (is_local() or cfg.allow_remote_admin):
            abort(403)
        posters.schedule(lib.scan(force=True), refresh=True)
        return jsonify({"queued": posters.pending_count()})

    @app.route("/api/settings", methods=["GET", "POST"])
    def settings():
        can = is_local() or cfg.allow_remote_admin
        if request.method == "POST":
            if not can:
                abort(403)
            body = request.get_json(silent=True) or {}
            for key in ("movies_dir", "subtitle_dir"):
                if key in body:
                    v = str(body[key]).strip().strip('"')
                    if v and not os.path.isdir(v):
                        return jsonify({"error": f"That folder does not exist: {v}"}), 400
                    cfg.set(key, v)
            if "online_lookup" in body:
                cfg.set("online_lookup", bool(body["online_lookup"]))
            if "tmdb_key" in body:
                cfg.set("tmdb_key", str(body["tmdb_key"]).strip())
            lib.scan(force=True)
            kick()
        return jsonify({"can_edit": can, "movies_dir": cfg.movies_dir if can else "",
                        "subtitle_dir": cfg.get("subtitle_dir") if can else "",
                        "online_lookup": bool(cfg.get("online_lookup")), "tmdb_key_set": bool(cfg.get("tmdb_key"))})

    # ------------------------------------------------------------------ media
    @app.route("/media/<mid>")
    def media_file(mid):
        m = lib.get(mid)
        if not m or not os.path.isfile(m["full"]):
            abort(404)
        return send_file(m["full"], mimetype=MIMES.get(os.path.splitext(m["full"])[1].lower(), "application/octet-stream"),
                         conditional=True, max_age=0)

    @app.route("/stream/<path:rel>")  # kept so the original TV app keeps working
    def legacy_stream(rel):
        m = lib.by_path(rel.replace("\\", "/"))
        if not m:
            abort(404)
        return media_file(m["id"])

    @app.route("/transcode/<mid>")
    def transcode(mid):
        m = lib.get(mid)
        if not m or not media.available:
            abort(404)
        try:
            start = max(0.0, float(request.args.get("start", 0)))
            audio = max(0, int(request.args.get("audio", 0)))
        except ValueError:
            abort(400)
        proc = subprocess.Popen(media.transcode_cmd(m["full"], start, audio), stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, creationflags=NOWIN)

        def gen():
            try:
                while True:
                    chunk = proc.stdout.read(65536)
                    if not chunk:
                        break
                    yield chunk
            finally:
                try:
                    proc.kill()
                except Exception:
                    pass
        return Response(gen(), mimetype="video/mp4", headers={"Cache-Control": "no-store"})

    # ------------------------------------------------------------------ subtitles
    def cues_for(sid):
        if sid in cache:
            return cache[sid]
        e = subs.find(sid)
        if not e:
            abort(404)
        try:
            with open(e["full"], "rb") as fh:
                cues = parse_subtitles(fh.read(), e["ext"])
        except OSError:
            abort(404)
        cache[sid] = cues
        return cues

    @app.route("/api/subtitle/<sid>")
    def subtitle_json(sid):
        return jsonify({"cues": cues_for(sid)})

    @app.route("/api/subtitle/<sid>.vtt")
    def subtitle_vtt(sid):
        return Response(to_vtt(cues_for(sid)), mimetype="text/vtt; charset=utf-8")

    def embedded(mid, n):
        m = lib.get(mid)
        if not m:
            abort(404)
        key = f"emb:{mid}:{n}"
        if key not in cache:
            raw = media.embedded_sub_vtt(m["full"], n)
            if not raw:
                abort(404)
            cache[key] = parse_subtitles(raw, "srt")
        return cache[key]

    @app.route("/api/embedded-subtitle/<mid>/<int:n>")
    def embedded_json(mid, n):
        return jsonify({"cues": embedded(mid, n)})

    @app.route("/api/embedded-subtitle/<mid>/<int:n>.vtt")
    def embedded_vtt(mid, n):
        return Response(to_vtt(embedded(mid, n)), mimetype="text/vtt; charset=utf-8")

    @app.route("/api/subtitle-library")
    def sub_library():
        q = (request.args.get("q") or "").lower()
        out = [{"id": e["id"], "name": e["name"], "ext": e["ext"], "lang": e["lang"]} for e in subs.entries
               if not q or q in e["name"].lower()]
        out.sort(key=lambda e: e["name"].lower())
        return jsonify(out[:300])

    @app.route("/api/subtitle-upload/<mid>", methods=["POST"])
    def sub_upload(mid):
        m = lib.get(mid)
        f = request.files.get("file")
        if not m or not f:
            abort(400)
        name = re.sub(r"[^A-Za-z0-9._ -]", "_", os.path.basename(f.filename or "subtitle.srt"))
        if os.path.splitext(name)[1].lower() not in SUB_EXTS:
            return jsonify({"error": "Use an .srt, .vtt, .ass, .ssa or .sub file."}), 400
        d = os.path.join(cfg.data_dir, "uploaded_subs", mid)
        os.makedirs(d, exist_ok=True)
        f.save(os.path.join(d, name))
        lib.scan(force=True)
        idx = {}
        tracks = [{"id": e["id"], "label": track_label(e, idx), "ext": e["ext"], "lang": e["lang"], "name": e["name"]}
                  for e in subs.match(m)]
        return jsonify({"tracks": tracks})

    return app
