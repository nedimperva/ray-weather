import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  LocalStorage,
  showToast,
  Toast,
} from "@raycast/api";
import { showFailureToast, useFetch } from "@raycast/utils";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import type {
  TemperatureUnit,
  Location,
  GeocodeApiResponse,
  MetNoForecastResponse,
  MetNoSunResponse,
  DailyForecast,
  HourlyForecast,
  WeatherAlert,
} from "./types";

const GEOCODE_API = "https://geocoding-api.open-meteo.com/v1/search";
const MET_NO_FORECAST_API =
  "https://api.met.no/weatherapi/locationforecast/2.0/compact";
const MET_NO_SUNRISE_API = "https://api.met.no/weatherapi/sunrise/3.0/sun";
const MET_NO_ALERTS_API =
  "https://api.met.no/weatherapi/metalerts/2.0/current.json";
const AIR_QUALITY_API = "https://air-quality-api.open-meteo.com/v1/air-quality";
const MAX_FORECAST_DAYS = 10;
const TEMPERATURE_UNIT_STORAGE_KEY = "temperature-unit";
const FAVORITE_LOCATIONS_KEY = "favorite-locations";
const SEARCH_HISTORY_KEY = "search-history";
const MAX_HISTORY_ITEMS = 10;
const MAX_FAVORITES = 20;

const APP_USER_AGENT =
  "yr-no-raycast-extension/1.0 (https://github.com/your-org/yr.no-ray)";

function normalizeLocationId(
  location: Pick<Location, "name" | "latitude" | "longitude">,
): string {
  return `${location.name.toLowerCase()}-${location.latitude.toFixed(4)}-${location.longitude.toFixed(4)}`;
}

function ensureValidTimeZone(timeZone: string | undefined): string {
  if (!timeZone) {
    return "UTC";
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
  }
}

function formatLocationSubtitle(location: Location): string {
  return [location.region, location.country].filter(Boolean).join(", ");
}

function toFahrenheit(tempC: number): number {
  return (tempC * 9) / 5 + 32;
}

function toCelsius(tempF: number): number {
  return ((tempF - 32) * 5) / 9;
}

function calculateFeelsLikeC(
  tempC: number,
  windSpeedMs?: number,
  humidityPct?: number,
): number {
  const windSpeedKph = (windSpeedMs ?? 0) * 3.6;

  if (tempC <= 10 && windSpeedKph > 4.8) {
    return (
      13.12 +
      0.6215 * tempC -
      11.37 * Math.pow(windSpeedKph, 0.16) +
      0.3965 * tempC * Math.pow(windSpeedKph, 0.16)
    );
  }

  if (tempC >= 27 && typeof humidityPct === "number" && humidityPct >= 40) {
    const tempF = toFahrenheit(tempC);
    const heatIndexF =
      -42.379 +
      2.04901523 * tempF +
      10.14333127 * humidityPct -
      0.22475541 * tempF * humidityPct -
      0.00683783 * tempF * tempF -
      0.05481717 * humidityPct * humidityPct +
      0.00122874 * tempF * tempF * humidityPct +
      0.00085282 * tempF * humidityPct * humidityPct -
      0.00000199 * tempF * tempF * humidityPct * humidityPct;
    return toCelsius(heatIndexF);
  }

  return tempC;
}

function formatTemperature(tempC: number, unit: TemperatureUnit): string {
  if (unit === "fahrenheit") {
    return `${Math.round(toFahrenheit(tempC))}°F`;
  }

  return `${Math.round(tempC)}°C`;
}

function formatTemperatureRange(
  minTempC: number,
  maxTempC: number,
  unit: TemperatureUnit,
): string {
  return `${formatTemperature(maxTempC, unit)} / ${formatTemperature(minTempC, unit)}`;
}

function dayLabelFromIndex(dayIndex: number, weekday: string): string {
  if (dayIndex === 0) {
    return "Today";
  }

  if (dayIndex === 1) {
    return "Tomorrow";
  }

  return weekday;
}

function iconForSymbol(symbolCode: string): Icon {
  if (symbolCode.includes("thunder")) {
    return Icon.Bolt;
  }

  if (symbolCode.includes("snow")) {
    return Icon.Snowflake;
  }

  if (
    symbolCode.includes("rain") ||
    symbolCode.includes("sleet") ||
    symbolCode.includes("shower")
  ) {
    return Icon.CloudRain;
  }

  if (symbolCode.includes("drizzle")) {
    return Icon.CloudRain;
  }

  if (symbolCode.includes("fog") || symbolCode.includes("mist")) {
    return Icon.Cloud;
  }

  if (symbolCode.includes("partlycloudy")) {
    return Icon.CloudSun;
  }

  if (symbolCode.includes("fair")) {
    return Icon.Sun;
  }

  if (symbolCode.includes("clearsky")) {
    return Icon.Sun;
  }

  if (symbolCode.includes("overcast")) {
    return Icon.Cloud;
  }

  return Icon.Cloud;
}

function iconForAqi(aqi: number): Icon {
  if (aqi >= 4) {
    return Icon.Warning;
  }
  if (aqi >= 2) {
    return Icon.ExclamationMark;
  }
  return Icon.CheckCircle;
}

