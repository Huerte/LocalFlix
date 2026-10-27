# Troubleshooting

## ERR_CONNECTION_REFUSED on a phone or TV

A hidden Block rule for `python.exe` overrides the port rule. Run `fix_firewall.ps1` in an Administrator PowerShell and restart LocalFlix. See [network.md](network.md).

## ERR_ADDRESS_UNREACHABLE, or the address cannot be found

The device cannot reach the laptop at all.

1. Both devices must be on the same Wi-Fi, not one on a guest network.
2. Use the right address. Run `ipconfig` on the laptop and read the Wi-Fi IPv4 address.
3. Turn off AP isolation or client isolation in the router settings.

## DNS_PROBE_FINISHED_NXDOMAIN on `localflix.local`

Android does not resolve `.local` names. Use the IP address, and make it permanent with [a fixed address](network.md).

## The address keeps changing, or a router reservation does nothing

Follow [network.md](network.md). Check that the IP is inside the router's DHCP range, that the MAC matches `ipconfig /all`, and that random hardware addresses are off in Windows. Apply the change, wait for the router to restart, then turn Wi-Fi off and on. If it still fails, set the address on the laptop instead (Option B).

## No internet after setting a fixed IP

The gateway or DNS is wrong. In `ncpa.cpl`, open Wi-Fi, Properties, IPv4. The gateway should be your router (often `192.168.1.1`) and DNS `8.8.8.8` and `1.1.1.1`. Or switch both options back to "Obtain automatically".

## The phone reaches the laptop only sometimes

The laptop may be asleep or on another IP. Check that LocalFlix is still running, that Windows is not set to sleep while you watch, and that `ipconfig` shows the address you expect.

## Video plays on the laptop but not on the TV or phone

The device does not support the codec. Install ffmpeg so LocalFlix can convert the file. In the web player, try Settings, Playback, Compatibility mode. For stubborn files, convert them once with HandBrake (https://handbrake.fr) to H.264 MP4.

## Wrong title, such as "1080P"

Put the real title first in the file name:

```
Bad:   1080P.BluRay.Inception.2010.mkv
Good:  Inception.2010.1080p.BluRay.mkv
Good:  Inception (2010).mkv
```

## Subtitles not found

See [subtitles.md](subtitles.md).

## "ffmpeg not found" in the startup banner

ffmpeg is not on the Path. Follow the ffmpeg steps in [installation.md](installation.md), open a new PowerShell window (old ones do not see Path changes), and run `ffmpeg -version`.

## `/qr` shows 404 or an error

Stop LocalFlix with Ctrl+C and start it again, since an old copy does not know new pages. Open `/qr` on the laptop first: `http://localhost:8080/qr`. If `http://localhost:8080` itself shows an HTTP 500, update to the latest files.

## The keyboard does not appear in the TV app search box

Update the app and restart LocalFlix on the laptop. If it still fails, open an issue and say whether the box flashes and closes or nothing happens.
