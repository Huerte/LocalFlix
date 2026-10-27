#!/usr/bin/env python3
"""
LocalFlix TV monitor (Windows 11) - starts the LocalFlix server only when you are at home and your TV is on the Wi-Fi.

    py tv_monitor.py --setup     one-time questions: which Wi-Fi is "home" and which device is your TV
    py tv_monitor.py --check     show right now: at home? TV found? server running?
    py tv_monitor.py --run       the background loop (Task Scheduler runs this, see docs/tv-autostart.md)

What it does
  * The monitor only stays alive while ALL THREE are true: you are on the home network,
    the TV is on it too, and (once started) the server is running. Task Scheduler launches it every minute; if home or
    TV is missing it ends within a second or two, so the task shows "Ready" instead of "Running".
  * Not on your home network        -> the monitor ENDS ITSELF after about a minute, so nothing runs away from home.
                                       Windows starts it again when you connect to a network (Task Scheduler trigger).
  * At home, TV not on the Wi-Fi    -> ends within a second or two (Task Scheduler checks again every minute).
  * At home and the TV is found     -> starts `localflix.py --no-browser` hidden in the background.
  * TV leaves the Wi-Fi (or you leave home) for about 2 minutes in a row
                                     -> the server THIS MONITOR STARTED is stopped, then the monitor ends. A server you
                                        started yourself is never touched. (stop_server_when_tv_leaves, default on)
  * Server already running          -> nothing to do; it only looks again every 30 seconds.
  * keep_awake (default on)         -> while the server runs, you are home and the TV is on the Wi-Fi, Windows is asked
                                       not to go to sleep on its own (the screen may still turn off). Plugged in only,
                                       unless "keep_awake_on_battery" is true. Released as soon as the TV is gone.

It never starts the server away from home. Standard library only, no extra packages.
"""
from __future__ import annotations

import argparse
import json
import logging
import logging.handlers
import os
import re
import socket
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(HERE, "tv_monitor.json")
LOG_PATH = os.path.join(HERE, "tv_monitor.log")
SERVER_SCRIPT = os.path.join(HERE, "localflix.py")

DEFAULTS = {
    "home_ssids": [],              # Wi-Fi names that count as home, e.g. ["MyHomeWiFi"]
    "home_gateway_macs": [],       # router MAC(s): stronger proof of "home" than the name alone
    "tv_ip": "",                   # the TV's address (reserve it in your router so it never changes)
    "tv_mac": "",                  # the TV's MAC: protects against another device taking the TV's address
    "stop_server_when_tv_leaves": True,  # stop the server this monitor started once the TV is off the Wi-Fi (or you left home)
    "server_args": ["--no-browser"],   # extra arguments for localflix.py
    "port": 0,                     # 0 = read it from config.json (default 8080)
    "keep_awake": True,            # stop Windows sleeping on its own while the TV is using the server
    "keep_awake_on_battery": False,    # False: only keep awake while the charger is plugged in
}

AWAY_POLL = 30          # seconds between "am I home?" checks while away
BREAKAWAY = 0x01000000          # CREATE_BREAKAWAY_FROM_JOB: the server must not end together with the monitor
MIN_RESTART_GAP = 60    # never start the server twice within this many seconds
SWEEP_GAP = 120         # never sweep the whole network more often than this
KEEP_AWAKE_POLL = 30    # seconds between "is the TV still there?" checks while keeping the laptop awake
TV_MISS_LIMIT = 2       # TV missing this many checks in a row (about 60 s) -> let the laptop sleep again
STOP_MISS_LIMIT = 4     # TV missing this many checks in a row (about 2 min) -> stop the server we started (survives Wi-Fi blips)
PID_PATH = os.path.join(HERE, "tv_monitor.server.pid")   # remembers the server this monitor started (survives monitor restarts)

NO_WINDOW = 0x08000000          # CREATE_NO_WINDOW
NEW_GROUP = 0x00000200          # CREATE_NEW_PROCESS_GROUP

log = logging.getLogger("tv_monitor")


# ───────────────────────── small helpers ─────────────────────────

def run_cmd(args, timeout=6):
    """Run a console command without flashing a window. Returns its text output ('' on any failure)."""
    try:
        flags = NO_WINDOW if os.name == "nt" else 0
        res = subprocess.run(args, capture_output=True, timeout=timeout, creationflags=flags)
        return res.stdout.decode("utf-8", "replace")
    except Exception:
        return ""


def norm_mac(mac):
    m = re.sub(r"[^0-9a-fA-F]", "", mac or "").lower()
    return "-".join(m[i:i + 2] for i in range(0, 12, 2)) if len(m) == 12 else ""


