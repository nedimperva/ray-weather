# Forecast Pilot

Decision-first weather planning for [Raycast](https://raycast.com) on macOS and
Windows, and for [Vicinae](https://vicinae.com) on Linux.

Most weather tools show you numbers. Forecast Pilot answers questions:

- What is happening right now?
- Which day this week is best for being outside?
- Do I need an umbrella or a jacket?
- Which of my two locations has better weather?
- Will my commute be affected?
- Is there anything I should be warned about?

Data comes from [met.no](https://api.met.no) and
[Open-Meteo](https://open-meteo.com). No account, no API key.

---

## Contents

- [Install](#install)
- [First run](#first-run)
- [Commands](#commands)
- [Platform support](#platform-support)
- [Preferences](#preferences)
- [Common workflows](#common-workflows)
- [Linux integration](#linux-integration)
- [Data sources](#data-sources)
- [Privacy](#privacy)
- [Troubleshooting](#troubleshooting)
- [Development](#development)

---

## Install

### macOS and Windows — Raycast

Install from the Raycast store, or build from source:

```bash
npm install
npm run build      # compiles and installs into Raycast
```

`npm run dev` starts Raycast's development mode with hot reload.

### Linux — Vicinae

Requires [Vicinae](https://docs.vicinae.com/install/linux) 0.27 or newer.

```bash
npm install
npm run build:vicinae
systemctl --user restart vicinae.service   # or: vicinae server --replace
```

`npm run build:vicinae` compiles straight into
`~/.local/share/vicinae/extensions/forecast-pilot`, so building is installing.
Vicinae picks up newly added commands after a server restart; edits to existing
commands are picked up on the next launch.

The Linux build is not just the Raycast build running elsewhere — it adds
desktop notifications, a status file for bar widgets, CLI and deeplink launching,
and a wallpaper action. See [Linux integration](#linux-integration).

---

## First run

Every single-location command needs a default location. Set one once:

1. Run **Search Weather**.
2. Type a place name and pick it from the results.
3. Open the action panel and choose **Set as Menu Bar Location**.

That pinned location is used by Today's Weather Brief, Weekend Planner, Commute
Forecast, Comfort Ranking, Travel Packing Forecast, Share Forecast, Severe
Weather Alerts, Weather Watch, and Menu Bar Weather. If nothing is pinned, the
first favorite is used instead.

To compare locations, add at least two favorites with **Add to Favorites**.

---

## Commands

| Command | What it answers |
| --- | --- |
| **Search Weather** | Find a place and open its full forecast. Accepts a place name as an argument. |
| **Today's Weather Brief** | A compact briefing for the default location. |
| **Compare Weather** | Which of two favorites has better weather, and why. |
| **Weekend Planner** | Which of Saturday and Sunday to choose. |
| **Commute Forecast** | Whether the morning and evening commute windows are affected. |
| **Comfort Ranking** | Which upcoming day is best for being outside. |
| **Travel Packing Forecast** | What to pack for the days ahead. |
| **Share Forecast** | Markdown, compact text, and image summaries to send to someone. |
| **Severe Weather Alerts** | Active alerts for the default location and every favorite. |
| **Manage Favorites** | Nicknames, groups, ordering, and the pinned location. |
| **Weather Watch** | Background refresh: alert and rain notifications, plus the status file. |
| **Menu Bar Weather** | Current conditions in the macOS menu bar. |

### Search Weather

Search by place name, then open a decision-first forecast. Favorites and recent
searches appear when the search field is empty.

The forecast view shows current conditions, daily rows, comfort scores, decision
tags, rain windows, air quality, UV, active alerts, and data freshness, and it
can drill into a per-day detail view and an air quality view.

Search Weather takes an optional `location` argument, so it can be launched
pre-filled from a keybind, a deeplink, or the command line.

### Today's Weather Brief

Current condition, feels-like temperature, comfort score, rain now and next
hour, AQI, UV, alerts, sunrise and sunset, and forecast freshness — as one
copyable briefing.

### Compare Weather

Compares two favorites on comfort score, temperature, rain, wind, AQI, UV, and
alerts, then recommends one. Useful for travel, errands, and weekend decisions.

### Weekend Planner

Finds the upcoming Saturday and Sunday for the default location and recommends
the better day, with comfort score, rain window, temperature range, wind, UV,
and alerts. Exports a shareable image of the plan.

### Commute Forecast

Summarises morning and evening commute conditions: risk level, feels-like
temperature, rain amount, wind, UV, and alert context. The commute windows are
configurable in preferences.

### Comfort Ranking

Ranks the upcoming forecast days from best to worst for outdoor comfort. The
score weighs temperature comfort, precipitation, wind, UV, AQI, fog coverage,
and active alerts.

### Travel Packing Forecast

Turns the upcoming forecast into a packing list: umbrella, waterproof layer,
warm jacket, light layers, sunscreen, sunglasses, windproof layer, air quality
backup plan, alert plan, and extra travel time.

### Share Forecast

Produces a Markdown table, a compact one-line summary, and a rendered PNG of the
weekend plan. On Linux the PNG can also be set as the desktop wallpaper.

### Severe Weather Alerts

Active alerts for the default location and every favorite, sorted and coloured
by severity, with copyable alert text.

### Manage Favorites

Add nicknames (`Home`, `Work`, `Cabin`) and groups (`Home`, `Travel`,
`Weekend`), reorder favorites, promote one to first, change the pinned location,
and remove entries.

### Weather Watch

Runs every 30 minutes in the background. Each run:

1. Refreshes the forecast and alerts for the default location.
2. Notifies once about each new or escalated weather alert.
3. Notifies once when rain is expected to start within 90 minutes.
4. Writes the [status file](docs/linux.md#status-file) for bar widgets.
5. Updates its own subtitle in the launcher's root search.

On Linux these are real desktop notifications, delivered whether or not the
launcher is open. Raycast has no notification API, so there the command updates
its subtitle instead and shows a toast when you run it by hand.

Notification behaviour is controlled by the **Alert Notifications** and **Rain
Notifications** preferences. Setting alerts to `Off` still refreshes the status
file — it only mutes the notification.

### Menu Bar Weather

Current conditions in the menu bar, with a dropdown for feels-like, wind,
humidity, precipitation, UV, alerts, sunrise and sunset, and the next few hours.
The icon turns into a red warning while an alert is active.

This command needs a menu bar to render into. Where there is none, Weather Watch
covers the same job through notifications and the status file.

---

## Platform support

| | macOS / Windows (Raycast) | Linux (Vicinae) |
| --- | :---: | :---: |
| All forecast, comparison, and planning commands | ✅ | ✅ |
| Favorites, groups, pinned location, caching | ✅ | ✅ |
| Weekend plan image, copy to clipboard | ✅ | ✅ |
| Background refresh on an interval | ✅ | ✅ |
| Desktop notifications for alerts and rain | ❌ | ✅ |
| Status file for bar widgets | ❌<sup>1</sup> | ✅ |
| Launch from the CLI, a deeplink, or a keybind | partial<sup>2</sup> | ✅ |
| Set the weekend plan as wallpaper | ❌ | ✅ |
| Menu bar item | ✅ macOS | ❌<sup>3</sup> |

<sup>1</sup> The file is still written, into the extension support directory,
but nothing consumes it there.
<sup>2</sup> Raycast supports deeplinks but has no command-line launcher.
<sup>3</sup> Vicinae has no menu bar; the Vicinae build omits the command
entirely rather than shipping one that cannot render.

---

## Preferences

| Preference | Default | Description |
| --- | --- | --- |
| Temperature Unit | Celsius | Celsius or Fahrenheit |
| Wind Speed Unit | m/s | m/s, km/h, mph, or knots |
| Precipitation Unit | mm | Millimeters or inches |
| Forecast Days | 10 | How many forecast days to display |
| Status Display | Temp + condition | What the menu bar title and status file text show |
| Alert Notifications | Severe and extreme only | Which alerts Weather Watch notifies about, or `Off` |
| Rain Notifications | On | Warn once when rain is expected within 90 minutes |
| Morning Commute Start | 7:00 | Start of the morning commute window |
| Morning Commute End | 9:00 | End of the morning commute window |
| Evening Commute Start | 16:00 | Start of the evening commute window |
| Evening Commute End | 18:00 | End of the evening commute window |

---

## Common workflows

**Decide what to do today.** Run Today's Weather Brief, or open a forecast and
use the `Should I…` actions: umbrella, jacket, good time for a walk, safe to
drive.

**Pick the best day.** Comfort Ranking for the week ahead; Weekend Planner when
only Saturday and Sunday matter.

**Compare two places.** Add two favorites, run Compare Weather, pick both, read
the recommendation and the metrics behind it.

**Share a forecast.** Run Share Forecast and copy the Markdown table, the
compact summary, or the weekend image.

**Get warned without looking.** Pin a location and let Weather Watch run. On
Linux you get desktop notifications; everywhere you get an up-to-date subtitle
in the launcher's root search.

---

## Linux integration

On Vicinae the extension is scriptable and connected to the desktop:

```bash
# Launch a command from a terminal, a script, or a Hyprland keybind
vicinae cmd launch @nedim_perva/forecast-pilot:today-weather-brief

# Open Search Weather pre-filled
vicinae cmd launch @nedim_perva/forecast-pilot:search-weather Sarajevo

# Same thing as a deeplink
vicinae deeplink 'vicinae://launch/@nedim_perva/forecast-pilot/search-weather?fallbackText=Sarajevo'

# Read the current conditions from any script or bar widget
cat "${XDG_STATE_HOME:-$HOME/.local/state}/forecast-pilot/current.json"
```

**[Read the full Linux guide →](docs/linux.md)** — status file schema, Waybar
and quickshell examples, Hyprland keybinds, notification setup, and Linux-only
troubleshooting.

---

## Data sources

| Data | Source |
| --- | --- |
| Forecast, rain probability, clear-sky UV | met.no Locationforecast `complete` |
| Weather alerts | met.no MetAlerts |
| Sunrise and sunset | met.no Sunrise |
| Place search | Open-Meteo Geocoding |
| Air quality | Open-Meteo Air Quality |

UV is derived from the forecast's clear-sky UV index, attenuated by forecast
cloud cover, so no separate UV request is needed.

### Data freshness and caching

Views show freshness timestamps where available. The shared fetch hook keeps the
last successful response in local storage; if a refresh fails, cached data is
shown and labelled as cached, then `(stale)` once it passes its freshness
window. Cached entries are pruned by age and count so storage does not grow
without bound.

This keeps the extension useful during temporary API failures, offline moments,
slow networks, and interrupted refreshes.

### met.no User-Agent

met.no requires a `User-Agent` identifying the application and a contact point.
Update it before distributing a fork:

```ts
// src/constants.ts
export const APP_USER_AGENT =
  "forecast-pilot-raycast-extension/1.2 (https://github.com/nedimperva/ray-weather)";
```

---

## Privacy

Stored locally, in the launcher's local storage:

- Favorite locations, nicknames, and groups
- Search history
- The pinned location
- Cached API responses
- Which alerts have already been notified about

Written to disk on Linux: the status file, containing current conditions and
active alerts for the default location.

Sent over the network: your search text to Open-Meteo Geocoding, and coordinates
to met.no and Open-Meteo. No API keys, no accounts, no analytics.

---

## Troubleshooting

**No default location.** Pin one from Search Weather, or add a favorite.

**Compare Weather has no locations.** It needs at least two favorites.

**Data looks old.** Use the refresh action. If the API is failing, cached
fallback data is shown and labelled as cached.

**Air quality or UV is missing.** Open-Meteo does not return complete air
quality data for every location, and UV only appears during daylight. Forecast
data works independently.

**No menu bar weather.** Pin a location or add a favorite. On Linux there is no
menu bar — use Weather Watch instead.

For Linux-specific problems (no notifications, missing status file, a command
that does not appear), see
[docs/linux.md](docs/linux.md#troubleshooting).

---

## Development

See **[docs/development.md](docs/development.md)** for the project layout, the
two-manifest build strategy, testing, and the rules for adding a command that
works on both hosts.

Quick reference:

```bash
npm install
npm test              # Vitest, pure forecast/comfort/alert/watch logic
npm run lint          # Raycast lint: manifest, icons, metadata, ESLint, Prettier
npm run dev           # Raycast development mode
npm run build         # Raycast build
npm run build:vicinae # Vicinae build and install
```

---

## License

MIT