function colorForTemperature(tempC: number): Color {
  if (tempC <= 0) return Color.Blue;
  if (tempC <= 10) return Color.Magenta;
  if (tempC <= 20) return Color.Green;
  if (tempC <= 28) return Color.Orange;
  return Color.Red;
}

function colorForPrecipitation(mm: number): Color {
  if (mm === 0) return Color.SecondaryText;
  if (mm < 1) return Color.Blue;
  if (mm < 5) return Color.Orange;
  return Color.Red;
}

function colorForWind(speedMs?: number): Color {
  if (speedMs === undefined) return Color.SecondaryText;
  if (speedMs < 5) return Color.Green;
  if (speedMs < 10) return Color.Orange;
  return Color.Red;
}

function aqiLabel(aqi: number): string {
  if (aqi >= 4) {
    return "Unhealthy";
  }
  if (aqi >= 3) {
    return "Unhealthy for Sensitive";
  }
  if (aqi >= 2) {
    return "Moderate";
  }
  return "Good";
}

function conditionLabelForSymbol(symbolCode: string): string {
  const value = symbolCode
    .replace(/_/g, " ")
    .replace(/\b(day|night)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return value.length > 0
    ? value.replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Cloudy";
}

function dateKeyInTimezone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function localHourInTimezone(date: Date, timeZone: string): number {
  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  });
  return Number.parseInt(hourFormatter.format(date), 10);
}

function formatIsoTimeInTimezone(
  isoTime: string | undefined,
  timeZone: string,
): string {
  if (!isoTime) {
    return "No data";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: ensureValidTimeZone(timeZone),
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoTime));
}

function dateFromDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  if (!year || !month || !day) {
    return new Date();
  }

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function normalizeTemperatureUnit(
  value: string | null | undefined,
): TemperatureUnit {
  return value === "fahrenheit" ? "fahrenheit" : "celsius";
}

function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    void (async () => {
      const saved = await LocalStorage.getItem<string>(key);
      if (saved) {
        try {
          setValue(JSON.parse(saved));
        } catch {
          // keep default value
        }
      }
    })();
  }, [key]);

  const updateValue = useCallback(
    (newValue: T) => {
      setValue(newValue);
      void LocalStorage.setItem(key, JSON.stringify(newValue));
    },
    [key],
  );

  return [value, updateValue] as const;
}

function useTemperatureUnit() {
  const [temperatureUnit, setTemperatureUnitState] =
    useState<TemperatureUnit>("celsius");
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    void (async () => {
      const savedUnit = await LocalStorage.getItem<string>(
        TEMPERATURE_UNIT_STORAGE_KEY,
      );
      setTemperatureUnitState(normalizeTemperatureUnit(savedUnit));
    })();
  }, []);

  const setTemperatureUnit = useCallback((unit: TemperatureUnit) => {
    setTemperatureUnitState(unit);
    void LocalStorage.setItem(TEMPERATURE_UNIT_STORAGE_KEY, unit);
    void showToast({
      style: Toast.Style.Success,
      title: `Temperature Unit: ${unit === "celsius" ? "Celsius" : "Fahrenheit"}`,
    });
  }, []);

  return { temperatureUnit, setTemperatureUnit };
}

function useFavoriteLocations() {
  const [favorites, setFavorites] = useLocalStorage<Location[]>(
    FAVORITE_LOCATIONS_KEY,
    [],
  );

  const addFavorite = useCallback(
    (location: Location) => {
      if (!favorites.find((f) => f.id === location.id)) {
        const newFavorites = [...favorites, location].slice(0, MAX_FAVORITES);
        setFavorites(newFavorites);
        void showToast({
          style: Toast.Style.Success,
          title: `Added ${location.name} to favorites`,
        });
      }
    },
    [favorites, setFavorites],
  );

  const removeFavorite = useCallback(
    (locationId: string) => {
      setFavorites(favorites.filter((f) => f.id !== locationId));
      void showToast({
        style: Toast.Style.Success,
        title: "Removed from favorites",
      });
    },
    [favorites, setFavorites],
  );

  const isFavorite = useCallback(
    (locationId: string) => {
      return favorites.some((f) => f.id === locationId);
    },
    [favorites],
  );

  return { favorites, addFavorite, removeFavorite, isFavorite };
}

function useSearchHistory() {
  const [history, setHistory] = useLocalStorage<Location[]>(
    SEARCH_HISTORY_KEY,
    [],
  );

  const addToHistory = useCallback(
    (location: Location) => {
      const filtered = history.filter((h) => h.id !== location.id);
      const newHistory = [location, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      setHistory(newHistory);
    },
    [history, setHistory],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    void showToast({
      style: Toast.Style.Success,
      title: "Search history cleared",
    });
  }, [setHistory]);

  return { history, addToHistory, clearHistory };
}

