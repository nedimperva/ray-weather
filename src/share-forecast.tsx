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
  useDefaultLocation,
  useForecast,
  useUVIndex,
  useWeatherAlerts,
} from "./hooks";
import { getForecastDays, getPrefs } from "./preferences";
import { AlertBadge, CommonActions } from "./components";
import { buildDailyForecast } from "./utils/forecast";
import { iconForSymbol } from "./utils/icons";
import {
  colorForPrecipitation,
  colorForTemperature,
  colorForUV,
  colorForWind,
} from "./utils/colors";
import {
  buildComfortScore,
  buildDecisionTags,
  buildPersonalitySummary,
  formatIsoTimeInTimezone,
  locationSummary,
  parseWeatherAlerts,
} from "./utils";
import { formatTemperatureRange } from "./utils/temperature";
import { formatPrecipitation, formatWindSpeed } from "./utils/units";

function ShareForecastView(props: { location: Location }) {
  const { location } = props;
  const prefs = getPrefs();
  const forecastDays = getForecastDays();
  const { data, error, isLoading, revalidate } = useForecast(location);
  const { data: alertsData } = useWeatherAlerts(location);
  const { data: uvData } = useUVIndex(location, forecastDays);

  useEffect(() => {
    if (error) {
      void showFailureToast(error, { title: "Failed to load share forecast" });
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
  const updatedLabel = formatIsoTimeInTimezone(
    data?.properties?.meta?.updated_at,
    location.timezone,
  );
  const markdown = [
    `# Weather for ${locationSummary(location)}`,
    "",
    `Updated: ${updatedLabel}`,
    "",
    alerts.length > 0
      ? `Alerts: ${alerts.map((alert) => alert.event).join(", ")}`
      : "Alerts: none",
    "",
    "| Day | Summary | Temp | Rain | Wind | UV | Comfort |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...dailyForecast.map((day) => {
      const maxUvIndex = uvMaxByDate.get(day.dateKey);
      const comfortScore = buildComfortScore(
        day,
        maxUvIndex,
        undefined,
        alerts.length,
      );
      return `| ${day.dayAndDate} | ${buildPersonalitySummary(
        day,
        maxUvIndex,
      )} | ${formatTemperatureRange(
        day.minTempC,
        day.maxTempC,
        prefs.temperatureUnit,
      )} | ${formatPrecipitation(
        day.precipitationMm,
        prefs.precipitationUnit,
      )} | ${formatWindSpeed(day.avgWindSpeedMs, prefs.windSpeedUnit)} | ${
        maxUvIndex !== undefined ? maxUvIndex.toFixed(0) : "-"
      } | ${comfortScore} |`;
    }),
  ].join("\n");
  const compact = dailyForecast
    .slice(0, 3)
    .map((day) => {
      const maxUvIndex = uvMaxByDate.get(day.dateKey);
      const tags = buildDecisionTags(day, maxUvIndex, alerts.length)
        .map((tag) => tag.value)
        .join(", ");
      return `${day.label}: ${buildPersonalitySummary(
        day,
        maxUvIndex,
      )}, ${formatTemperatureRange(
        day.minTempC,
        day.maxTempC,
        prefs.temperatureUnit,
      )}, rain ${formatPrecipitation(
        day.precipitationMm,
        prefs.precipitationUnit,
      )}${tags ? ` (${tags})` : ""}`;
    })
    .join("\n");

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder={`Share forecast for ${location.name}`}
    >
      {alerts.length > 0 && <AlertBadge alerts={alerts} />}
      <List.Section title="Share">
        <List.Item
          title="Markdown Forecast"
          subtitle="Table with temperature, rain, wind, UV, and comfort"
          icon={Icon.Document}
          actions={
            <ActionPanel>
              <Action.CopyToClipboard
                title="Copy Markdown Forecast"
                content={markdown}
              />
              <Action.CopyToClipboard
                title="Copy Compact Forecast"
                content={compact}
              />
              <Action
                title="Refresh Share Forecast"
                icon={Icon.ArrowClockwise}
                onAction={revalidate}
              />
              <CommonActions />
            </ActionPanel>
          }
        />
        <List.Item
          title="Compact Forecast"
          subtitle="Short text for chat or status updates"
          icon={Icon.Text}
          actions={
            <ActionPanel>
              <Action.CopyToClipboard
                title="Copy Compact Forecast"
                content={compact}
              />
              <Action.CopyToClipboard
                title="Copy Markdown Forecast"
                content={markdown}
              />
              <CommonActions />
            </ActionPanel>
          }
        />
      </List.Section>
      <List.Section title={locationSummary(location)}>
        {dailyForecast.map((day) => {
          const maxUvIndex = uvMaxByDate.get(day.dateKey);
          return (
            <List.Item
              key={day.dateKey}
              title={day.dayAndDate}
              subtitle={buildPersonalitySummary(day, maxUvIndex)}
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
    return <List isLoading searchBarPlaceholder="Loading share forecast" />;
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

  return <ShareForecastView location={location} />;
}
