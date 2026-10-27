# Security

## Supported versions

Only the latest release gets fixes.

## What to know before you run it

LocalFlix has no login. Anyone who can reach the port can browse and play your library. It is made for a trusted home network.

- Do not forward the port on your router and do not expose it to the internet.
- Do not run it on a public or shared Wi-Fi.
- `--local-only` limits access to the laptop itself.
- Other devices cannot change the folder settings unless you start it with `--remote-admin`. Leave that off unless you need it.

## Reporting a vulnerability

Please do not open a public issue. Use "Report a vulnerability" in the Security tab of the GitHub repository. If that is not available, contact [@Huerte](https://github.com/Huerte) on GitHub.

Include what you found, how to reproduce it, and the version from the startup banner. Expect a first reply within a week.