def load_config():
    cfg = dict(DEFAULTS)
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as fh:
            cfg.update(json.load(fh))
    except FileNotFoundError:
        pass
    except Exception as exc:
        log.error("tv_monitor.json is not valid JSON: %s", exc)
    cfg["home_gateway_macs"] = [norm_mac(m) for m in cfg.get("home_gateway_macs", []) if norm_mac(m)]
    cfg["tv_mac"] = norm_mac(cfg.get("tv_mac", ""))
    cfg["home_ssids"] = [s for s in cfg.get("home_ssids", []) if s]
    return cfg


def save_config(cfg):
    out = {k: cfg.get(k, v) for k, v in DEFAULTS.items()}
    with open(CONFIG_PATH, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2)


def server_port(cfg):
    if cfg.get("port"):
        return int(cfg["port"])
    try:
        with open(os.path.join(HERE, "config.json"), "r", encoding="utf-8") as fh:
            return int(json.load(fh).get("port") or 8080)
    except Exception:
        return 8080


def port_open(port):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.5):
            return True
    except OSError:
        return False


# ───────────────────────── network facts (parsers are pure, so they can be tested) ─────────────────────────

def parse_ssids(text):
    """SSIDs from `netsh wlan show interfaces`. The label 'SSID' is not translated; 'BSSID' is a different label."""
    return [m.group(1).strip() for m in re.finditer(r"^\s*SSID\s*:\s*(.+?)\s*$", text, re.M) if m.group(1).strip()]


def parse_arp(text):
    """{ip: mac} from `arp -a`, without multicast / broadcast entries."""
    out = {}
    for m in re.finditer(r"^\s*(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F]{2}(?:-[0-9a-fA-F]{2}){5})\s+\w+", text, re.M):
        ip, mac = m.group(1), norm_mac(m.group(2))
        if int(ip.split(".")[0]) >= 224 or mac in ("ff-ff-ff-ff-ff-ff",) or mac.startswith("01-00-5e"):
            continue
        out[ip] = mac
    return out


def parse_default_route(text):
    """(gateway_ip, own_ip) of the default route with the lowest metric, from `route print -4 0.0.0.0`."""
    best = None
    for m in re.finditer(r"^\s*0\.0\.0\.0\s+0\.0\.0\.0\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+)", text, re.M):
        cand = (int(m.group(3)), m.group(1), m.group(2))
        if best is None or cand < best:
            best = cand
    return (best[1], best[2]) if best else (None, None)


def current_ssids():
    return parse_ssids(run_cmd(["netsh", "wlan", "show", "interfaces"]))


def arp_table():
    return parse_arp(run_cmd(["arp", "-a"]))


def ping(ip, wait_ms=700):
    out = run_cmd(["ping", "-n", "1", "-w", str(wait_ms), ip], timeout=4)
    return "TTL=" in out.upper()


def default_route():
    return parse_default_route(run_cmd(["route", "print", "-4", "0.0.0.0"]))


def gateway_mac():
    gw, _ = default_route()
    if not gw:
        return ""
    mac = arp_table().get(gw, "")
    if not mac:
        ping(gw)
        mac = arp_table().get(gw, "")
    return mac


def sweep_network():
    """Ping every address of the local /24 once so the ARP table lists every device that is awake."""
    _, own = default_route()
    if not own:
        return
    prefix = own.rsplit(".", 1)[0]
    with ThreadPoolExecutor(max_workers=24) as pool:
        list(pool.map(lambda n: ping(f"{prefix}.{n}", 300), range(1, 255)))


# ───────────────────────── the two questions: "at home?" and "TV there?" ─────────────────────────

def is_home(cfg):
    ssids = [s.lower() for s in cfg["home_ssids"]]
    gws = cfg["home_gateway_macs"]
    if not ssids and not gws:
        return False
    if ssids and not any(s.lower() in ssids for s in current_ssids()):
        return False
    if gws and gateway_mac() not in gws:
        return False
    return True


