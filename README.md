# Forecast Pilot for Raycast

A Raycast extension for macOS and Windows that turns met.no and Open-Meteo weather data into fast, decision-first workflows.

Instead of only showing raw forecast numbers, the extension answers practical questions:

- What is happening now?
- Which day is best for being outside?
- Should I bring an umbrella or wear a jacket?
- Which favorite location has better weather?
- What should I pack for a short trip?
- Is my commute likely to be affected?
- Are there active weather alerts?

## Highlights

- Search weather by place name.
- Save favorite locations and recent searches.
- Pin one location for menu bar and default-command workflows.
- View current conditions, forecast freshness, AQI, UV, alerts, rain windows, rain probability, comfort scores, and decision tags.
- Switch the viewed location from a dropdown without re-pinning (single-location commands).
- Compare two favorite locations.
- Rank upcoming days by outdoor comfort.
- Plan weekends, commutes, and travel packing.
- Copy compact or Markdown forecast summaries.
- Use cached forecast data when a refresh fails.

## Commands

### Search Weather

Search for a place, open its forecast, and manage common actions.

Includes:

- Favorite locations
- Recent searches
- Location search results
- Pin to menu bar
- Copy coordinates
- Add/remove favorites
- Open full forecast

Forecast view includes:

- Now section
- Daily forecast rows
- Comfort score
- Decision tags
- Rain window summaries
- AQI and UV tags
- Weather alerts
- Data freshness for forecast and AQI
- Air quality view
- Day details view

### Today's Weather Brief

Shows a compact briefing for the pinned location, or the first favorite if no pinned location exists.

Includes:

- Current condition
- Feels-like temperature
- Comfort score
- Rain now/next hour
- AQI and UV
- Weather alerts
- Sunrise and sunset
- Rain window
- Forecast and AQI freshness
- Copyable weather brief

### Compare Weather

Compares two favorite locations and recommends the better one.

Comparison factors:

- Comfort score
- Temperature
- Rain
- Wind
- AQI
- UV
- Alerts

Use this when choosing between two places for travel, outdoor plans, errands, or weekend decisions.

### Weekend Planner

Finds the upcoming Saturday and Sunday for the default location and recommends the better day.

Includes:

- Better weekend day recommendation
- Comfort score
- Rain window
- Temperature range
- Wind
- UV
- Alerts
- Copyable weekend plan

### Commute Forecast

Summarizes morning and evening commute conditions for the default location.

Includes:

- Morning commute risk
- Evening commute risk
- Feels-like temperature
- Rain amount
- Wind
- UV
- Alert context
- Copyable commute forecast

Commute windows are configurable in extension preferences.

### Comfort Ranking

Ranks upcoming forecast days from best to worst for outdoor comfort.

Comfort score considers:

- Temperature comfort
- Precipitation
- Wind
- UV
- AQI
- Fog coverage
- Weather alerts

Use this to pick the best day for walking, hiking, errands, or outdoor plans.

### Severe Weather Alerts

Shows active weather alerts for the default location and favorite locations.

Includes:

- Severity sorting
- Severity colors
- Favorite-location alert scan
- Copy alert text
- Copy all alerts for a location

### Travel Packing Forecast

Builds a packing list from the upcoming forecast.

Possible suggestions include:

- Umbrella
- Waterproof layer
- Warm jacket
- Light layers
- Light clothing
- Sunscreen
- Sunglasses
- Windproof layer
- Air quality backup plan
- Weather alert plan
- Extra travel time

### Share Forecast

Creates shareable forecast summaries.

Formats:

- Markdown table
- Compact text summary

Useful for messages, trip planning, team updates, and personal notes.

### Manage Favorites

Organize favorite locations.

Actions:

- Add favorites from Search Weather
- Edit nickname
- Edit group
- Reorder favorites
- Make first favorite
- Set as menu bar location
- Remove favorite
- Remove all favorites

Nickname examples:

- Home
- Work
- Cabin
- Berlin Trip

Group examples:

- Home
- Work
- Travel
- Family
- Weekend

### Menu Bar Weather

Shows weather for the pinned location in the Raycast menu bar.

If no location is pinned, the first favorite is used.

Display modes:

- Temp only
- Temp + condition
- Temp + rain
- Feels like
- Location + temp
- Compact icon only

The menu bar icon turns into a red warning when an alert is active for the location, making it the passive/background alerting channel (the command refreshes on its interval).

The menu bar dropdown includes:

- Current condition
- Feels-like temperature
- Wind
- Humidity
- Precipitation
- UV index
- Active weather alerts
- Sunrise and sunset
- Updated time
- Upcoming hours
- Open full forecast
- Preferences

## Common Workflows

### Set up a default location

1. Run `Search Weather`.
2. Search for a place.
3. Open actions.
4. Select `Set as Menu Bar Location`.

This location is used by:

- Today's Weather Brief
- Weekend Planner
- Commute Forecast
- Comfort Ranking
- Travel Packing Forecast
- Share Forecast
- Severe Weather Alerts
- Menu Bar Weather

If no pinned location exists, the first favorite is used.

### Add and organize favorites

1. Run `Search Weather`.
2. Search for a place.
3. Select `Add to Favorites`.
4. Run `Manage Favorites`.
5. Add a nickname or group.

### Decide what to do today

Run `Today's Weather Brief` or open a forecast and use the `Should I...` actions.

Supported decisions:

- Should I bring an umbrella?
- Should I wear a jacket?
- Good time for a walk?
- Safe to drive?

### Pick the best day

Run `Comfort Ranking` to rank the upcoming forecast days.

Run `Weekend Planner` when you only care about Saturday/Sunday.

