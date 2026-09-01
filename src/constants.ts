export const GEOCODE_API = "https://geocoding-api.open-meteo.com/v1/search";
// The "complete" endpoint carries probability of precipitation, dew point, cloud
// cover, and a clear-sky UV index, so we no longer need a separate UV request.
export const MET_NO_FORECAST_API =
  "https://api.met.no/weatherapi/locationforecast/2.0/complete";
export const MET_NO_SUNRISE_API =
  "https://api.met.no/weatherapi/sunrise/3.0/sun";
export const MET_NO_ALERTS_API =
  "https://api.met.no/weatherapi/metalerts/2.0/current.json";
export const AIR_QUALITY_API =
  "https://air-quality-api.open-meteo.com/v1/air-quality";

export const MAX_FORECAST_DAYS = 10;
export const MAX_AIR_QUALITY_DAYS = 7;
export const FAVORITE_LOCATIONS_KEY = "favorite-locations";
export const SEARCH_HISTORY_KEY = "search-history";
export const MENU_BAR_LOCATION_KEY = "menu-bar-default-location";
// Events the background watcher has already notified about, so a repeated run
// stays quiet about the same alert or rain window.
export const WATCH_SEEN_KEY = "weather-watch-seen";
export const MAX_HISTORY_ITEMS = 10;
export const MAX_FAVORITES = 20;

// Cached fetch eviction: keep the store from growing without bound as the user
// searches many locations over time.
export const CACHE_KEY_PREFIX = "cached-fetch:";
export const MAX_CACHE_ENTRIES = 60;
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const CACHE_STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export const APP_USER_AGENT =
  "forecast-pilot-raycast-extension/1.2 (https://github.com/nedimperva/ray-weather)";
