# Forecast Pilot on Linux

Forecast Pilot runs on Linux through [Vicinae](https://vicinae.com), an
open-source launcher whose extension API is compatible with Raycast's. Vicinae
serves its own implementation of `@raycast/api` at runtime, so the extension's
views, favorites, caching, and forecast logic behave exactly as they do on
macOS.

Beyond parity, the Linux build uses capabilities Raycast does not offer:

| Capability | Used for |
| --- | --- |
| `sendDesktopNotification` | Severe weather and incoming-rain alerts |
| `no-view` command on an `interval` | The Weather Watch background refresh |
| `vicinae cmd launch`, deeplinks | Keybinds, scripts, and terminal use |
| `Wallpaper.set` | Setting the weekend plan card as wallpaper |

---

## Contents

- [Requirements](#requirements)
- [Install](#install)
- [Weather Watch and notifications](#weather-watch-and-notifications)
- [Status file](#status-file)
  - [Waybar](#waybar)
  - [quickshell, eww, and other bars](#quickshell-eww-and-other-bars)
- [Launching from outside the launcher](#launching-from-outside-the-launcher)
  - [Hyprland keybinds](#hyprland-keybinds)
- [Wallpaper](#wallpaper)
- [What is not available on Linux](#what-is-not-available-on-linux)
- [Troubleshooting](#troubleshooting)

---

## Requirements

- Vicinae 0.27 or newer (`vicinae version`)
- Node.js 18 or newer to build
- A notification daemon, for Weather Watch notifications — anything implementing
  the freedesktop notification spec (mako, dunst, swaync, GNOME, KDE)

---

## Install

```bash
git clone https://github.com/nedimperva/ray-weather
cd ray-weather
npm install
npm run build:vicinae
```

`npm run build:vicinae` compiles every command and installs the bundle into
`~/.local/share/vicinae/extensions/forecast-pilot`. Building **is** installing;
there is no separate install step.

Restart the server so it picks up newly added commands:

```bash
systemctl --user restart vicinae.service
# or, if you do not run it under systemd:
vicinae server --replace
```

Confirm the commands registered:

```bash
vicinae cmd ls | grep forecast-pilot
```

### Why a separate build script

`package.json` is the Raycast manifest — it is what the Raycast store validates,
so it may only contain values Raycast understands. Vicinae needs a slightly
different manifest: Linux as a platform, its own schema URL, and no `menu-bar`
command.

Rather than maintaining two manifests that drift apart,
`scripts/build-vicinae.mjs` runs `vici build` and then rewrites the manifest that
was copied into the output bundle. One source of truth, two correct outputs.

---

## Weather Watch and notifications

**Weather Watch** is a `no-view` command that Vicinae's interval scheduler runs
every 30 minutes, whether or not the launcher window is open. You can confirm it
is scheduled:

```bash
$ vicinae logs | grep IntervalScheduler
[ExtensionIntervalScheduler] Registered "forecast-pilot:weather-watch" | interval: 1800 s
```

Each run notifies about:

- **New or escalated weather alerts.** The notification key includes severity, so
  an alert upgraded from moderate to severe notifies again — but the same
  unchanged alert never notifies twice. Urgency maps from severity: extreme and
  severe are `High`, moderate is `Normal`, everything else is `Low`.
- **Rain starting within 90 minutes**, once per rain window, and only when it is
  not already raining.

Already-notified events are remembered for 7 days, so a restart does not replay
the backlog.

Configure this in the extension's preferences:

| Preference | Values | Default |
| --- | --- | --- |
| Alert Notifications | Severe and extreme only · Every active alert · Off | Severe and extreme only |
| Rain Notifications | On · Off | On |

`Off` mutes the notification only — the status file is still refreshed.

Run it by hand to test:

```bash
vicinae cmd launch @nedim_perva/forecast-pilot:weather-watch
```

Nothing happens until a location is pinned. Run **Search Weather**, pick a place,
and choose *Set as Menu Bar Location*.

---

## Status file

Every Weather Watch run writes current conditions to a stable path:

```
${XDG_STATE_HOME:-$HOME/.local/state}/forecast-pilot/current.json
```

The file is written to a temporary sibling and renamed into place, so a bar
polling it every second never reads a partial write.

```json
{
  "schema": 1,
  "updatedAt": "2026-08-30T13:30:21.787Z",
  "forecastUpdatedAt": "2026-08-30T11:18:49Z",
  "location": {
    "name": "Sarajevo",
    "latitude": 43.8563,
    "longitude": 18.4131,
    "timezone": "Europe/Sarajevo"
  },
  "current": {
    "temperatureC": 27.7,
    "feelsLikeC": 27.63723738757605,
    "symbolCode": "partlycloudy_day",
    "condition": "Partlycloudy",
    "windSpeedMs": 2.8,
    "humidityPct": 43.5,
    "precipitationNext1hMm": 0,
    "precipitationProbabilityNext1hPct": 0,
    "uvIndex": 3.68444793255
  },
  "alerts": [],
  "text": "28°C Partlycloudy",
  "alt": "partlycloudy_day",
  "tooltip": "Sarajevo\n28°C · Partlycloudy\nFeels like 28°C\nWind 2.8 m/s\nPrecipitation 0.0 mm",
  "class": "clear"
}
```

### Fields

| Field | Notes |
| --- | --- |
| `schema` | Bumped on any breaking change. Check it before parsing. |
| `updatedAt` | When this file was written. |
| `forecastUpdatedAt` | When met.no last updated the forecast itself. |
| `current` | `null` if the forecast returned no usable data. Temperatures are always Celsius, wind always m/s, precipitation always mm — raw SI, so consumers can format as they like. |
| `alerts` | Sorted most severe first. Empty when there are none. |
| `rainStartsAtISO` | When rain is next expected within the lookahead window. Omitted entirely when no rain is coming, as are `forecastUpdatedAt` and any unavailable measurement — check for presence, do not assume `null`. |
| `text` | Pre-formatted for a bar, honouring your unit and Status Display preferences. |
| `alt` | The met.no symbol code, e.g. `partlycloudy_day`, for icon lookup. |
| `tooltip` | Multi-line human-readable summary. |
| `class` | One of `alert-extreme`, `alert-severe`, `alert-moderate`, `alert`, `raining`, `rain-soon`, `clear`. |

`text`, `alt`, `tooltip`, and `class` deliberately match Waybar's custom-module
JSON contract, so the file can be piped to Waybar unchanged.

### Waybar

```jsonc
// ~/.config/waybar/config
"custom/weather": {
  "exec": "cat ${XDG_STATE_HOME:-$HOME/.local/state}/forecast-pilot/current.json",
  "return-type": "json",
  "interval": 60,
  "tooltip": true,
  "on-click": "vicinae cmd launch @nedim_perva/forecast-pilot:today-weather-brief"
}
```

```css
/* ~/.config/waybar/style.css */
#custom-weather.alert-extreme,
#custom-weather.alert-severe { color: #f38ba8; }
#custom-weather.alert-moderate { color: #fab387; }
#custom-weather.rain-soon,
#custom-weather.raining { color: #89b4fa; }
```

Waybar polls on its own interval; Weather Watch refreshes the data every 30
minutes. A 60-second poll simply means the bar reflects a new forecast within a
minute of it landing.

### quickshell, eww, and other bars

Any widget that can read a file and parse JSON works. The useful fields are
`text` for the label, `alt` for an icon, `tooltip` for the hover, and `class`
for styling; ignore the rest.

For a shell-driven bar:

```bash
STATE="${XDG_STATE_HOME:-$HOME/.local/state}/forecast-pilot/current.json"

# Label
jq -r '.text' "$STATE"

# Warn if anything severe is active
jq -r '.alerts[] | select(.severity == "severe" or .severity == "extreme") | .event' "$STATE"
```

Prefer watching the file with inotify over polling it — it changes at most twice
an hour:

```bash
while inotifywait -qq -e close_write,moved_to "$(dirname "$STATE")"; do
  jq -r '.text' "$STATE"
done
```

---

## Launching from outside the launcher

Vicinae registers every command as an addressable entrypoint:

```bash
$ vicinae cmd ls | grep forecast-pilot
@nedim_perva/forecast-pilot:comfort-ranking
@nedim_perva/forecast-pilot:commute-forecast
@nedim_perva/forecast-pilot:compare-weather
@nedim_perva/forecast-pilot:manage-favorites
@nedim_perva/forecast-pilot:search-weather
@nedim_perva/forecast-pilot:severe-weather-alerts
@nedim_perva/forecast-pilot:share-forecast
@nedim_perva/forecast-pilot:today-weather-brief
@nedim_perva/forecast-pilot:travel-packing-forecast
@nedim_perva/forecast-pilot:weather-watch
@nedim_perva/forecast-pilot:weekend-planner
```

Three ways to launch one, all of which pre-fill Search Weather:

```bash
# 1. Positional argument -> the command's `location` argument
vicinae cmd launch @nedim_perva/forecast-pilot:search-weather Sarajevo

# 2. --query -> fallbackText, which Search Weather also honours
vicinae cmd launch @nedim_perva/forecast-pilot:search-weather --query Mostar

# 3. Deeplink, note the @ before the owner name
vicinae deeplink 'vicinae://launch/@nedim_perva/forecast-pilot/search-weather?fallbackText=Konjic'
```

Add `?toggle=true` to a deeplink to make it close the window if it is already
open — useful for a keybind you press twice.

Headless commands need no window at all:

```bash
vicinae cmd launch @nedim_perva/forecast-pilot:weather-watch
```

### Hyprland keybinds

```conf
# ~/.config/hypr/bindings.conf
bindd = SUPER, W, Weather brief, exec, vicinae cmd launch @nedim_perva/forecast-pilot:today-weather-brief
bindd = SUPER SHIFT, W, Weather search, exec, vicinae cmd launch @nedim_perva/forecast-pilot:search-weather
bindd = SUPER ALT, W, Refresh weather, exec, vicinae cmd launch @nedim_perva/forecast-pilot:weather-watch
```

If you are on Omarchy, put these in `~/.config/hypr/bindings.conf` rather than
editing the shipped defaults, so an update does not overwrite them.

### Forcing a refresh on a schedule of your own

Weather Watch already runs on its own 30-minute interval, so a timer is only
needed if you want a different cadence:

```ini
# ~/.config/systemd/user/forecast-pilot.timer
[Unit]
Description=Refresh Forecast Pilot

[Timer]
OnBootSec=2min
OnUnitActiveSec=15min

[Install]
WantedBy=timers.target
```

```ini
# ~/.config/systemd/user/forecast-pilot.service
[Unit]
Description=Refresh Forecast Pilot

[Service]
Type=oneshot
ExecStart=/usr/local/bin/vicinae cmd launch @nedim_perva/forecast-pilot:weather-watch
```

```bash
systemctl --user enable --now forecast-pilot.timer
```

---

## Wallpaper

**Share Forecast** and **Weekend Planner** offer *Set Weekend Plan as Wallpaper*
on Linux. It renders the weekend card and hands it to whichever wallpaper backend
matches your desktop or running wallpaper daemon.

The action only appears when Vicinae reports that a wallpaper backend is
available, so it is never a dead click. If it is missing on your desktop, Vicinae
has no backend for your compositor or daemon — the *Copy Weekend Plan Image*
action still works, and you can set the file yourself.

---

## What is not available on Linux

**Menu Bar Weather.** `menu-bar` commands need a menu bar, and Vicinae has none.
The Vicinae build omits the command entirely rather than shipping one that
silently fails. Weather Watch plus a bar widget reading the status file covers
the same ground, and arguably better: notifications reach you even when nothing
is on screen.

**Reveal in file manager** behaves slightly differently. Raycast exposes
`showInFinder`, Vicinae `showInFileBrowser`; `src/utils/revealFile.ts` resolves
whichever the host provides and falls back to opening the containing folder.

---

## Troubleshooting

**A new command does not appear.** Vicinae reads the manifest when the server
starts. After adding a command, restart it:
`systemctl --user restart vicinae.service`, then check
`vicinae cmd ls | grep forecast-pilot`.

**No notifications.** Check, in order:

1. A location is pinned — Weather Watch does nothing without one.
2. Alert Notifications is not set to `Off` in the extension preferences.
3. There is actually something to notify about. With the default *severe and
   extreme only*, quiet weather correctly produces silence.
4. A notification daemon is running: `notify-send test` should show something.
5. The scheduler registered the command:
   `vicinae logs | grep IntervalScheduler`.

**No status file.** It is only written after a successful Weather Watch run with
a pinned location. Run `vicinae cmd launch @nedim_perva/forecast-pilot:weather-watch`
and check `vicinae logs` for the run.

**`Worker ... exited with code 1` in the logs.** This is how Vicinae tears down a
`no-view` worker after it finishes; it does not indicate an error. Look for a
missing status file or missing notification instead.

**Stale data in the bar.** `updatedAt` tells you when the file was written and
`forecastUpdatedAt` when met.no last published. If `updatedAt` is old, Weather
Watch is not running — check the scheduler line in the logs.