function TemperatureUnitActions(props: {
  temperatureUnit: TemperatureUnit;
  setTemperatureUnit: (unit: TemperatureUnit) => void;
}) {
  const { temperatureUnit, setTemperatureUnit } = props;

  return (
    <>
      <Action
        title={
          temperatureUnit === "celsius"
            ? "Use Celsius (Current)"
            : "Use Celsius"
        }
        icon={Icon.Temperature}
        onAction={() => setTemperatureUnit("celsius")}
      />
      <Action
        title={
          temperatureUnit === "fahrenheit"
            ? "Use Fahrenheit (Current)"
            : "Use Fahrenheit"
        }
        icon={Icon.Temperature}
        onAction={() => setTemperatureUnit("fahrenheit")}
      />
    </>
  );
}

function buildTemperatureUnitActions(
  temperatureUnit: TemperatureUnit,
  setTemperatureUnit: (unit: TemperatureUnit) => void,
) {
  return (
    <ActionPanel.Section title="Temperature Unit">
      <TemperatureUnitActions
        temperatureUnit={temperatureUnit}
        setTemperatureUnit={setTemperatureUnit}
      />
    </ActionPanel.Section>
  );
}

function buildInfoActions() {
  return (
    <ActionPanel.Section title="About">
      <Action.OpenInBrowser
        title="Yr.no API Docs"
        url="https://api.met.no/weatherapi/locationforecast/2.0/documentation"
      />
      <Action.OpenInBrowser
        title="Open-Meteo Geocoding Docs"
        url="https://open-meteo.com/en/docs/geocoding-api"
      />
    </ActionPanel.Section>
  );
}

function buildCommonActions(
  temperatureUnit: TemperatureUnit,
  setTemperatureUnit: (unit: TemperatureUnit) => void,
) {
  return (
    <>
      {buildTemperatureUnitActions(temperatureUnit, setTemperatureUnit)}
      {buildInfoActions()}
    </>
  );
}

