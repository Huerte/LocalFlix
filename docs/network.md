# Network and firewall

## Windows firewall

Do this once per laptop, in an Administrator PowerShell (right-click PowerShell, Run as Administrator).

1. Allow the port:

```powershell
cd C:\path\to\LocalFlix
py localflix.py --firewall
```

2. Remove the hidden Block rule. The first time Windows sees Python listen on the network it can add a Block rule for `python.exe`, and that rule wins over the port rule. Phones and TVs then get `ERR_CONNECTION_REFUSED`. The included script removes it and adds an Allow rule:

```powershell
.\fix_firewall.ps1
```

To check, this should list nothing:

```powershell
Get-NetFirewallRule -Action Block -Enabled True -Direction Inbound |
    Get-NetFirewallApplicationFilter |
    Where-Object { $_.Program -like "*python*" }
```

Restart `py localflix.py` afterwards.

## A fixed address for the laptop

Your router can hand the laptop a new IP address at any time, which breaks the address saved on your phone and TV. Fix the laptop only. Phones and TVs can keep changing.

First, run `ipconfig /all` and note these under Wi-Fi: IPv4 Address, Subnet Mask, Default Gateway (your router) and Physical Address (the MAC address).

Then turn off random addresses: Settings, Network & internet, Wi-Fi, your network, Random hardware addresses: Off.

### Option A: reserve the address in the router

1. Open the router page in a browser (the Default Gateway, often `http://192.168.1.1`).
2. Find the DHCP reservation page. It may be called Reserved IP, Address Reservation, Static DHCP or DHCP Binding.
3. Add the laptop's current IP and its Physical Address, then save or apply. Some routers restart.
4. Turn the laptop Wi-Fi off and on, and check with `ipconfig` that the IP is the same.

If the new row does not appear, use an IP inside the router's DHCP range (the one the laptop already has), try the MAC with dashes, colons or no separators in capitals, and refresh the page. If it still fails, use Option B.

### Option B: set the address on the laptop

Pick an IP outside the router's DHCP range, for example `192.168.1.10` when the range starts at `.33`.

1. Press the Windows key, type `ncpa.cpl`, press Enter.
2. Right-click Wi-Fi, Properties, double-click Internet Protocol Version 4 (TCP/IPv4).
3. Choose "Use the following IP address" and enter IP `192.168.1.10`, subnet mask `255.255.255.0`, gateway `192.168.1.1`.
4. Choose "Use the following DNS server addresses" and enter `8.8.8.8` and `1.1.1.1`.
5. Click OK and check `ipconfig`.

This setting stays on the Wi-Fi adapter for every network. At school, work or a cafe, switch both options back to "Obtain automatically" or the internet will not work.

Restart LocalFlix afterwards. The Direct IP line should show the fixed address. Use it on all devices.

## Connecting devices

| Method | Address | iPhone, Mac, Windows | Android phone, Android TV |
|---|---|---|---|
| Direct IP | `http://192.168.1.10:8080` | Yes | Yes |
| QR code | `http://localhost:8080/qr`, opened on the laptop | Yes | Scan with a phone |
| Name | `http://localflix.local:8080` | Yes | Usually no |

Android Chrome and most Android TVs do not resolve `.local` names (mDNS), so they show `DNS_PROBE_FINISHED_NXDOMAIN`. Use the IP address there.

On a phone, Chrome's menu has Add to Home screen, which gives an app-like icon.

## Smart TV browser

Open the TV's Internet or Browser app and type the Direct IP. The TV must be on the same Wi-Fi as the laptop, not a guest network.

| Remote | Action |
|---|---|
| Arrow keys | Move between cards |
| OK | Open or confirm |
| Back | Close the player or go back |
| Left, Right while playing | Back or forward 10 s |
| Up, Down while playing | Volume |
| OK twice on the video | Fullscreen on or off |

For a better experience use the [Android TV app](tv-app.md).
