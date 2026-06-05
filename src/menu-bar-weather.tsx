import {
  Icon,
  LaunchType,
  MenuBarExtra,
  launchCommand,
  openExtensionPreferences,
} from "@raycast/api";
import { showFailureToast, useFetch } from "@raycast/utils";
import { useEffect, useMemo } from "react";
import type { MetNoForecastResponse } from "./types";
import { MET_NO_FORECAST_API, APP_USER_AGENT } from "./constants";
import { useDefaultLocation } from "./hooks";
import { getPrefs } from "./preferences";
import { calculateFeelsLikeC, formatTemperature } from "./utils/temperature";
import { formatWindSpeed, formatPrecipitation } from "./utils/units";
import {
  conditionLabelForSymbol,
  displayLocationName,
} from "./utils/formatting";
import { ensureValidTimeZone, formatIsoTimeInTimezone } from "./utils/dates";

export default function MenuBarWeather() {
  const { location, isLoading: isLocationLoading } = useDefaultLocation();
  const prefs = getPrefs();

  const url = useMemo(
    () =>
      location
        ? `${MET_NO_FORECAST_API}?lat=${location.latitude.toFixed(4)}&lon=${location.longitude.toFixed(4)}`
        : "",
    [location],
  );

  const {
    data,
    error,
    isLoading: isForecastLoading,
  } = useFetch<MetNoForecastResponse>(url, {
    execute: !!location,
    keepPreviousData: true,
    headers: { "User-Agent": APP_USER_AGENT },
    parseResponse: async (response) => {
      if (!response.ok) throw new Error(`Forecast failed (${response.status})`);
      return response.json() as Promise<MetNoForecastResponse>;
    },
  });

  useEffect(() => {
    if (error) {
      void showFailureToast(error, { title: "Menu bar weather failed" });
    }
  }, [error]);

  const isLoading = isLocationLoading || isForecastLoading;

  // Parse current conditions
  const current = useMemo(() => {
    if (!data?.properties?.timeseries?.length) return null;
    const entry = data.properties.timeseries[0];
    const details = entry.data?.instant?.details;
    if (!details) return null;

    const tempC = details.air_temperature;
    const windSpeedMs = details.wind_speed;
    const humidityPct = details.relative_humidity;
    const feelsLikeC = calculateFeelsLikeC(tempC, windSpeedMs, humidityPct);
    const symbolCode =
      entry.data?.next_1_hours?.summary?.symbol_code ?? "cloudy";
    const precipMm =
      entry.data?.next_1_hours?.details?.precipitation_amount ?? 0;

    return {
      tempC,
      windSpeedMs,
      humidityPct,
      feelsLikeC,
      symbolCode,
      condition: conditionLabelForSymbol(symbolCode),
      precipMm,
    };
  }, [data]);

  // Parse upcoming hours
  const upcomingHours = useMemo(() => {
    if (!data?.properties?.timeseries || !location) return [];
    const tz = ensureValidTimeZone(location.timezone);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    });

    return data.properties.timeseries.slice(1, 7).map((entry) => {
      const details = entry.data?.instant?.details;
      const symbolCode =
        entry.data?.next_1_hours?.summary?.symbol_code ?? "cloudy";
      return {
        time: formatter.format(new Date(entry.time)),
        tempC: details?.air_temperature ?? 0,
        condition: conditionLabelForSymbol(symbolCode),
      };
    });
  }, [data, location]);

  if (!location) {
    return (
      <MenuBarExtra icon={Icon.Cloud} isLoading={isLoading} tooltip="Weather">
        <MenuBarExtra.Item
          title="No location set"
          subtitle="Pin a location from Search Weather"
        />
        <MenuBarExtra.Item
          title="Open Search Weather"
          onAction={() =>
            void launchCommand({
              name: "search-weather",
              type: LaunchType.UserInitiated,
            })
          }
        />
        <MenuBarExtra.Separator />
        <MenuBarExtra.Item
          title="Preferences..."
          onAction={openExtensionPreferences}
        />
      </MenuBarExtra>
    );
  }

  const title = current
    ? (() => {
        const temperature = formatTemperature(
          current.tempC,
          prefs.temperatureUnit,
        );
        switch (prefs.menuBarDisplayMode) {
          case "temp-only":
            return temperature;
          case "temp-rain":
            return `${temperature} ${formatPrecipitation(
              current.precipMm,
              prefs.precipitationUnit,
            )}`;
          case "feels-like":
            return `Feels ${formatTemperature(
              current.feelsLikeC,
              prefs.temperatureUnit,
            )}`;
          case "location-temp":
            return `${displayLocationName(location)} ${temperature}`;
          case "compact":
            return undefined;
          case "temp-condition":
          default:
            return `${temperature} ${current.condition}`;
        }
      })()
    : prefs.menuBarDisplayMode === "compact"
      ? undefined
      : "Loading...";
  const updatedLabel = formatIsoTimeInTimezone(
    data?.properties?.meta?.updated_at,
    location.timezone,
  );

  return (
    <MenuBarExtra
      icon={Icon.Cloud}
      title={title}
      isLoading={isLoading}
      tooltip={`Weather for ${displayLocationName(location)}`}
    >
      <MenuBarExtra.Section title={displayLocationName(location)}>
        {current && (
          <>
            <MenuBarExtra.Item
              title={`${formatTemperature(current.tempC, prefs.temperatureUnit)} - ${current.condition}`}
            />
            <MenuBarExtra.Item
              title={`Feels like: ${formatTemperature(current.feelsLikeC, prefs.temperatureUnit)}`}
            />
            {current.windSpeedMs !== undefined && (
              <MenuBarExtra.Item
                title={`Wind: ${formatWindSpeed(current.windSpeedMs, prefs.windSpeedUnit)}`}
              />
            )}
            {current.humidityPct !== undefined && (
              <MenuBarExtra.Item
                title={`Humidity: ${Math.round(current.humidityPct)}%`}
              />
            )}
            <MenuBarExtra.Item
              title={`Precipitation: ${formatPrecipitation(current.precipMm, prefs.precipitationUnit)}`}
            />
            <MenuBarExtra.Item title={`Updated: ${updatedLabel}`} />
          </>
        )}
      </MenuBarExtra.Section>

      {upcomingHours.length > 0 && (
        <MenuBarExtra.Section title="Upcoming Hours">
          {upcomingHours.map((hour, i) => (
            <MenuBarExtra.Item
              key={i}
              title={`${hour.time}: ${formatTemperature(hour.tempC, prefs.temperatureUnit)} ${hour.condition}`}
            />
          ))}
        </MenuBarExtra.Section>
      )}

      <MenuBarExtra.Separator />
      <MenuBarExtra.Item
        title="Open Full Forecast"
        onAction={() =>
          void launchCommand({
            name: "search-weather",
            type: LaunchType.UserInitiated,
          })
        }
      />
      <MenuBarExtra.Item
        title="Preferences..."
        onAction={openExtensionPreferences}
      />
    </MenuBarExtra>
  );
}