function buildDailyForecast(
  timeseries: Array<{ time: string; data: unknown }>,
  timezone: string,
): DailyForecast[] {
  const safeTimeZone = ensureValidTimeZone(timezone);
  const groupedByDay = new Map<
    string,
    {
      minTempC: number;
      maxTempC: number;
      minFeelsLikeC: number;
      maxFeelsLikeC: number;
      precipitationMm: number;
      symbolCandidates: Array<{
        symbol: string;
        hour: number;
        uvIndex?: number;
      }>;
      windSpeedTotal: number;
      windSpeedCount: number;
      humidityTotal: number;
      humidityCount: number;
      pressureTotal: number;
      pressureCount: number;
      visibilityTotal: number;
      visibilityCount: number;
      uvIndexTotal: number;
      uvIndexCount: number;
      hourly: HourlyForecast[];
      pressures: number[];
    }
  >();
  const timeLabelFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone,
    hour: "numeric",
    minute: "2-digit",
  });

  for (const entry of timeseries) {
    const data = entry.data as {
      instant?: {
        details?: Record<string, unknown>;
      };
      next_1_hours?: {
        summary?: { symbol_code?: string };
        details?: { precipitation_amount?: number };
      };
    };
    const date = new Date(entry.time);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const tempC = data?.instant?.details?.air_temperature as number | undefined;
    if (typeof tempC !== "number") {
      continue;
    }

    const dayKey = dateKeyInTimezone(date, safeTimeZone);
    const hour = localHourInTimezone(date, safeTimeZone);
    const precipitation =
      (data.next_1_hours?.details?.precipitation_amount as number) ?? 0;
    const symbol =
      (data.next_1_hours?.summary?.symbol_code as string) ?? "cloudy";
    const windSpeed = data.instant?.details?.wind_speed as number | undefined;
    const humidity = data.instant?.details?.relative_humidity as
      | number
      | undefined;
    const pressure = data.instant?.details?.air_pressure_at_sea_level as
      | number
      | undefined;
    const visibility = data.instant?.details?.fog_area_fraction as
      | number
      | undefined;
    const feelsLikeC = calculateFeelsLikeC(tempC, windSpeed, humidity);

    if (!groupedByDay.has(dayKey)) {
      groupedByDay.set(dayKey, {
        minTempC: tempC,
        maxTempC: tempC,
        minFeelsLikeC: feelsLikeC,
        maxFeelsLikeC: feelsLikeC,
        precipitationMm: 0,
        symbolCandidates: [],
        windSpeedTotal: 0,
        windSpeedCount: 0,
        humidityTotal: 0,
        humidityCount: 0,
        pressureTotal: 0,
        pressureCount: 0,
        visibilityTotal: 0,
        visibilityCount: 0,
        uvIndexTotal: 0,
        uvIndexCount: 0,
        hourly: [],
        pressures: [],
      });
    }

    const current = groupedByDay.get(dayKey)!;
    current.minTempC = Math.min(current.minTempC, tempC);
    current.maxTempC = Math.max(current.maxTempC, tempC);
    current.minFeelsLikeC = Math.min(current.minFeelsLikeC, feelsLikeC);
    current.maxFeelsLikeC = Math.max(current.maxFeelsLikeC, feelsLikeC);
    current.precipitationMm += precipitation;
    if (typeof windSpeed === "number") {
      current.windSpeedTotal += windSpeed;
      current.windSpeedCount += 1;
    }
    if (typeof humidity === "number") {
      current.humidityTotal += humidity;
      current.humidityCount += 1;
    }
    if (typeof pressure === "number") {
      current.pressureTotal += pressure;
      current.pressureCount += 1;
      current.pressures.push(pressure);
    }
    if (typeof visibility === "number") {
      current.visibilityTotal += visibility;
      current.visibilityCount += 1;
    }

    current.symbolCandidates.push({ symbol, hour });
    current.hourly.push({
      id: entry.time,
      localTimeLabel: timeLabelFormatter.format(date),
      hour,
      temperatureC: tempC,
      precipitationMm: precipitation,
      windSpeedMs: windSpeed,
      humidityPct: humidity,
      pressureHpa: pressure,
      feelsLikeC,
      symbolCode: symbol,
      condition: conditionLabelForSymbol(symbol),
      visibilityKm:
        visibility !== undefined ? (1 - visibility) * 10 : undefined,
    });
  }

  const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone,
    weekday: "long",
  });
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone,
    month: "short",
    day: "numeric",
  });
  const orderedDays = [...groupedByDay.keys()]
    .sort()
    .slice(0, MAX_FORECAST_DAYS);

  return orderedDays.map((dayKey, index) => {
    const current = groupedByDay.get(dayKey)!;
    const date = dateFromDateKey(dayKey);
    const weekday = weekdayFormatter.format(date);
    const shortDate = dateFormatter.format(date);
    const dayAndDate = `${weekday}, ${shortDate}`;
    const preferredSymbol = [...current.symbolCandidates].sort((a, b) => {
      const noonDistanceA = Math.abs(a.hour - 12);
      const noonDistanceB = Math.abs(b.hour - 12);
      return noonDistanceA - noonDistanceB;
    })[0]?.symbol;
    const symbolCode = preferredSymbol ?? "cloudy";
    const condition = conditionLabelForSymbol(symbolCode);
    const avgWindSpeedMs =
      current.windSpeedCount > 0
        ? current.windSpeedTotal / current.windSpeedCount
        : undefined;
    const avgHumidityPct =
      current.humidityCount > 0
        ? current.humidityTotal / current.humidityCount
        : undefined;
    const avgPressureHpa =
      current.pressureCount > 0
        ? current.pressureTotal / current.pressureCount
        : undefined;
    const avgVisibilityKm =
      current.visibilityCount > 0
        ? (1 - current.visibilityTotal / current.visibilityCount) * 10
        : undefined;

    let pressureTrend: "rising" | "falling" | "stable" = "stable";
    if (current.pressures.length >= 3) {
      const firstHalf = current.pressures.slice(
        0,
        Math.floor(current.pressures.length / 2),
      );
      const secondHalf = current.pressures.slice(
        Math.floor(current.pressures.length / 2),
      );
      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond =
        secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      const diff = avgSecond - avgFirst;
      if (diff > 1) {
        pressureTrend = "rising";
      } else if (diff < -1) {
        pressureTrend = "falling";
      }
    }

    return {
      dateKey: dayKey,
      label: dayLabelFromIndex(index, weekday),
      shortDate,
      dayAndDate,
      minTempC: current.minTempC,
      maxTempC: current.maxTempC,
      minFeelsLikeC: current.minFeelsLikeC,
      maxFeelsLikeC: current.maxFeelsLikeC,
      minTempF: toFahrenheit(current.minTempC),
      maxTempF: toFahrenheit(current.maxTempC),
      precipitationMm: current.precipitationMm,
      symbolCode,
      condition,
      avgWindSpeedMs,
      avgHumidityPct,
      avgPressureHpa,
      pressureTrend,
      avgVisibilityKm,
      hourly: current.hourly.sort((a, b) => a.hour - b.hour),
    };
  });
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delayMs]);

  return debouncedValue;
}

function usePlaceSearch(searchText: string) {
  const debouncedText = useDebouncedValue(searchText, 250);
  const query = debouncedText.trim();
  const shouldFetch = query.length >= 2;
  const url = useMemo(
    () =>
      `${GEOCODE_API}?name=${encodeURIComponent(query)}&count=8&language=en&format=json`,
    [query],
  );

  return useFetch(url, {
    execute: shouldFetch,
    keepPreviousData: true,
    parseResponse: async (response) => {
      if (!response.ok) {
        throw new Error(`Geocoding failed (${response.status})`);
      }

      const payload = (await response.json()) as GeocodeApiResponse;
      const locations = payload.results ?? [];

      return locations.map((location) => ({
        id: normalizeLocationId({
          name: location.name,
          latitude: location.latitude,
          longitude: location.longitude,
        }),
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        country: location.country,
        region: location.admin1,
        timezone: ensureValidTimeZone(location.timezone),
      }));
    },
  });
}

interface FetchOptions {
  headers?: Record<string, string>;
}

function useCachedFetch<T>(url: string, options?: FetchOptions) {
  return useFetch<T>(url, {
    keepPreviousData: true,
    headers: {
      "User-Agent": APP_USER_AGENT,
      ...options?.headers,
    },
    parseResponse: async (response) => {
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      return response.json() as Promise<T>;
    },
  });
}

function useForecast(location: Location) {
  const url = useMemo(
    () =>
      `${MET_NO_FORECAST_API}?lat=${location.latitude.toFixed(4)}&lon=${location.longitude.toFixed(4)}`,
    [location.latitude, location.longitude],
  );

  return useCachedFetch<MetNoForecastResponse>(url);
}

