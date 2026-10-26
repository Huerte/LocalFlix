#!/usr/bin/env python3
"""
LocalFlix - your own movie library, on every screen in the house.

    py localflix.py                     start the server
    py localflix.py --movies D:\\Films    use another folder
    py localflix.py --firewall          (Windows, run as Administrator) let phones and TVs connect
    py localflix.py --autostart         (Windows) start LocalFlix quietly when you sign in

Then open the address it prints on any phone, tablet, TV or computer on the same Wi-Fi.
"""
from __future__ import annotations

import argparse
import logging
import os
import subprocess
import sys
import threading
import webbrowser

# Make sure the console can print on every Windows code page.
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(errors="replace")
    except Exception:
        pass

from lf.core import VERSION, cfg  # noqa: E402


def parse_args():
    p = argparse.ArgumentParser(prog="localflix", description="Stream your local movies to any device on your network.")
    p.add_argument("--movies", help="folder that contains your movies")
    p.add_argument("--subtitles", help="folder that contains subtitle files (.srt, .vtt, .ass ...)")
    p.add_argument("--port", type=int, help="port to listen on (default 8080)")
    p.add_argument("--tmdb-key", help="optional free TMDB API key for better posters")
    p.add_argument("--no-online", action="store_true", help="never contact the internet (no poster lookup)")
    p.add_argument("--no-browser", action="store_true", help="do not open the browser automatically")
    p.add_argument("--local-only", action="store_true", help="only accept connections from this computer")
    p.add_argument("--remote-admin", action="store_true", help="let other devices change folder settings")
    p.add_argument("--firewall", action="store_true", help="Windows: allow the port through the firewall, then exit")
    p.add_argument("--autostart", action="store_true", help="Windows: start LocalFlix when you sign in, then exit")
    p.add_argument("--no-autostart", action="store_true", help="Windows: remove the sign-in start entry, then exit")
    return p.parse_args()


def open_firewall(port):
    if os.name != "nt":
        print("  --firewall is only needed on Windows.")
        return
    ok = True
    for name, proto, p in ((f"LocalFlix {port}", "TCP", port), ("LocalFlix discovery", "UDP", 50505)):
        res = subprocess.run(["netsh", "advfirewall", "firewall", "add", "rule", f"name={name}", "dir=in", "action=allow",
                              f"protocol={proto}", f"localport={p}", "profile=any"], capture_output=True, text=True)
        ok = ok and res.returncode == 0
    if ok:
        print("  Firewall rules added. Phones and TVs on your Wi-Fi can now connect.")
    else:
        print("  Could not add the rules. Right-click Command Prompt, choose 'Run as administrator', then run:")
        print("      py localflix.py --firewall")


def startup_file():
    return os.path.join(os.environ.get("APPDATA", ""), "Microsoft", "Windows", "Start Menu", "Programs", "Startup",
                        "LocalFlix.vbs")


def set_autostart(on):
    if os.name != "nt":
        print("  --autostart is for Windows only. On other systems add this script to your login items.")
        return
    path = startup_file()
    if not on:
        try:
            os.remove(path)
            print("  LocalFlix will no longer start by itself.")
        except OSError:
            print("  Nothing to remove.")
        return
    py = sys.executable
    pyw = py[:-10] + "pythonw.exe" if py.lower().endswith("python.exe") else py
    here = os.path.abspath(__file__)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write('CreateObject("Wscript.Shell").Run """%s"" ""%s"" --no-browser", 0, False\n' % (pyw, here))
    print("  Done. LocalFlix will start quietly in the background every time you sign in to Windows.")


def ask_for_folder():
    if not sys.stdin or not sys.stdin.isatty():
        return False
    print(f"\n  LocalFlix could not find your movie folder:\n    {cfg.movies_dir}\n")
    while True:
        try:
            path = input("  Type the full path of your movie folder (or press Enter to quit): ").strip().strip('"')
        except (EOFError, KeyboardInterrupt):
            return False
        if not path:
            return False
        if os.path.isdir(path):
            cfg.set("movies_dir", path)
            guess = os.path.join(path, "subtitle")
            cfg.set("subtitle_dir", guess if os.path.isdir(guess) else "")
            print("  Saved to config.json.\n")
            return True
        print("  That folder does not exist. Try again.")


