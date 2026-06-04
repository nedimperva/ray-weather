# YR.NO Weather v2.0 Plan

## Product Thesis

Version 2.0 should make the extension feel less like a weather table and more like a fast weather assistant. The user should know what is happening now, what matters later today, and what action to take within a few seconds.

## Release Pillars

1. **Instant context**: surface current conditions, rain risk, feels-like temperature, AQI, UV, and alerts before the daily forecast.
2. **Decision-first forecasting**: convert raw metrics into tags like "Bring umbrella", "Windy", "High UV", and "Great outside".
3. **Raycast-native speed**: make key actions available from search results, favorites, menu bar, and compact commands.
4. **Trust and polish**: show freshness, source attribution, accurate labels, and clean symbols.
5. **Power workflows**: compare locations, plan weekends, check commutes, and answer quick "Should I..." questions.

## Implementation Log

- Completed v2 foundation:
  - Now section
  - Daily decision tags
  - Comfort score
  - Rain windows
  - Min/max temperature timing
  - Hourly grouping
  - Menu bar display modes
  - Search-result menu-bar pinning
  - First favorite management actions
  - Encoding polish
- Completed v2 continuation:
  - Shared default-location lookup for pinned location or first favorite
  - Today's Weather Brief command
  - Forecast, alert, AQI, UV, and geocoding source actions
- Completed compare workflow:
  - Compare Weather command
  - Favorite-to-favorite selection flow
  - Better-location recommendation with comfort score, rain, wind, AQI, UV, and alert context
- Completed weekend workflow:
  - Weekend Planner command
  - Upcoming Saturday/Sunday extraction
  - Better weekend day recommendation with comfort score, rain, wind, UV, and alert context
- Completed alert workflow:
  - Severe Weather Alerts command
  - Default-location alert view
  - Favorite-location alert scan with severity context
- Completed commute and decision workflow:
  - Commute Forecast command
  - Configurable morning/evening commute windows
  - "Should I..." actions for umbrella, jacket, walking, and driving

## v2.0 Milestones

### 1. Highest Value Foundation

- Add a top "Now" section to the forecast view.
  - Current temperature
  - Feels-like temperature
  - Current condition
  - Rain next hour
  - Wind
  - Humidity
  - AQI
  - UV
  - Active alert count/severity
  - Data freshness
- Turn daily forecast rows into a decision surface.
  - Add decision tags such as "Bring umbrella", "Windy", "Great outside", "High UV", "Cold morning", "Rain after 15:00".
  - Keep raw weather metrics visible, but make the useful interpretation easy to scan.
- Add better menu bar title modes.
  - Temp only
  - Temp + condition
  - Temp + rain
  - Feels like
  - Location + temp
  - Compact icon only
- Add "Set as Menu Bar Location" from search results and favorites.
- Add favorite management.
  - Move Up
  - Move Down
  - Set as Menu Bar Location
  - Remove All Favorites
  - Future: custom display names and favorite groups
- Fix text encoding polish.
  - Degree symbols
  - Microgram units
  - Pressure trend arrows
  - README/package preference labels

### 2. Forecast UX

- Split hourly forecast into Morning, Afternoon, Evening, and Night.
- Add rain-window summaries.
  - Example: "Rain likely 14:00-18:00, peak 16:00".
- Add min/max time labels.
  - Example: "Low 5°C at 06:00", "High 14°C at 15:00".
- Add daily trend summaries.
  - Example: "Warmer than today", "Rainier than tomorrow", "Wind easing by evening".
- Add weather personality summaries.
  - Examples: "Calm and cold", "Wet afternoon", "Bright but windy".
- Add comfort score.
  - 0-100 score based on temperature, rain, wind, UV, AQI, and alerts.

### 3. Power Commands

- Compare Weather
  - Select two favorite locations.
  - Compare temperature, precipitation, wind, AQI, alerts, and comfort score.
  - Suggest the better option for outdoor plans.
- Weekend Planner
  - Show Saturday/Sunday summary for the selected location.
  - Include rain windows, comfort score, UV, wind, and alerts.
- Commute Forecast
  - Add preferences for morning and evening commute windows.
  - Summarize commute temperature, rain, wind, and alert risk.
- Today's Weather Brief
  - Dedicated command for the default or pinned location.
  - Compact current conditions, day summary, rain window, AQI, UV, alerts, and source freshness.
- Severe Weather Alerts
  - Dedicated command showing active alerts for pinned/favorite locations.
- "Should I..." actions
  - Should I bring an umbrella?
  - Should I wear a jacket?
  - Is it a good time for a walk?
  - Is it safe to drive?

### 4. Data Improvements

- Improve visibility handling.
  - Avoid labeling fog area fraction as true visibility distance.
  - Either rename to "Fog coverage" or use a more accurate visibility source.
- Add wind direction and gusts where available.
- Use best available precipitation windows.
  - Prefer next_1_hours.
  - Fall back to next_6_hours or next_12_hours for later forecast entries.
- Add data freshness.
  - Forecast updated time
  - AQI updated time
  - UV updated time
- Show API/source per surface.
  - Forecast and alerts: met.no
  - Geocoding, AQI, and UV: Open-Meteo
- Add resilient cache/fallback states.
  - Show last successful forecast when a refresh fails.
  - Make retry actions obvious.

### 5. Fun Big Ideas

- Location nicknames.
  - Examples: Home, Work, Cabin, Berlin trip.
- Favorite groups.
  - Home, Travel, Family, Work.
- Travel packing forecast.
  - For a date range, suggest umbrella, jacket, sunglasses, layers, sunscreen, mask, and windproof clothing.
- Multi-day comfort ranking.
  - Rank forecast days from best to worst for outdoor plans.
- Shareable forecast cards.
  - Generate a clean text/markdown summary for messages.

## Suggested Implementation Order

1. Now section, decision tags, rain windows, min/max timing, hourly grouping.
2. Menu bar modes and search-result pinning.
3. Favorite management and encoding cleanup.
4. Data freshness/source attribution.
5. Compare Weather and Today's Weather Brief.
6. Weekend Planner and Commute Forecast.
7. Nicknames, groups, packing forecast, and comfort ranking.

## Success Criteria

- A user can open a forecast and understand the current situation in under 2 seconds.
- A user can decide whether to bring an umbrella, wear a jacket, avoid wind, or watch UV without interpreting raw numbers.
- The menu bar can be customized for compact or information-rich use.
- Favorite and pinned-location workflows are one action away.
- Display text looks polished and all units render correctly.
- Advanced features build on existing data surfaces rather than adding unnecessary API complexity.
