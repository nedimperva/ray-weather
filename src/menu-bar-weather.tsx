import {
  Color,
  Icon,
  LaunchType,
  MenuBarExtra,
  launchCommand,
  openExtensionPreferences,
} from "@raycast/api";
import { showFailureToast, useFetch } from "@raycast/utils";
import { useEffect, useMemo } from "react";
import type { Location, MetNoForecastResponse } from "./types";
import { MET_NO_FORECAST_API, APP_USER_AGENT } from "./constants";
import { useDefaultLocation, useSunEvents, useWeatherAlerts } from "./hooks";
import { getPrefs } from "./preferences";
import { calculateFeelsLikeC, formatTemperature } from "./utils/temperature";
import { formatWindSpeed, formatPrecipitation } from "./utils/units";
import {
  conditionLabelForSymbol,
  displayLocationName,
} from "./utils/formatting";
import {
  dateKeyInTimezone,
  ensureValidTimeZone,
  formatIsoTimeInTimezone,
} from "./utils/dates";
import { parseWeatherAlerts, severityRank } from "./utils/alerts";
import { adjustUvForClouds } from "./utils/uv";

const severityColors: Record<string, Color> = {
  extreme: Color.Red,
  severe: Color.Orange,
  moderate: Color.Yellow,
  minor: Color.Green,
};

function MenuBarContent(props: { location: Location }) {
  const { location } = props;
  const prefs = getPrefs();
  const timeZone = ensureValidTimeZone(location.timezone);
  const todayKey = useMemo(
    () => dateKeyInTimezone(new Date(), timeZone),
    [timeZone],
  );

  const url = `${MET_NO_FORECAST_API}?lat=${location.latitude.toFixed(4)}&lon=${location.longitude.toFixed(4)}`;
  const {
    data,
    error,
    isLoading: isForecastLoading,
  } = useFetch<MetNoForecastResponse>(url, {
    keepPreviousData: true,
    headers: { "User-Agent": APP_USER_AGENT },
    parseResponse: async (response) => {
      if (!response.ok) throw new Error(`Forecast failed (${response.status})`);
      return response.json() as Promise<MetNoForecastResponse>;
    },
  });
  const { data: alertsData } = useWeatherAlerts(location);
  const { data: sunData } = useSunEvents(location, todayKey);

  useEffect(() => {
    if (error) {
      void showFailureToast(error, { title: "Menu bar weather failed" });
    }
  }, [error]);

  const alerts = useMemo(
    () =>
      parseWeatherAlerts(alertsData).sort(
        (a, b) => severityRank(b.severity) - severityRank(a.severity),
      ),
    [alertsData],
  );

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
    const uvIndex = adjustUvForClouds(
      details.ultraviolet_index_clear_sky,
      details.cloud_area_fraction,
    );

    return {
      tempC,
      windSpeedMs,
      humidityPct,
      feelsLikeC,
      symbolCode,
      condition: conditionLabelForSymbol(symbolCode),
      precipMm,
      uvIndex,
    };
  }, [data]);

  const upcomingHours = useMemo(() => {
    if (!data?.properties?.timeseries) return [];
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
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
  }, [data, timeZone]);

  const hasAlerts = alerts.length > 0;
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
  const sunriseLabel = formatIsoTimeInTimezone(
    sunData?.properties?.sunrise?.time,
    location.timezone,
  );
  const sunsetLabel = formatIsoTimeInTimezone(
    sunData?.properties?.sunset?.time,
    location.timezone,
  );

  return (
    <MenuBarExtra
      icon={
        hasAlerts ? { source: Icon.Warning, tintColor: Color.Red } : Icon.Cloud
      }
      title={title}
      isLoading={isForecastLoading}
      tooltip={
        hasAlerts
          ? `${alerts.length} active alert${alerts.length === 1 ? "" : "s"} for ${displayLocationName(location)}`
          : `Weather for ${displayLocationName(location)}`
      }
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
            {current.uvIndex !== undefined && current.uvIndex >= 0.5 && (
              <MenuBarExtra.Item
                title={`UV index: ${current.uvIndex.toFixed(0)}`}
              />
            )}
            <MenuBarExtra.Item title={`Updated: ${updatedLabel}`} />
          </>
        )}
      </MenuBarExtra.Section>

      {hasAlerts && (
        <MenuBarExtra.Section title="Weather Alerts">
          {alerts.map((alert, index) => (
            <MenuBarExtra.Item
              key={`${alert.event}-${index}`}
              icon={{
                source: Icon.Warning,
                tintColor: severityColors[alert.severity] ?? Color.Yellow,
              }}
              title={alert.event}
              subtitle={alert.area || undefined}
              onAction={() =>
                void launchCommand({
                  name: "severe-weather-alerts",
                  type: LaunchType.UserInitiated,
                })
              }
            />
          ))}
        </MenuBarExtra.Section>
      )}

      <MenuBarExtra.Section title="Daylight">
        <MenuBarExtra.Item title={`Sunrise: ${sunriseLabel}`} icon={Icon.Sun} />
        <MenuBarExtra.Item title={`Sunset: ${sunsetLabel}`} icon={Icon.Moon} />
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

export default function MenuBarWeather() {
  const { location, isLoading } = useDefaultLocation();

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

  return <MenuBarContent location={location} />;
}