class TvFinder:
    def __init__(self, cfg):
        self.cfg = cfg
        self.last_sweep = 0.0

    def present(self):
        ip, mac = self.cfg["tv_ip"], self.cfg["tv_mac"]
        if ip and ping(ip):
            # Something answers at the TV's address. If we know the TV's MAC, make sure it is really the TV.
            seen = arp_table().get(ip, "")
            if not mac or seen == mac:
                return True
        if not mac:
            return False
        # The address may have changed: look the MAC up (and, at most every SWEEP_GAP seconds, scan the network).
        for attempt in (0, 1):
            for found_ip, found_mac in arp_table().items():
                if found_mac == mac and ping(found_ip):
                    if found_ip != self.cfg["tv_ip"]:
                        log.info("The TV is now at %s (was %s).", found_ip, self.cfg["tv_ip"] or "unknown")
                        self.cfg["tv_ip"] = found_ip
                    return True
            if attempt == 0:
                if time.time() - self.last_sweep < SWEEP_GAP:
                    return False
                self.last_sweep = time.time()
                sweep_network()
        return False


# ───────────────────────── starting / stopping the server ─────────────────────────

def pythonw():
    exe = sys.executable
    if exe.lower().endswith("python.exe"):
        cand = exe[:-10] + "pythonw.exe"
        if os.path.exists(cand):
            return cand
    return exe


