import {
  Action,
  ActionPanel,
  Icon,
  LaunchType,
  List,
  launchCommand,
} from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { useEffect, useMemo } from "react";
import type { Location, WeatherAlert } from "./types";
import {
  useAirQuality,
  useDefaultLocation,
  useForecast,
  useUVIndex,
  useWeatherAlerts,
} from "./hooks";
import { getForecastDays, getPrefs } from "./preferences";
import { AlertBadge, CommonActions, ShouldIActions } from "./components";
import { buildDailyForecast } from "./utils/forecast";
import { iconForSymbol } from "./utils/icons";
import {
  colorForPrecipitation,
  colorForTemperature,
  colorForUV,
  colorForWind,
} from "./utils/colors";
import {
  buildPackingSuggestions,
  buildPersonalitySummary,
  locationSummary,
  parseWeatherAlerts,
} from "./utils";
import { formatTemperatureRange } from "./utils/temperature";
import { formatPrecipitation, formatWindSpeed } from "./utils/units";

function TravelPackingView(props: { location: Location }) {
  const { location } = props;
  const prefs = getPrefs();
  const forecastDays = getForecastDays();
  const { data, error, isLoading, revalidate } = useForecast(location);
  const { data: alertsData } = useWeatherAlerts(location);
  const { data: uvData } = useUVIndex(location, forecastDays);
  const { data: airQualityData } = useAirQuality(location);

  useEffect(() => {
    if (error) {
      void showFailureToast(error, {
        title: "Failed to load packing forecast",
      });
    }
  }, [error]);

  const dailyForecast = useMemo(() => {
    try {
      const timeseries = data?.properties?.timeseries ?? [];
      return buildDailyForecast(
        timeseries as Array<{ time: string; data: unknown }>,
        location.timezone,
        forecastDays,
      );
    } catch {
      return [];
    }
  }, [data, forecastDays, location.timezone]);
  const alerts: WeatherAlert[] = useMemo(
    () => parseWeatherAlerts(alertsData),
    [alertsData],
  );
  const currentAqi = useMemo(() => {
    const values = airQualityData?.hourly?.us_aqi ?? [];
    return values.find((value) => value !== undefined);
  }, [airQualityData]);
  const uvMaxByDate = useMemo(() => {
    const map = new Map<string, number>();
    if (uvData?.hourly?.time && uvData?.hourly?.uv_index) {
      for (let i = 0; i < uvData.hourly.time.length; i++) {
        const time = uvData.hourly.time[i];
        const uv = uvData.hourly.uv_index[i];
        if (time && uv !== undefined) {
          const dateKey = time.slice(0, 10);
          const current = map.get(dateKey);
          if (current === undefined || uv > current) map.set(dateKey, uv);
        }
      }
    }
    return map;
  }, [uvData]);
  const suggestions = buildPackingSuggestions(
    dailyForecast,
    uvMaxByDate,
    currentAqi,
    alerts.length,
  );
  const copyPackingList = [
    `Packing forecast for ${locationSummary(location)}`,
    "",
    ...suggestions.map(
      (suggestion) => `- ${suggestion.item}: ${suggestion.reason}`,
    ),
    "",
    ...dailyForecast.map(
      (day) =>
        `- ${day.dayAndDate}: ${buildPersonalitySummary(
          day,
          uvMaxByDate.get(day.dateKey),
        )}, ${formatTemperatureRange(
          day.minTempC,
          day.maxTempC,
          prefs.temperatureUnit,
        )}, rain ${formatPrecipitation(
          day.precipitationMm,
          prefs.precipitationUnit,
        )}`,
    ),
  ].join("\n");

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder={`Packing forecast for ${location.name}`}
    >
      {alerts.length > 0 && <AlertBadge alerts={alerts} />}
      <List.Section title="Packing List">
        {suggestions.map((suggestion) => (
          <List.Item
            key={suggestion.item}
            title={suggestion.item}
            subtitle={suggestion.reason}
            icon={{ source: Icon.CheckCircle, tintColor: suggestion.color }}
            actions={
              <ActionPanel>
                <Action.CopyToClipboard
                  title="Copy Packing List"
                  content={copyPackingList}
                />
                <Action
                  title="Refresh Packing Forecast"
                  icon={Icon.ArrowClockwise}
                  onAction={revalidate}
                />
                <CommonActions />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      <List.Section title={locationSummary(location)}>
        {dailyForecast.map((day) => {
          const maxUvIndex = uvMaxByDate.get(day.dateKey);
          return (
            <List.Item
              key={day.dateKey}
              title={day.dayAndDate}
              subtitle={[
                buildPersonalitySummary(day, maxUvIndex),
                day.rainWindowSummary,
              ]
                .filter(Boolean)
                .join(" - ")}
              icon={{
                source: iconForSymbol(day.symbolCode),
                tintColor: colorForTemperature(day.maxTempC),
              }}
              accessories={[
                {
                  tag: {
                    value: formatTemperatureRange(
                      day.minTempC,
                      day.maxTempC,
                      prefs.temperatureUnit,
                    ),
                    color: colorForTemperature(day.maxTempC),
                  },
                },
                {
                  tag: {
                    value: formatPrecipitation(
                      day.precipitationMm,
                      prefs.precipitationUnit,
                    ),
                    color: colorForPrecipitation(day.precipitationMm),
                  },
                },
                {
                  tag: {
                    value: formatWindSpeed(
                      day.avgWindSpeedMs,
                      prefs.windSpeedUnit,
                    ),
                    color: colorForWind(day.avgWindSpeedMs),
                  },
                },
                ...(maxUvIndex !== undefined && maxUvIndex > 0
                  ? [
                      {
                        tag: {
                          value: `UV ${maxUvIndex.toFixed(0)}`,
                          color: colorForUV(maxUvIndex),
                        },
                      },
                    ]
                  : []),
              ]}
              actions={
                <ActionPanel>
                  <Action.CopyToClipboard
                    title="Copy Packing List"
                    content={copyPackingList}
                  />
                  <ShouldIActions
                    day={day}
                    maxUvIndex={maxUvIndex}
                    aqi={currentAqi}
                    alertCount={alerts.length}
                  />
                  <CommonActions />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}

export default function Command() {
  const { location, isLoading } = useDefaultLocation();

  if (isLoading) {
    return <List isLoading searchBarPlaceholder="Loading packing forecast" />;
  }

  if (!location) {
    return (
      <List>
        <List.EmptyView
          title="No default location"
          description="Pin a location from Search Weather or add a favorite."
          actions={
            <ActionPanel>
              <Action
                title="Open Search Weather"
                icon={Icon.MagnifyingGlass}
                onAction={() =>
                  void launchCommand({
                    name: "search-weather",
                    type: LaunchType.UserInitiated,
                  })
                }
              />
              <CommonActions />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return <TravelPackingView location={location} />;
}
