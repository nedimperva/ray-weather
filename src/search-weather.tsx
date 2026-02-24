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
import { useEffect, useMemo, useState } from "react";

const GEOCODE_API = "https://geocoding-api.open-meteo.com/v1/search";
const MET_NO_FORECAST_API =
  "https://api.met.no/weatherapi/locationforecast/2.0/compact";
const MET_NO_SUNRISE_API = "https://api.met.no/weatherapi/sunrise/3.0/sun";
const APP_USER_AGENT =
  "yr-no-raycast-extension/1.0 (https://github.com/your-org/yr.no-ray)";
const MAX_FORECAST_DAYS = 10;
const TEMPERATURE_UNIT_STORAGE_KEY = "temperature-unit";

type TemperatureUnit = "celsius" | "fahrenheit";

type GeocodeApiResult = {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
};

type GeocodeApiResponse = {
  results?: GeocodeApiResult[];
};

type Location = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  region?: string;
  timezone: string;
};

type ForecastEntry = {
  time: string;
  data: {
    instant: {
      details: {
        air_temperature: number;
        wind_speed?: number;
        relative_humidity?: number;
        air_pressure_at_sea_level?: number;
      };
    };
    next_1_hours?: {
      summary?: {
        symbol_code?: string;
      };
      details?: {
        precipitation_amount?: number;
      };
    };
  };
};

type MetNoForecastResponse = {
  properties?: {
    timeseries?: ForecastEntry[];
  };
};

type MetNoSunResponse = {
  properties?: {
    sunrise?: {
      time?: string;
    };
    sunset?: {
      time?: string;
    };
  };
};

type DailyForecast = {
  dateKey: string;
  label: string;
  shortDate: string;
  dayAndDate: string;
  minTempC: number;
  maxTempC: number;
  minFeelsLikeC: number;
  maxFeelsLikeC: number;
  minTempF: number;
  maxTempF: number;
  precipitationMm: number;
  symbolCode: string;
  condition: string;
  avgWindSpeedMs?: number;
  avgHumidityPct?: number;
  hourly: HourlyForecast[];
};

type HourlyForecast = {
  id: string;
  localTimeLabel: string;
  hour: number;
  temperatureC: number;
  precipitationMm: number;
  windSpeedMs?: number;
  humidityPct?: number;
  pressureHpa?: number;
  feelsLikeC: number;
  symbolCode: string;
  condition: string;
};

type SymbolCandidate = {
  symbol: string;
  hour: number;
};

type DailyAccumulator = {
  minTempC: number;
  maxTempC: number;
  minFeelsLikeC: number;
  maxFeelsLikeC: number;
  precipitationMm: number;
  symbolCandidates: SymbolCandidate[];
  windSpeedTotal: number;
  windSpeedCount: number;
  humidityTotal: number;
  humidityCount: number;
  hourly: HourlyForecast[];
};

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
    return `${Math.round(toFahrenheit(tempC))} F`;
  }

  return `${Math.round(tempC)} C`;
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

  if (symbolCode.includes("fog")) {
    return Icon.EyeDisabled;
  }

  if (symbolCode.includes("partlycloudy") || symbolCode.includes("fair")) {
    return Icon.CloudSun;
  }

  if (symbolCode.includes("clearsky")) {
    return Icon.Sun;
  }

  return Icon.Cloud;
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