def start_server(cfg):
    cmd = [pythonw(), SERVER_SCRIPT] + list(cfg["server_args"])
    log.info("Starting LocalFlix: %s", " ".join(cmd))
    flags = (NO_WINDOW | NEW_GROUP) if os.name == "nt" else 0
    kw = dict(cwd=HERE, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    proc = None
    if os.name == "nt":
        try:        # leave Task Scheduler's job, so the server keeps running when the monitor ends
            proc = subprocess.Popen(cmd, creationflags=flags | BREAKAWAY, **kw)
        except OSError:
            pass
    if proc is None:
        proc = subprocess.Popen(cmd, creationflags=flags, **kw)
    write_pid(proc.pid)
    return proc


def write_pid(pid):
    try:
        with open(PID_PATH, "w", encoding="utf-8") as fh:
            fh.write(str(pid))
    except OSError:
        log.warning("Could not write %s", PID_PATH)


def read_pid():
    try:
        with open(PID_PATH, "r", encoding="utf-8") as fh:
            return int(fh.read().strip())
    except (OSError, ValueError):
        return 0


def clear_pid():
    try:
        os.remove(PID_PATH)
    except OSError:
        pass


def pid_is_localflix(pid, port):
    """True when `pid` is alive AND is our localflix.py (guards against a recycled PID)."""
    if not pid:
        return False
    if os.name == "nt":
        out = run_cmd(["powershell", "-NoProfile", "-NonInteractive", "-Command",
                       f"(Get-CimInstance Win32_Process -Filter 'ProcessId={int(pid)}').CommandLine"], timeout=10)
        if out.strip():
            return "localflix.py" in out.lower()
        # PowerShell gave nothing (blocked?): fall back to "the process exists and the server port answers".
        alive = f'"{int(pid)}"' in run_cmd(["tasklist", "/FI", f"PID eq {int(pid)}", "/FO", "CSV", "/NH"])
        return alive and port_open(port)
    try:
        os.kill(pid, 0)
        with open(f"/proc/{pid}/cmdline", "rb") as fh:
            return b"localflix.py" in fh.read()
    except FileNotFoundError:
        return True            # no /proc (macOS): the process exists, trust the pid file
    except OSError:
        return False


def owned_server_pid(proc, port):
    """PID of the server this monitor started (also in an earlier monitor run), or 0 when there is none."""
    if proc and proc.poll() is None:
        return proc.pid
    pid = read_pid()
    if pid and pid_is_localflix(pid, port):
        return pid
    if pid:
        clear_pid()
    return 0


def stop_server(pid, port):
    """Stop the server process tree and wait (a few seconds) until its port is closed."""
    log.info("The TV is gone: stopping the LocalFlix server that this monitor started (pid %s).", pid)
    if os.name == "nt":
        run_cmd(["taskkill", "/PID", str(pid), "/T", "/F"])
    else:
        try:
            os.kill(pid, 15)
        except OSError:
            pass
    for _ in range(12):
        if not port_open(port):
            break
        time.sleep(0.5)
    clear_pid()


# ───────────────────────── keep Windows awake while the TV is watching ─────────────────────────

def plugged_in():
    """True when on mains power (or when it cannot be told, e.g. a desktop PC)."""
    if os.name != "nt":
        return True
    import ctypes
    from ctypes import wintypes

    class PowerStatus(ctypes.Structure):
        _fields_ = [("ACLineStatus", ctypes.c_ubyte), ("BatteryFlag", ctypes.c_ubyte),
                    ("BatteryLifePercent", ctypes.c_ubyte), ("SystemStatusFlag", ctypes.c_ubyte),
                    ("BatteryLifeTime", wintypes.DWORD), ("BatteryFullLifeTime", wintypes.DWORD)]
    st = PowerStatus()
    if not ctypes.windll.kernel32.GetSystemPowerStatus(ctypes.byref(st)):
        return True
    return st.ACLineStatus != 0           # 0 = battery, 1 = mains, 255 = unknown


class KeepAwake:
    """Asks Windows not to sleep by itself (SetThreadExecutionState). The screen may still turn off.
    The request belongs to the calling thread, so always call set() from the main loop."""
    ES_CONTINUOUS = 0x80000000
    ES_SYSTEM_REQUIRED = 0x00000001

    def __init__(self, cfg):
        self.cfg = cfg
        self.on = False

    def set(self, want):
        if want and not self.cfg["keep_awake_on_battery"] and not plugged_in():
            want = False                    # on battery: let the laptop sleep, protect the battery
        if not self.cfg["keep_awake"]:
            want = False
        if want == self.on:
            return
        if os.name == "nt":
            import ctypes
            flags = self.ES_CONTINUOUS | (self.ES_SYSTEM_REQUIRED if want else 0)
            ctypes.windll.kernel32.SetThreadExecutionState(flags)
        self.on = want
        log.info("Keeping Windows awake: %s", "ON (TV is using the server)" if want else "OFF (laptop may sleep again)")


# ───────────────────────── the background loop ─────────────────────────

def single_instance():
    """One monitor at a time (a second copy exits immediately)."""
    if os.name != "nt":
        return True
    import ctypes
    k32 = ctypes.windll.kernel32
    k32.CreateMutexW(None, False, "Local\\LocalFlixTvMonitor")
    return k32.GetLastError() != 183       # 183 = ERROR_ALREADY_EXISTS


def run_strict(cfg, finder, awake, port):
    """Alive only while (at home AND the TV is on the Wi-Fi) OR a server this monitor started is still waiting to be stopped.
    Launched by Task Scheduler every minute: with no home / no TV and nothing of ours running it exits at once.
    Once both are true it starts the server if needed and keeps the laptop awake. When the TV (or home) is gone for
    STOP_MISS_LIMIT checks in a row (about 2 minutes) it stops the server it started and ends."""
    first, misses, proc, last_start = True, 0, None, 0.0
    stop_flag = cfg["stop_server_when_tv_leaves"]
    while True:
        try:
            tv = is_home(cfg) and finder.present()      # away from home counts as "TV gone"
            misses = 0 if tv else misses + 1
            if not tv:
                if misses >= TV_MISS_LIMIT:
                    awake.set(False)
                mine = owned_server_pid(proc, port) if stop_flag else 0
                if misses >= (STOP_MISS_LIMIT if mine else (1 if first else TV_MISS_LIMIT)):
                    if mine:
                        stop_server(mine, port)
                        proc = None
                    log.info("Home or TV is gone: the monitor ends.%s", "" if mine else " (a server that is running stays.)")
                    return
                first = False
                time.sleep(KEEP_AWAKE_POLL)
                continue
            if first:
                log.info("At home and the TV is on the Wi-Fi: monitor active (TV %s, port %s).", cfg["tv_ip"], port)
            first = False
            up = port_open(port)
            running = up or bool(proc and proc.poll() is None)
            if not running and time.time() - last_start >= MIN_RESTART_GAP:
                proc = start_server(cfg)
                last_start = time.time()
                time.sleep(10)
                continue
            awake.set(running)
            time.sleep(KEEP_AWAKE_POLL)
        except Exception:
            log.exception("Unexpected error (the monitor keeps going)")
            time.sleep(AWAY_POLL)


def run_loop():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s",
                        handlers=[logging.handlers.RotatingFileHandler(LOG_PATH, maxBytes=200_000, backupCount=1, encoding="utf-8")])
    if not single_instance():
        log.info("Another monitor is already running; this copy exits.")
        return
    cfg = load_config()
    if not cfg["home_ssids"] and not cfg["home_gateway_macs"]:
        log.error("No home network is set. Run:  py tv_monitor.py --setup")
        return
    if not cfg["tv_ip"] and not cfg["tv_mac"]:
        log.error("No TV is set. Run:  py tv_monitor.py --setup")
        return
    port = server_port(cfg)
    finder = TvFinder(cfg)
    awake = KeepAwake(cfg)
    return run_strict(cfg, finder, awake, port)


# ───────────────────────── --check and --setup ─────────────────────────