function useSunEvents(location: Location, dateKey: string) {
  const url = useMemo(
    () =>
      `${MET_NO_SUNRISE_API}?lat=${location.latitude.toFixed(4)}&lon=${location.longitude.toFixed(4)}&date=${dateKey}`,
    [location.latitude, location.longitude, dateKey],
  );

  return useCachedFetch<MetNoSunResponse>(url);
}

function useAirQuality(location: Location) {
  const url = useMemo(
    () =>
      `${AIR_QUALITY_API}?latitude=${location.latitude}&longitude=${location.longitude}&hourly=us_aqi,pm10,pm2_5,ozone,nitrogen_dioxide,carbon_monoxide&forecast_days=1&timeformat=unixtime`,
    [location.latitude, location.longitude],
  );

  return useCachedFetch<{
    hourly?: {
      time?: number[];
      us_aqi?: number[];
      pm10?: number[];
      pm2_5?: number[];
      ozone?: number[];
      nitrogen_dioxide?: number[];
      carbon_monoxide?: number[];
    };
  }>(url);
}

function useWeatherAlerts(location: Location) {
  const url = useMemo(
    () =>
      `${MET_NO_ALERTS_API}?lat=${location.latitude}&lon=${location.longitude}`,
    [location.latitude, location.longitude],
  );

  return useCachedFetch<{
    features?: Array<{
      properties?: {
        event?: string;
        headline?: string;
        description?: string;
        severity?: string;
        area?: string;
      };
    }>;
  }>(url);
}

function locationSummary(location: Location): string {
  const subtitle = formatLocationSubtitle(location);
  return subtitle ? `${location.name}, ${subtitle}` : location.name;
}

function AlertBadge(props: { alerts: WeatherAlert[] }) {
  if (props.alerts.length === 0) return null;

  const severityColors: Record<string, Color> = {
    extreme: Color.Red,
    severe: Color.Orange,
    moderate: Color.Yellow,
    minor: Color.Green,
  };

  return (
    <List.Section title="Weather Alerts">
      {props.alerts.map((alert, index) => (
        <List.Item
          key={index}
          title={alert.event}
          subtitle={alert.headline}
          icon={{
            source: Icon.Warning,
            tintColor: severityColors[alert.severity] ?? Color.Yellow,
          }}
        />
      ))}
    </List.Section>
  );
}

function AirQualityView(props: {
  location: Location;
  temperatureUnit: TemperatureUnit;
  setTemperatureUnit: (unit: TemperatureUnit) => void;
}) {
  const { location, temperatureUnit, setTemperatureUnit } = props;
  const { data, error, isLoading } = useAirQuality(location);

  useEffect(() => {
    if (error) {
      void showFailureToast(error, { title: "Failed to load air quality" });
    }
  }, [error]);

  const hourly = data?.hourly;
  const getCurrentValue = <T,>(arr: T[] | undefined): T | undefined => {
    if (!arr || arr.length === 0) return undefined;
    return arr.find((v) => v !== undefined) ?? arr[0];
  };

  const aqi = getCurrentValue(hourly?.us_aqi);
  const pm25 = getCurrentValue(hourly?.pm2_5);
  const pm10 = getCurrentValue(hourly?.pm10);
  const o3 = getCurrentValue(hourly?.ozone);
  const no2 = getCurrentValue(hourly?.nitrogen_dioxide);
  const co = getCurrentValue(hourly?.carbon_monoxide);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder={`Air Quality for ${location.name}`}
    >
      <List.Section title="Air Quality Index">
        <List.Item
          title="AQI"
          subtitle={aqi !== undefined ? `${aqi} - ${aqiLabel(aqi)}` : "No data"}
          icon={{
            source: iconForAqi(aqi ?? 0),
            tintColor:
              aqi && aqi >= 4
                ? Color.Red
                : aqi && aqi >= 2
                  ? Color.Yellow
                  : Color.Green,
          }}
          accessories={aqi !== undefined ? [{ text: aqi.toString() }] : []}
          actions={
            <ActionPanel>
              {buildCommonActions(temperatureUnit, setTemperatureUnit)}
            </ActionPanel>
          }
        />
        <List.Item
          title="PM2.5"
          subtitle={pm25 !== undefined ? `${pm25.toFixed(1)} µg/m³` : "No data"}
          icon={Icon.Droplets}
          actions={
            <ActionPanel>
              {buildCommonActions(temperatureUnit, setTemperatureUnit)}
            </ActionPanel>
          }
        />
        <List.Item
          title="PM10"
          subtitle={pm10 !== undefined ? `${pm10.toFixed(1)} µg/m³` : "No data"}
          icon={Icon.Droplets}
          actions={
            <ActionPanel>
              {buildCommonActions(temperatureUnit, setTemperatureUnit)}
            </ActionPanel>
          }
        />
        <List.Item
          title="Ozone"
          subtitle={o3 !== undefined ? `${o3.toFixed(1)} µg/m³` : "No data"}
          icon={Icon.Sun}
          actions={
            <ActionPanel>
              {buildCommonActions(temperatureUnit, setTemperatureUnit)}
            </ActionPanel>
          }
        />
        <List.Item
          title="NO₂"
          subtitle={no2 !== undefined ? `${no2.toFixed(1)} µg/m³` : "No data"}
          icon={Icon.Wind}
          actions={
            <ActionPanel>
              {buildCommonActions(temperatureUnit, setTemperatureUnit)}
            </ActionPanel>
          }
        />
        <List.Item
          title="CO"
          subtitle={co !== undefined ? `${co.toFixed(1)} µg/m³` : "No data"}
          icon={Icon.Wind}
          actions={
            <ActionPanel>
              {buildCommonActions(temperatureUnit, setTemperatureUnit)}
            </ActionPanel>
          }
        />
      </List.Section>
    </List>
  );
}