function useTemperatureUnit() {
  const [temperatureUnit, setTemperatureUnitState] =
    useState<TemperatureUnit>("celsius");

  useEffect(() => {
    void (async () => {
      const savedUnit = await LocalStorage.getItem<string>(
        TEMPERATURE_UNIT_STORAGE_KEY,
      );
      setTemperatureUnitState(normalizeTemperatureUnit(savedUnit));
    })();
  }, []);

  const setTemperatureUnit = (unit: TemperatureUnit) => {
    setTemperatureUnitState(unit);
    void LocalStorage.setItem(TEMPERATURE_UNIT_STORAGE_KEY, unit);
    void showToast({
      style: Toast.Style.Success,
      title: `Temperature Unit: ${unit === "celsius" ? "Celsius" : "Fahrenheit"}`,
    });
  };

  return { temperatureUnit, setTemperatureUnit };
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

function buildDailyForecast(
  timeseries: ForecastEntry[],
  timezone: string,
): DailyForecast[] {
  const safeTimeZone = ensureValidTimeZone(timezone);
  const groupedByDay = new Map<string, DailyAccumulator>();
  const timeLabelFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone,
    hour: "numeric",
    minute: "2-digit",
  });

  for (const entry of timeseries) {
    const date = new Date(entry.time);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const tempC = entry.data?.instant?.details?.air_temperature;
    if (typeof tempC !== "number") {
      continue;
    }

    const dayKey = dateKeyInTimezone(date, safeTimeZone);
    const hour = localHourInTimezone(date, safeTimeZone);
    const precipitation =
      entry.data.next_1_hours?.details?.precipitation_amount ?? 0;
    const symbol = entry.data.next_1_hours?.summary?.symbol_code ?? "cloudy";
    const windSpeed = entry.data.instant.details.wind_speed;
    const humidity = entry.data.instant.details.relative_humidity;
    const pressure = entry.data.instant.details.air_pressure_at_sea_level;
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
        hourly: [],
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
      hourly: current.hourly.sort((a, b) => a.hour - b.hour),
    };
  });
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}