def do_check():
    cfg = load_config()
    port = server_port(cfg)
    ssids = current_ssids()
    gmac = gateway_mac()
    print(f"\n  Wi-Fi name now      : {', '.join(ssids) if ssids else '(not readable / not on Wi-Fi)'}")
    print(f"  Router MAC now      : {gmac or '(unknown)'}")
    print(f"  Home Wi-Fi names    : {cfg['home_ssids'] or '(none)'}")
    print(f"  Home router MACs    : {cfg['home_gateway_macs'] or '(none)'}")
    print(f"  At home?            : {'YES' if is_home(cfg) else 'no'}")
    print(f"  TV ({cfg['tv_ip'] or cfg['tv_mac'] or 'not set'})".ljust(24) + f": {'FOUND on the Wi-Fi' if TvFinder(cfg).present() else 'not found'}")
    print(f"  Server on port {port:<5}: {'running' if port_open(port) else 'not running'}")
    print(f"  Keep awake          : {'on' if cfg['keep_awake'] else 'off'}"
          f"{'' if cfg['keep_awake_on_battery'] else ' (only while plugged in)'}"
          f", charger {'plugged in' if plugged_in() else 'NOT plugged in'}\n")


def ask(prompt, default=""):
    try:
        v = input(prompt).strip()
    except (EOFError, KeyboardInterrupt):
        print()
        sys.exit(1)
    return v or default


def do_setup():
    if os.name != "nt":
        print("  This tool is for Windows.")
        return
    cfg = load_config()
    print("\n  LocalFlix TV monitor - one-time setup\n  Make sure this laptop is on your HOME Wi-Fi and the TV is switched on.\n")
    ssids = current_ssids()
    gmac = gateway_mac()
    if ssids:
        print(f"  Wi-Fi network now : {ssids[0]}")
    else:
        print("  Could not read the Wi-Fi name (Windows 11 needs 'Location services' ON for that: Settings > Privacy > Location).")
        print("  That is fine, the router address below is enough.")
    print(f"  Router address    : {gmac or 'unknown'}")
    if not (ssids or gmac):
        print("\n  No network found. Connect to your home Wi-Fi first.")
        return
    if ask("\n  Is this your home network? [Y/n] ", "y").lower() != "y":
        print("  Connect to your home network and run setup again.")
        return
    cfg["home_ssids"] = ssids[:1]
    cfg["home_gateway_macs"] = [gmac] if gmac else []

    print("\n  Looking for devices on your Wi-Fi (about 10 seconds)...")
    sweep_network()
    gw, own = default_route()
    devices = [(ip, mac) for ip, mac in sorted(arp_table().items(), key=lambda kv: tuple(int(x) for x in kv[0].split(".")))
               if ip not in (gw, own) and ip.rsplit(".", 1)[0] == (own or "").rsplit(".", 1)[0]]
    if devices:
        print("\n   #   IP address        MAC address")
        for i, (ip, mac) in enumerate(devices, 1):
            print(f"  {i:>2}   {ip:<16}  {mac}")
    print("\n  Your TV shows its own IP address in: Settings > Network & Internet > (your Wi-Fi) .")
    choice = ask("  Type the number from the list, or the TV's IP address: ")
    tv_ip = ""
    if choice.isdigit() and 1 <= int(choice) <= len(devices):
        tv_ip = devices[int(choice) - 1][0]
    elif re.fullmatch(r"\d+\.\d+\.\d+\.\d+", choice):
        tv_ip = choice
    if not tv_ip:
        print("  Nothing chosen. Run setup again.")
        return
    if not ping(tv_ip):
        print(f"  {tv_ip} does not answer right now. Is the TV on and on this Wi-Fi? Run setup again.")
        return
    cfg["tv_ip"] = tv_ip
    cfg["tv_mac"] = arp_table().get(tv_ip, "")
    save_config(cfg)
    print(f"\n  Saved to tv_monitor.json:  TV {cfg['tv_ip']} ({cfg['tv_mac'] or 'MAC unknown'}).")
    print("  Tip: reserve this address for the TV in your router so it never changes.")
    print("  Next: run   py tv_monitor.py --check   and then install the Task Scheduler task (see docs/tv-autostart.md).\n")


def main():
    p = argparse.ArgumentParser(prog="tv_monitor", description="Start LocalFlix when you are home and the TV is on the Wi-Fi.")
    g = p.add_mutually_exclusive_group()
    g.add_argument("--setup", action="store_true", help="choose the home network and the TV (one time)")
    g.add_argument("--check", action="store_true", help="show the current status once")
    g.add_argument("--run", action="store_true", help="run the background monitor (default)")
    a = p.parse_args()
    if a.setup:
        do_setup()
    elif a.check:
        do_check()
    else:
        run_loop()


if __name__ == "__main__":
    main()
