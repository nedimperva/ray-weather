import {
  Icon,
  LaunchType,
  MenuBarExtra,
  launchCommand,
  LocalStorage,
  openExtensionPreferences,
} from "@raycast/api";
import { showFailureToast, useFetch } from "@raycast/utils";
import { useEffect, useMemo, useState, useRef } from "react";
import type { Location, MetNoForecastResponse } from "./types";
import {
  MET_NO_FORECAST_API,
  APP_USER_AGENT,
  MENU_BAR_LOCATION_KEY,
  FAVORITE_LOCATIONS_KEY,
} from "./constants";
import { getPrefs } from "./preferences";
import { formatTemperature } from "./utils/temperature";
import { formatWindSpeed, formatPrecipitation } from "./utils/units";
import { conditionLabelForSymbol } from "./utils/formatting";
import { ensureValidTimeZone } from "./utils/dates";

function useMenuBarLocation() {
  const [location, setLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    void (async () => {
      // Try pinned location first
      const pinned = await LocalStorage.getItem<string>(MENU_BAR_LOCATION_KEY);
      if (pinned) {
        try {
          setLocation(JSON.parse(pinned));
          setIsLoading(false);
          return;
        } catch {
          // fall through
        }
      }

      // Try first favorite
      const favs = await LocalStorage.getItem<string>(FAVORITE_LOCATIONS_KEY);
      if (favs) {
        try {
          const parsed = JSON.parse(favs) as Location[];
          if (parsed.length > 0) {
            setLocation(parsed[0]);
            setIsLoading(false);
            return;
          }
        } catch {
          // fall through
        }
      }

      setIsLoading(false);
    })();
  }, []);

  return { location, isLoading };
}

export default function MenuBarWeather() {
  const { location, isLoading: isLocationLoading } = useMenuBarLocation();
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
    const symbolCode =
      entry.data?.next_1_hours?.summary?.symbol_code ?? "cloudy";
    const precipMm =
      entry.data?.next_1_hours?.details?.precipitation_amount ?? 0;

    return {
      tempC,
      windSpeedMs,
      humidityPct,
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
    ? `${formatTemperature(current.tempC, prefs.temperatureUnit)} ${current.condition}`
    : "Loading...";

  return (
    <MenuBarExtra
      icon={Icon.Cloud}
      title={title}
      isLoading={isLoading}
      tooltip={`Weather for ${location.name}`}
    >
      <MenuBarExtra.Section title={location.name}>
        {current && (
          <>
            <MenuBarExtra.Item
              title={`${formatTemperature(current.tempC, prefs.temperatureUnit)} - ${current.condition}`}
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