function DayDetailsView(props: {
  location: Location;
  day: DailyForecast;
  temperatureUnit: TemperatureUnit;
  setTemperatureUnit: (unit: TemperatureUnit) => void;
  alerts: WeatherAlert[];
}) {
  const { location, day, temperatureUnit, setTemperatureUnit, alerts } = props;
  const {
    data: sunData,
    error: sunError,
    isLoading: isSunLoading,
  } = useSunEvents(location, day.dateKey);

  useEffect(() => {
    if (sunError) {
      void showFailureToast(sunError, { title: "Failed to load sun events" });
    }
  }, [sunError]);

  const sunriseLabel = formatIsoTimeInTimezone(
    sunData?.properties?.sunrise?.time,
    location.timezone,
  );
  const sunsetLabel = formatIsoTimeInTimezone(
    sunData?.properties?.sunset?.time,
    location.timezone,
  );

  const pressureTrendIcon =
    day.pressureTrend === "rising"
      ? "↑"
      : day.pressureTrend === "falling"
        ? "↓"
        : "→";

  return (
    <List
      isLoading={isSunLoading}
      searchBarPlaceholder={`${day.label} details`}
    >
      {alerts.length > 0 && <AlertBadge alerts={alerts} />}
      <List.Section title={`${locationSummary(location)} - ${day.dayAndDate}`}>
        <List.Item
          title="Summary"
          subtitle={day.condition}
          icon={{
            source: iconForSymbol(day.symbolCode),
            tintColor: Color.Blue,
          }}
          accessories={[
            {
              text: formatTemperatureRange(
                day.minTempC,
                day.maxTempC,
                temperatureUnit,
              ),
            },
            { text: `${day.precipitationMm.toFixed(1)} mm` },
          ]}
          actions={
            <ActionPanel>
              {buildCommonActions(temperatureUnit, setTemperatureUnit)}
            </ActionPanel>
          }
        />
        <List.Item
          title="Feels Like Range"
          subtitle={formatTemperatureRange(
            day.minFeelsLikeC,
            day.maxFeelsLikeC,
            temperatureUnit,
          )}
          icon={Icon.Info}
          actions={
            <ActionPanel>
              {buildCommonActions(temperatureUnit, setTemperatureUnit)}
            </ActionPanel>
          }
        />
        <List.Item
          title="Sunrise / Sunset"
          subtitle={`${sunriseLabel} / ${sunsetLabel}`}
          icon={Icon.Sun}
          actions={
            <ActionPanel>
              {buildCommonActions(temperatureUnit, setTemperatureUnit)}
            </ActionPanel>
          }
        />
        <List.Item
          title="Average Wind"
          subtitle={
            day.avgWindSpeedMs !== undefined
              ? `${day.avgWindSpeedMs.toFixed(1)} m/s`
              : "No data"
          }
          icon={Icon.Wind}
          actions={
            <ActionPanel>
              {buildCommonActions(temperatureUnit, setTemperatureUnit)}
            </ActionPanel>
          }
        />
        <List.Item
          title="Average Humidity"
          subtitle={
            day.avgHumidityPct !== undefined
              ? `${Math.round(day.avgHumidityPct)}%`
              : "No data"
          }
          icon={Icon.Droplets}
          actions={
            <ActionPanel>
              {buildCommonActions(temperatureUnit, setTemperatureUnit)}
            </ActionPanel>
          }
        />
        <List.Item
          title="Pressure"
          subtitle={
            day.avgPressureHpa !== undefined
              ? `${day.avgPressureHpa.toFixed(0)} hPa ${pressureTrendIcon}`
              : "No data"
          }
          icon={Icon.Gauge}
          actions={
            <ActionPanel>
              {buildCommonActions(temperatureUnit, setTemperatureUnit)}
            </ActionPanel>
          }
        />
        <List.Item
          title="Visibility"
          subtitle={
            day.avgVisibilityKm !== undefined
              ? `${day.avgVisibilityKm.toFixed(1)} km`
              : "No data"
          }
          icon={Icon.Eye}
          actions={
            <ActionPanel>
              {buildCommonActions(temperatureUnit, setTemperatureUnit)}
            </ActionPanel>
          }
        />
      </List.Section>
      <List.Section title="Hourly Forecast">
        {day.hourly.map((hour) => (
          <List.Item
            key={hour.id}
            icon={{
              source: iconForSymbol(hour.symbolCode),
              tintColor: colorForTemperature(hour.temperatureC),
            }}
            title={hour.localTimeLabel}
            subtitle={hour.condition}
            accessories={[
              { text: formatTemperature(hour.temperatureC, temperatureUnit) },
              { text: `${hour.precipitationMm.toFixed(1)} mm` },
              {
                text:
                  hour.windSpeedMs !== undefined
                    ? `${hour.windSpeedMs.toFixed(1)} m/s`
                    : "-",
              },
              {
                text:
                  hour.humidityPct !== undefined
                    ? `${Math.round(hour.humidityPct)}%`
                    : "-",
              },
            ]}
            actions={
              <ActionPanel>
                {buildCommonActions(temperatureUnit, setTemperatureUnit)}
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

function ForecastView(props: {
  location: Location;
  temperatureUnit: TemperatureUnit;
  setTemperatureUnit: (unit: TemperatureUnit) => void;
  addFavorite: ReturnType<typeof useFavoriteLocations>["addFavorite"];
  removeFavorite: ReturnType<typeof useFavoriteLocations>["removeFavorite"];
  isFavorite: ReturnType<typeof useFavoriteLocations>["isFavorite"];
  addToHistory: ReturnType<typeof useSearchHistory>["addToHistory"];
}) {
  const {
    location,
    temperatureUnit,
    setTemperatureUnit,
    addFavorite,
    removeFavorite,
    isFavorite,
    addToHistory,
  } = props;
  const { data, error, isLoading, revalidate } = useForecast(location);

  useEffect(() => {
    if (error) {
      void showFailureToast(error, { title: "Failed to load forecast" });
    }
  }, [error]);

  useEffect(() => {
    addToHistory(location);
  }, [location.id, addToHistory]);

  const { data: alertsData } = useWeatherAlerts(location);

  const alerts: WeatherAlert[] = useMemo(() => {
    const result: WeatherAlert[] = [];
    const features = alertsData?.features ?? [];
    for (const feature of features) {
      const props = feature.properties;
      if (props?.event) {
        result.push({
          area: props.area ?? "",
          event: props.event,
          headline: props.headline ?? "",
          description: props.description ?? "",
          severity:
            (props.severity?.toLowerCase() as WeatherAlert["severity"]) ??
            "unknown",
        });
      }
    }
    return result;
  }, [alertsData]);

  const dailyForecast = useMemo(() => {
    try {
      const timeseries = data?.properties?.timeseries ?? [];
      return buildDailyForecast(
        timeseries as Array<{ time: string; data: unknown }>,
        location.timezone,
      );
    } catch {
      return [];
    }
  }, [data, location.timezone]);

  const favoriteAction = isFavorite(location.id) ? (
    <Action
      title="Remove from Favorites"
      icon={Icon.StarDisabled}
      onAction={() => removeFavorite(location.id)}
    />
  ) : (
    <Action
      title="Add to Favorites"
      icon={Icon.Star}
      onAction={() => addFavorite(location)}
    />
  );

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder={`Forecast for ${location.name}`}
    >
      {alerts.length > 0 && <AlertBadge alerts={alerts} />}
      <List.Section title="Quick Actions">
        <List.Item
          title="View Air Quality"
          icon={Icon.Wind}
          actions={
            <ActionPanel>
              <Action.Push
                title="Air Quality"
                target={
                  <AirQualityView
                    location={location}
                    temperatureUnit={temperatureUnit}
                    setTemperatureUnit={setTemperatureUnit}
                  />
                }
              />
              {favoriteAction}
              {buildCommonActions(temperatureUnit, setTemperatureUnit)}
            </ActionPanel>
          }
        />
      </List.Section>
      {dailyForecast.length === 0 ? (
        <List.EmptyView
          title="No forecast yet"
          description="Try refreshing the weather data."
        />
      ) : (
        <List.Section
          title={locationSummary(location)}
          subtitle={`${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`}
        >
          {dailyForecast.map((day) => {
            const copyLine = `${locationSummary(location)} - ${day.dayAndDate}: ${day.condition}, ${formatTemperatureRange(
              day.minTempC,
              day.maxTempC,
              temperatureUnit,
            )}, ${day.precipitationMm.toFixed(1)} mm precipitation`;
            const dayAccessories = [
              {
                text: formatTemperatureRange(
                  day.minTempC,
                  day.maxTempC,
                  temperatureUnit,
                ),
                color: colorForTemperature(day.maxTempC),
              },
              {
                text: `${day.precipitationMm.toFixed(1)} mm`,
                color: colorForPrecipitation(day.precipitationMm),
              },
              ...(day.avgWindSpeedMs !== undefined
                ? [
                    {
                      text: `${day.avgWindSpeedMs.toFixed(1)} m/s`,
                      color: colorForWind(day.avgWindSpeedMs),
                    },
                  ]
                : []),
            ];

            return (
              <List.Item
                key={day.dateKey}
                icon={{
                  source: iconForSymbol(day.symbolCode),
                  tintColor: colorForTemperature(day.maxTempC),
                }}
                title={`${day.label} (${day.shortDate})`}
                subtitle={day.condition}
                accessories={dayAccessories}
                actions={
                  <ActionPanel>
                    <Action.Push
                      title="Open Day Details"
                      icon={Icon.List}
                      target={
                        <DayDetailsView
                          location={location}
                          day={day}
                          temperatureUnit={temperatureUnit}
                          setTemperatureUnit={setTemperatureUnit}
                          alerts={alerts}
                        />
                      }
                    />
                    <Action.CopyToClipboard
                      title="Copy Forecast Line"
                      content={copyLine}
                    />
                    <Action
                      title="Refresh Forecast"
                      icon={Icon.ArrowClockwise}
                      onAction={revalidate}
                    />
                    {favoriteAction}
                    {buildCommonActions(temperatureUnit, setTemperatureUnit)}
                  </ActionPanel>
                }
              />
            );
          })}
        </List.Section>
      )}
    </List>
  );
}

export default function Command() {
  const { temperatureUnit, setTemperatureUnit } = useTemperatureUnit();
  const { favorites, addFavorite, removeFavorite, isFavorite } =
    useFavoriteLocations();
  const { history, addToHistory, clearHistory } = useSearchHistory();
  const [searchText, setSearchText] = useState("");
  const [hasInteracted, setHasInteracted] = useState(false);
  const query = searchText.trim();
  const { data: places = [], isLoading, error } = usePlaceSearch(query);

  useEffect(() => {
    if (error) {
      void showFailureToast(error, { title: "Failed to find places" });
    }
  }, [error]);

  const shouldShowHint = query.length === 0;
  const needsMoreCharacters =
    hasInteracted && query.length > 0 && query.length < 2;

  const renderLocationItem = useCallback(
    (
      place: Location,
      _sectionTitle: string,
      extraActions?: React.ReactNode,
    ) => (
      <List.Item
        key={place.id}
        icon={{ source: Icon.Pin, tintColor: Color.Orange }}
        title={place.name}
        subtitle={formatLocationSubtitle(place)}
        accessories={[
          {
            text: `${place.latitude.toFixed(2)}, ${place.longitude.toFixed(2)}`,
          },
        ]}
        actions={
          <ActionPanel>
            <Action.Push
              title="Show Forecast"
              icon={Icon.Cloud}
              target={
                <ForecastView
                  location={place}
                  temperatureUnit={temperatureUnit}
                  setTemperatureUnit={setTemperatureUnit}
                  addFavorite={addFavorite}
                  removeFavorite={removeFavorite}
                  isFavorite={isFavorite}
                  addToHistory={addToHistory}
                />
              }
            />
            <Action.CopyToClipboard
              title="Copy Coordinates"
              content={`${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`}
            />
            {isFavorite(place.id) ? (
              <Action
                title="Remove from Favorites"
                icon={Icon.StarDisabled}
                onAction={() => removeFavorite(place.id)}
              />
            ) : (
              <Action
                title="Add to Favorites"
                icon={Icon.Star}
                onAction={() => addFavorite(place)}
              />
            )}
            {extraActions}
            {buildCommonActions(temperatureUnit, setTemperatureUnit)}
          </ActionPanel>
        }
      />
    ),
    [
      temperatureUnit,
      setTemperatureUnit,
      addFavorite,
      removeFavorite,
      isFavorite,
      addToHistory,
    ],
  );

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={(text) => {
        setHasInteracted(true);
        setSearchText(text);
      }}
      searchText={searchText}
      searchBarPlaceholder="Type a place (e.g. Oslo, Berlin, New York)"
    >
      {shouldShowHint || needsMoreCharacters ? (
        <List.Section title="Search">
          <List.Item
            icon={Icon.Map}
            title={shouldShowHint ? "Search by place name" : "Keep typing"}
            subtitle={
              shouldShowHint
                ? "Type at least 2 characters."
                : "Enter at least 2 characters to search places."
            }
            actions={
              <ActionPanel>
                {buildCommonActions(temperatureUnit, setTemperatureUnit)}
              </ActionPanel>
            }
          />
        </List.Section>
      ) : null}
      {!shouldShowHint &&
      !needsMoreCharacters &&
      hasInteracted &&
      places.length === 0 &&
      !isLoading ? (
        <List.Section title="Search">
          <List.Item
            icon={Icon.XMarkCircle}
            title="No matching places"
            subtitle="Try city + country, for example: Paris France"
            actions={
              <ActionPanel>
                {buildCommonActions(temperatureUnit, setTemperatureUnit)}
              </ActionPanel>
            }
          />
        </List.Section>
      ) : null}
      {!query && favorites.length > 0 ? (
        <List.Section title="Favorite Places">
          {favorites.map((place) => renderLocationItem(place, "Favorites"))}
        </List.Section>
      ) : null}
      {!query && history.length > 0 ? (
        <List.Section title="Recent Searches">
          {history.map((place) =>
            renderLocationItem(
              place,
              "Recent Searches",
              <Action
                title="Clear History"
                icon={Icon.Trash}
                onAction={clearHistory}
              />,
            ),
          )}
        </List.Section>
      ) : null}
      {places.length > 0 ? (
        <List.Section title="Matching Places">
          {places.map((place) => renderLocationItem(place, "Matching Places"))}
        </List.Section>
      ) : null}
    </List>
  );
}