### Compare two locations

1. Add at least two favorites.
2. Run `Compare Weather`.
3. Pick the first location.
4. Pick the second location.
5. Read the recommendation and supporting metrics.

### Share a forecast

Run `Share Forecast`, then copy either:

- Markdown Forecast
- Compact Forecast

## Preferences

| Preference | Default | Description |
| --- | --- | --- |
| Temperature Unit | Celsius | Celsius or Fahrenheit |
| Wind Speed Unit | m/s | m/s, km/h, mph, or knots |
| Precipitation Unit | mm | Millimeters or inches |
| Forecast Days | 10 | Number of forecast days to display |
| Menu Bar Display | Temp + condition | Controls menu bar title format |
| Morning Commute Start | 7:00 | Start hour for morning commute forecast |
| Morning Commute End | 9:00 | End hour for morning commute forecast |
| Evening Commute Start | 16:00 | Start hour for evening commute forecast |
| Evening Commute End | 18:00 | End hour for evening commute forecast |

## Data Sources

The extension uses public weather APIs:

- Forecast, rain probability, and UV index: met.no Locationforecast `complete` API
- Weather alerts: met.no MetAlerts API
- Sunrise/sunset: met.no Sunrise API
- Place search: Open-Meteo Geocoding API
- Air quality: Open-Meteo Air Quality API

UV is derived from the forecast's clear-sky UV index and attenuated by the forecast cloud cover, so no separate UV request is needed.

The extension includes source documentation links in the Raycast action panel.

## Data Freshness and Caching

Forecast and AQI views show freshness timestamps where available.

The shared fetch hook keeps the previous successful response in local storage. If a refresh fails and cached data exists, the extension can still show useful data and marks it as cached (and `(stale)` once the cache passes its freshness window). Cached entries are pruned by age and count so local storage does not grow without bound.

This improves reliability during:

- Temporary API failures
- Offline moments
- Slow network responses
- Rate-limited or interrupted refreshes

## Privacy

The extension stores the following locally in Raycast LocalStorage:

- Favorite locations
- Favorite nicknames and groups
- Search history
- Pinned menu bar location
- Cached API responses

The extension sends:

- Place search text to Open-Meteo Geocoding
- Coordinates to met.no and Open-Meteo weather APIs

No API keys are used.

## Architecture

```text
src/
  components/
    Shared Raycast views and action groups
  hooks/
    Data fetching, local storage, favorites, default location
  utils/
    Forecast parsing, formatting, colors, icons, decisions, alerts
  search-weather.tsx
  today-weather-brief.tsx
  compare-weather.tsx
  weekend-planner.tsx
  commute-forecast.tsx
  comfort-ranking.tsx
  severe-weather-alerts.tsx
  travel-packing-forecast.tsx
  share-forecast.tsx
  manage-favorites.tsx
  menu-bar-weather.tsx
```

Important utilities:

- `buildDailyForecast`: converts met.no timeseries data into daily summaries, including per-day max UV and rain probability.
- `buildComfortScore`: calculates a 0-100 outdoor comfort score.
- `buildDecisionTags`: creates forecast tags such as `Rain likely`, `Windy`, `High UV`, and `Great outside`.
- `buildShouldIDecisions`: powers umbrella, jacket, walk, and drive answers.
- `buildPackingSuggestions`: powers the travel packing command.
- `useWeatherData`: single hook bundling forecast, alerts, and air quality, with alerts mapped to the days they cover and air quality sampled per day.
- `useLocationSwitcher`: provides the search-bar location dropdown for single-location commands.
- `useCachedFetch`: wraps API calls with user-agent headers, previous data, local cache fallback, staleness, and pruning.
- `useDefaultLocation`: resolves pinned location, then first favorite.

## Development

Install dependencies:

```powershell
npm install
```

Start Raycast extension development:

```powershell
npm run dev
```

Build:

```powershell
npm run build
```

Lint:

```powershell
npm run lint
```

Fix formatting and lint issues:

```powershell
npm run fix-lint
```

Run the unit tests (Vitest) for the pure forecast, comfort, alert, and UV logic:

```powershell
npm test
```

Raycast lint validates the package schema and author online. If your environment blocks network access, package validation may fail even when TypeScript and ESLint pass.

## Store Screenshots

Store screenshots live in `metadata/` as `forecast-pilot-{n}.png`, sized 2000x1250 (the Raycast store spec).

The current images are generated mockups of the List UI built from representative content (multiple favorite locations and active alerts) so the layout is reproducible:

```bash
pip install Pillow
python3 scripts/render_screenshots.py
```

For a final store submission you can replace them with real captures from Raycast's built-in Window Capture (it exports at the same 2000x1250 size).

## met.no User-Agent

met.no requires a custom `User-Agent` with app identity and contact information.

Update this constant before publishing or distributing widely:

```ts
export const APP_USER_AGENT =
  "forecast-pilot-raycast-extension/1.1 (https://github.com/nedimperva/ray-weather)";
```

The constant is defined in:

```text
src/constants.ts
```

## Troubleshooting

### No default location

Pin a location from `Search Weather`, or add at least one favorite.

### Compare Weather has no locations

Add at least two favorite locations.

### Menu bar has no weather

Pin a location or add a favorite. The menu bar command uses the pinned location first, then the first favorite.

### Data looks old

Open the relevant command and use the refresh action. If the API fails, cached fallback data may still be displayed and labeled as cached.

### Air quality or UV is missing

Some locations or time windows may not return complete air quality data from Open-Meteo, and UV is only reported during daylight. Forecast data can still work independently.

## License

MIT