function usePlaceSearch(searchText: string) {
  const debouncedText = useDebouncedValue(searchText, 250);
  const query = debouncedText.trim();
  const shouldFetch = query.length >= 2;
  const url = `${GEOCODE_API}?name=${encodeURIComponent(query)}&count=8&language=en&format=json`;

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

function useForecast(location: Location) {
  const url = `${MET_NO_FORECAST_API}?lat=${location.latitude.toFixed(4)}&lon=${location.longitude.toFixed(4)}`;

  return useFetch(url, {
    keepPreviousData: true,
    parseResponse: async (response) => {
      if (!response.ok) {
        throw new Error(`Forecast request failed (${response.status})`);
      }

      return (await response.json()) as MetNoForecastResponse;
    },
  });
}

function useSunEvents(location: Location, dateKey: string) {
  const url = `${MET_NO_SUNRISE_API}?lat=${location.latitude.toFixed(4)}&lon=${location.longitude.toFixed(4)}&date=${dateKey}`;

  return useFetch(url, {
    keepPreviousData: true,
    parseResponse: async (response) => {
      if (!response.ok) {
        throw new Error(`Sun events request failed (${response.status})`);
      }

      return (await response.json()) as MetNoSunResponse;
    },
  });
}

function locationSummary(location: Location): string {
  const subtitle = formatLocationSubtitle(location);
  return subtitle ? `${location.name}, ${subtitle}` : location.name;
}

function DayDetailsView(props: {
  location: Location;
  day: DailyForecast;
  temperatureUnit: TemperatureUnit;
  setTemperatureUnit: (unit: TemperatureUnit) => void;
}) {
  const { location, day, temperatureUnit, setTemperatureUnit } = props;
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

  return (
    <List
      isLoading={isSunLoading}
      searchBarPlaceholder={`${day.label} details`}
    >
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
              {buildTemperatureUnitActions(temperatureUnit, setTemperatureUnit)}
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
              {buildTemperatureUnitActions(temperatureUnit, setTemperatureUnit)}
            </ActionPanel>
          }
        />
        <List.Item
          title="Sunrise / Sunset"
          subtitle={`${sunriseLabel} / ${sunsetLabel}`}
          icon={Icon.Sun}
          actions={
            <ActionPanel>
              {buildTemperatureUnitActions(temperatureUnit, setTemperatureUnit)}
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
              {buildTemperatureUnitActions(temperatureUnit, setTemperatureUnit)}
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
              {buildTemperatureUnitActions(temperatureUnit, setTemperatureUnit)}
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
              tintColor: Color.Blue,
            }}
            title={hour.localTimeLabel}
            subtitle={hour.condition}
            accessories={[
              { text: formatTemperature(hour.temperatureC, temperatureUnit) },
              {
                text: `Feels ${formatTemperature(
                  hour.feelsLikeC,
                  temperatureUnit,
                )}`,
              },
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
                {buildTemperatureUnitActions(
                  temperatureUnit,
                  setTemperatureUnit,
                )}
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
}) {
  const { location, temperatureUnit, setTemperatureUnit } = props;
  const { data, error, isLoading, revalidate } = useForecast(location);

  useEffect(() => {
    if (error) {
      void showFailureToast(error, { title: "Failed to load forecast" });
    }
  }, [error]);

  const dailyForecast = useMemo(() => {
    try {
      const timeseries = data?.properties?.timeseries ?? [];
      return buildDailyForecast(timeseries, location.timezone);
    } catch {
      return [];
    }
  }, [data, location.timezone]);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder={`Forecast for ${location.name}`}
    >
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
              },
              { text: `${day.precipitationMm.toFixed(1)} mm` },
              ...(day.avgWindSpeedMs !== undefined
                ? [{ text: `${day.avgWindSpeedMs.toFixed(1)} m/s` }]
                : []),
            ];

            return (
              <List.Item
                key={day.dateKey}
                icon={{
                  source: iconForSymbol(day.symbolCode),
                  tintColor: Color.Blue,
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
                    <Action.OpenInBrowser
                      title="Open Raw API Response"
                      url={`${MET_NO_FORECAST_API}?lat=${location.latitude.toFixed(4)}&lon=${location.longitude.toFixed(4)}`}
                    />
                    {buildTemperatureUnitActions(
                      temperatureUnit,
                      setTemperatureUnit,
                    )}
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
  const [searchText, setSearchText] = useState("");
  const [hasSeededSearch, setHasSeededSearch] = useState(false);
  const query = searchText.trim();
  const { data: places = [], isLoading, error } = usePlaceSearch(query);

  useEffect(() => {
    if (error) {
      void showFailureToast(error, { title: "Failed to find places" });
    }
  }, [error]);

  useEffect(() => {
    if (hasSeededSearch) {
      return;
    }

    setHasSeededSearch(true);

    void (async () => {
      const saved = await LocalStorage.getItem<string>("last-place");
      if (saved?.trim()) {
        setSearchText(saved);
      }
    })();
  }, [hasSeededSearch]);

  useEffect(() => {
    if (query.length >= 2) {
      void LocalStorage.setItem("last-place", query);
    }
  }, [query]);

  const shouldShowHint = query.length === 0;
  const needsMoreCharacters = query.length > 0 && query.length < 2;

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
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
                {buildTemperatureUnitActions(
                  temperatureUnit,
                  setTemperatureUnit,
                )}
              </ActionPanel>
            }
          />
        </List.Section>
      ) : null}
      {!shouldShowHint &&
      !needsMoreCharacters &&
      places.length === 0 &&
      !isLoading ? (
        <List.Section title="Search">
          <List.Item
            icon={Icon.XMarkCircle}
            title="No matching places"
            subtitle="Try city + country, for example: Paris France"
            actions={
              <ActionPanel>
                {buildTemperatureUnitActions(
                  temperatureUnit,
                  setTemperatureUnit,
                )}
              </ActionPanel>
            }
          />
        </List.Section>
      ) : null}
      {places.length > 0 ? (
        <List.Section title="Matching Places">
          {places.map((place) => (
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
                      />
                    }
                  />
                  <Action.CopyToClipboard
                    title="Copy Coordinates"
                    content={`${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`}
                  />
                  {buildTemperatureUnitActions(
                    temperatureUnit,
                    setTemperatureUnit,
                  )}
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ) : null}
      <List.Item
        key="about-api"
        icon={{ source: Icon.Info, tintColor: Color.SecondaryText }}
        title="Data source"
        subtitle="Forecast: yr.no (met.no) / Geocoding: Open-Meteo"
        actions={
          <ActionPanel>
            <Action.OpenInBrowser
              title="Yr.no API Docs"
              url="https://api.met.no/weatherapi/locationforecast/2.0/documentation"
            />
            <Action.OpenInBrowser
              title="Open-Meteo Geocoding Docs"
              url="https://open-meteo.com/en/docs/geocoding-api"
            />
            {buildTemperatureUnitActions(temperatureUnit, setTemperatureUnit)}
          </ActionPanel>
        }
      />
      <List.Item
        key="api-user-agent"
        icon={{ source: Icon.Person, tintColor: Color.SecondaryText }}
        title="Set your own User-Agent"
        subtitle="met.no asks for a unique app identifier and contact details."
        actions={
          <ActionPanel>
            <Action
              title="Show Current User-Agent"
              onAction={() =>
                void showToast({
                  style: Toast.Style.Success,
                  title: APP_USER_AGENT,
                })
              }
            />
            {buildTemperatureUnitActions(temperatureUnit, setTemperatureUnit)}
          </ActionPanel>
        }
      />
    </List>
  );
}