def main():
    args = parse_args()
    cfg.load()
    if args.autostart or args.no_autostart:
        set_autostart(args.autostart)
        return
    if args.movies:
        cfg.set("movies_dir", os.path.expanduser(args.movies), persist=False)
        if not args.subtitles:
            guess = os.path.join(os.path.expanduser(args.movies), "subtitle")
            cfg.set("subtitle_dir", guess if os.path.isdir(guess) else "", persist=False)
    if args.subtitles:
        cfg.set("subtitle_dir", os.path.expanduser(args.subtitles), persist=False)
    if args.port:
        cfg.set("port", args.port, persist=False)
    if args.tmdb_key:
        cfg.set("tmdb_key", args.tmdb_key, persist=False)
    if args.no_online:
        cfg.set("online_lookup", False, persist=False)
    if args.local_only:
        cfg.host = "127.0.0.1"
    cfg.allow_remote_admin = args.remote_admin
    cfg.open_browser = not args.no_browser

    if args.firewall:
        open_firewall(cfg.port)
        return
    if not os.path.isdir(cfg.movies_dir) and not ask_for_folder():
        print(f"\n  Movie folder not found: {cfg.movies_dir}")
        print('  Fix it with:  py localflix.py --movies "D:\\Your\\Movies"\n')
        sys.exit(1)
    if not os.path.exists(cfg.path):
        cfg.save()

    from lf.server import create_app, lan_addresses, start_discovery, start_mdns
    app = create_app()
    count = len(app.services["lib"].scan(force=True))
    port = cfg.port
    line = "-" * 62
    print(f"\n  {line}\n   LocalFlix {VERSION}\n  {line}")
    print(f"   Movies     : {cfg.movies_dir}  ({count} found)")
    sd = cfg.subtitle_dirs
    print(f"   Subtitles  : {sd[0] if sd else 'none set'}  ({len(app.services['subs'].entries)} files)")
    print(f"   ffmpeg     : {'found' if app.services['media'].available else 'not found (optional, see README)'}")
    print(f"  {line}")
    print(f"   This computer   ->  http://localhost:{port}")
    if cfg.host != "127.0.0.1":
        _mdns = start_mdns(port)
        if _mdns:
            print(f"   Apple/Windows   ->  http://localflix.local:{port}  (Android phones/TVs usually can't resolve .local)")
        for i, ip in enumerate(lan_addresses()):
            label = "   Direct IP       ->" if i == 0 else "   Other network   ->"
            print(f"{label}  http://{ip}:{port}")
        print(f"\n   Android / TV: scan the QR at  http://localhost:{port}/qr  (or reserve the laptop's IP in your router)")
        print("\n   Phone or TV cannot connect?  Run once as Administrator:")
        print("       py localflix.py --firewall  then  .\\fix_firewall.ps1")
        start_discovery(port)
    print(f"  {line}\n   Press Ctrl+C to stop.\n")
    if cfg.open_browser:
        threading.Timer(1.0, lambda: webbrowser.open(f"http://localhost:{port}")).start()

    logging.getLogger("werkzeug").setLevel(logging.ERROR)
    try:
        import flask.cli
        flask.cli.show_server_banner = lambda *a, **k: None
    except Exception:
        pass
    try:
        try:
            from waitress import serve
        except ImportError:
            app.run(host=cfg.host, port=port, threaded=True, debug=False)
        else:
            logging.getLogger("waitress").setLevel(logging.ERROR)
            serve(app, host=cfg.host, port=port, threads=48, channel_timeout=300, ident="LocalFlix")
    except OSError as exc:
        print(f"\n  Could not start on port {port}: {exc}\n  Another program may be using it. Try:  py localflix.py --port 8090")
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n  Stopped.")
