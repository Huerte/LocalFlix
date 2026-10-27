# Use a phone hotspot instead of a router

This guide is for people who have **no router**, or who have no Wi-Fi at home, or who are in a place where they cannot use the Wi-Fi (a dorm, a rented room, a trip).

A **hotspot** means your phone makes its own Wi-Fi. Other devices join it, like they join a router. LocalFlix does **not** need the internet to play your movies. It only needs the devices to be on the **same Wi-Fi**. So a hotspot can do the job of the router.

You do not need to know about computers. Follow the steps in order. Take your time.

> **I want to be honest with you.** This should work on most phones, but I did not test it on every phone. Some phone brands block hotspot devices from seeing each other. If that happens, nothing connects, and there is no fix on that phone. See [If nothing connects](#if-nothing-connects).

## Read this first: what does NOT work with a hotspot

> **DOES NOT WORK, or works differently, with a hotspot. Do not follow these parts:**

| Do NOT use this | Why | What to do instead |
|---|---|---|
| [Step 8 of the setup guide](setup-guide.md#step-8-give-the-laptop-an-address-that-does-not-change), **Way A** (ask the router to keep the address) | A hotspot has no router page. You cannot reserve an address. | Read the address again each time (see [Find the address](#find-the-address-of-the-server)). |
| Step 8, **Way B** (fixed address typed on the laptop) | The hotspot chooses its own numbers. A number you type may not fit, and then the laptop has no connection. It may also break your normal Wi-Fi later. | Do not use it with a hotspot. |
| The QR page `/qr` when there is **no internet** | The page loads the QR picture from the internet. With no internet, the picture does not appear. | Type the address by hand. |
| `http://localflix.local:8080` on Android phones and Android TVs | Android does not understand names that end in `.local`. | Use the numbers address. |
| The TV auto-start helper (`tv_monitor.py`, [Start LocalFlix by itself](tv-autostart.md)) | It is built around one **home Wi-Fi name** and a TV address that stays the same. A hotspot changes both, and I did not make or test the helper for it. | Start LocalFlix by hand. |
| Being on **two Wi-Fi networks at the same time** | Most phones cannot join a Wi-Fi and share a hotspot at the same time. | Choose one. |
| Seeing posters from the internet | Online poster lookup needs internet. | Add `--no-online` when you start LocalFlix. |
| Setting the same fixed address "once and forever" | The hotspot may give different numbers each day. | Always check the address before you watch. |

Everything else (Python, ffmpeg, the firewall step on Windows, the wake lock on a phone) works as in the normal guides.

## Choose your setup

Pick **one** of these. Each one has its own steps below.

| | Server (keeps the movies) | Hotspot (makes the Wi-Fi) | Watch on | Good for |
|---|---|---|---|---|
| **A** | Windows laptop | Phone | TV, other phones | You have a laptop but no router |
| **B** | Android phone (Termux) | The **same phone** | TV, other phones | You have only one phone. Simplest. |
| **C** | Android phone (Termux) | **Another** phone | TV, other phones | The server phone is busy or you have two phones |

Picture of setup B (the simplest):

```
[Android phone]  Hotspot is ON. LocalFlix runs in Termux. The movies are here.
      |
      |  the phone's own Wi-Fi
      |
[TV or other phone]  Joins the hotspot, then opens LocalFlix.
```

## Step 1. Turn on the hotspot

The names are a little different on each phone. Look for words like these.

1. Open the phone **Settings**.
2. Open **Network & internet** (or **Connections**). Open **Hotspot & tethering** (or **Mobile Hotspot**).
3. Tap **Wi-Fi hotspot** (or **Mobile Hotspot**).
4. Look at the **name** and the **password**. You can change them. Choose a password that is long and that only you know.
5. Turn the hotspot **On**.

Then check the options on the same page:

| Option | What to do |
|---|---|
| **Band** (2.4 GHz or 5 GHz) | Choose **5 GHz** if your TV can use it. It is faster for movies. If the TV cannot see the hotspot, choose **2.4 GHz**. |
| **Turn off hotspot automatically** (or **Auto hotspot off**, **Timeout**) | Turn this **off**, or choose the longest time. Many phones switch the hotspot off when no device is joined for a few minutes. |
| **Maximize compatibility** (Samsung) | Turn **on** if the TV cannot see the hotspot. |
| **Block** or **Allowed devices** list | Make sure it does not block your TV. |

> **Mobile data:** some phones or phone companies do not start a hotspot if mobile data is off, or if you have no plan. If your hotspot will not start, turn on **mobile data**. LocalFlix itself does not use mobile data. But **other devices that join the hotspot can use it** (for example a TV that updates apps). If you pay for data, turn off updates on the TV, and watch your data use.

## Step 2. Connect the other devices to the hotspot

**TV:**

1. On the TV, open **Settings**, then **Network** (or **Network & Internet**).
2. Choose **Wi-Fi**. Pick the hotspot name. Type the password.

**Another phone or tablet:** open **Settings**, **Wi-Fi**, pick the hotspot name, type the password.

> **If the TV cannot see the hotspot name:** try the other band (2.4 or 5 GHz) in Step 1. Also bring the TV and the phone closer to each other.

Now follow **your** setup below.

## Setup A. Windows laptop + phone hotspot

1. Do **Steps 1 to 7 and 9** of the [setup guide](setup-guide.md) as normal (Python, LocalFlix, ffmpeg, movie folder, firewall, sleep). You can do these steps **before** you use the hotspot, with your normal internet.
2. **Skip Step 8** of the setup guide. (It does not work with a hotspot.)
3. Turn on the hotspot on the phone (Step 1 above).
4. On the laptop, click the Wi-Fi icon. Join the hotspot.
5. Connect the TV or other phone to the hotspot (Step 2 above).
6. On the laptop, open **PowerShell in the LocalFlix folder** (see [B in the setup guide](setup-guide.md#b-open-powershell-in-the-localflix-folder)). Start LocalFlix:

```powershell
py localflix.py
```

If there is no internet on the hotspot (mobile data is off), use this instead:

```powershell
py localflix.py --no-online
```

7. Read the **Direct IP** line in the LocalFlix window. On a laptop, this line is usually right. For example `http://192.168.43.101:8080`. **The number is new each time you join a hotspot, so read it each time.**
8. On the TV or other phone, type that address.

If Windows shows a window that says it blocked some features of Python, click **Allow access**. If the TV gets `ERR_CONNECTION_REFUSED`, do [Step 7 of the setup guide](setup-guide.md#step-7-let-phones-and-tvs-connect) again. It still applies, also on a hotspot.

> **QR code on the laptop:** if the laptop has internet through the hotspot, `http://localhost:8080/qr` works. A phone can scan it. It uses a very small amount of data.

## Setup B. Android phone is the server AND the hotspot

This is the simplest setup if you have only one phone. First finish [the phone server guide](phone-server.md) up to **Step 8**. You can do those steps with your normal Wi-Fi or mobile data. Then:

1. Turn on the hotspot (Step 1 above).
2. Connect the TV or other phone to the hotspot (Step 2 above).
3. Open **Termux** on the server phone. Type:

```
termux-wake-lock
cd ~/LocalFlix-Server
python localflix.py --movies "$HOME/storage/shared/Movies" --no-browser --no-online
```

Use your own movie folder name instead of `Movies`. Take away `--no-online` if mobile data is on and you want posters from the internet.

4. Find the address (see [Find the address of the server](#find-the-address-of-the-server)). **Do not trust the Direct IP line.** On a phone that makes a hotspot, it may show `127.0.0.1` or a mobile data number that does not work.
5. On the TV or other phone, type the address, for example `http://192.168.43.1:8080`.

The server phone is also the hotspot, so **the server address is the address of the hotspot itself.** It is often the same each time on the same phone, but this is **not guaranteed**. Check it before you watch.

To watch on the server phone itself, open `http://localhost:8080`. It always works.

## Setup C. Android phone server + another phone makes the hotspot

Use this if the server phone should not be the hotspot (for example, the other phone has more battery or a better data plan).

1. On **phone 2**, turn on the hotspot (Step 1 above).
2. On the **server phone** (phone 1), join the hotspot. Open **Settings**, **Wi-Fi**, pick the hotspot name, type the password.
3. Connect the TV or other devices to the hotspot of phone 2 (Step 2 above).
4. On the server phone, open Termux. Start LocalFlix as in the phone guide:

```
termux-wake-lock
cd ~/LocalFlix-Server
python localflix.py --movies "$HOME/storage/shared/Movies" --no-browser --no-online
```

5. Find the address (next part). The server phone gets a new address from the hotspot. It may change every time. Check it each time.

**Both phones need power.** Keep both plugged in. Phone 2 must stay awake and keep the hotspot on. Turn off its **auto hotspot off** setting.

## Find the address of the server

The Direct IP line may be wrong on a phone. Use one of these ways. They are the real address.

### Way 1. Server phone is on a Wi-Fi (setups A and C, or a phone on the router)

1. On the server device, open **Settings**, **Wi-Fi**.
2. Tap the hotspot network (or the small gear icon).
3. Find **IP address**. It looks like `192.168.43.57`.

### Way 2. Server phone makes the hotspot (setup B)

You need the address of the phone itself. You can find it from a device that joined the hotspot:

1. On the **TV** or **other phone**, open its Wi-Fi details for the hotspot. (On a phone: **Settings**, **Wi-Fi**, tap the hotspot network, or the gear icon. On a TV: **Settings**, **Network**, the hotspot name, **Status** or **Advanced**.)
2. Find **Gateway** (it may be called **Router**). That number is the address of the server phone. For example `192.168.43.1`.

Your LocalFlix address is the number, then `:8080`:

```
http://192.168.43.1:8080
```

(Use **your** number. Yours will be different.)

You can also try in Termux: `pkg install net-tools`, then `ifconfig`. Look for a line `inet` with a number like `192.168...`. On new Android versions this may show nothing. If so, use Way 2 above.

## Step 3. Check that it works

1. On the **server**, check that LocalFlix is running.
2. On the **TV or other phone**, open the browser. Type the address with `http://` at the start and `:8080` at the end.
3. Your movies appear.

> **You should see:** the LocalFlix page.

### TV app

- If you use the LocalFlix TV app: it tries its saved address first, and then it looks for the server by itself. A hotspot changes the address, so the saved address often stops working. The automatic search **may** find the server, but I have not tested this on a hotspot. If it does not, type the new address in the app and press **Connect**.
- Making the TV app file needs a computer. See [Android TV app](tv-app.md). With no laptop, use the TV browser.

## Keep it working while you watch

- Keep the server device **plugged in**. The hotspot and the server both use a lot of battery.
- On the phone, turn off battery saving for **Termux** (and keep the wake lock on). See [Step 8 of the phone guide](phone-server.md#step-8-keep-the-phone-awake).
- Turn off **auto hotspot off** (Step 1). If the hotspot switches off, the TV loses LocalFlix.
- Keep the phone cool. A phone that is a hotspot **and** a server gets hot. Take off the case. Do not put it in the sun.
- Do not turn off the phone Wi-Fi or hotspot while you watch.
- **Every day, check the address again.** It can change when the hotspot or the server restarts.

## If nothing connects

Try these in order:

1. All devices are on the **same hotspot**. Not on a different Wi-Fi.
2. LocalFlix is running on the server. On the server itself, `http://localhost:8080` must open. If it does not, LocalFlix is not running.
3. The address is right. Read it again (see [Find the address of the server](#find-the-address-of-the-server)).
4. The address starts with `http://` and ends with `:8080` (or your port number).
5. On the server phone, turn off any **VPN** app.
6. On a laptop server: do [Step 7 of the setup guide](setup-guide.md#step-7-let-phones-and-tvs-connect).
7. Turn the hotspot off, wait 10 seconds, turn it on. Join the devices again. Read the address again.
8. Look in the hotspot settings for a switch like **Isolate clients**, **AP isolation** or **Allow devices to see each other**. If there is one, set it so that devices **can** see each other.

If still nothing connects, your phone may **block devices from seeing each other**. Many phones do this and give no switch to change it. **There is no fix on that phone.** Use another hotspot phone (setup C with a different phone), or a normal router.

## Summary: what works with a hotspot

| Thing | With a hotspot |
|---|---|
| Watching movies | **Works** |
| Internet | Not needed for movies |
| Address with numbers, typed by hand | **Works** |
| Reserved or fixed address | **Does not work** (no router page) |
| QR page | Works **only with internet** |
| Name `localflix.local` | **Does not work** on Android. Only some iPhones and Macs. |
| TV auto-start helper | **Does not work** |
| TV app automatic search | Maybe (I have not tested it) |
| Online posters | Only with internet. Without internet, add `--no-online`. |

## What to read next

- [Use an Android phone as the server](phone-server.md): no laptop.
- [Complete setup guide](setup-guide.md): for a Windows laptop.
- [Fixes for common problems](troubleshooting.md): when something does not work.

LocalFlix is for personal use on your own network.
