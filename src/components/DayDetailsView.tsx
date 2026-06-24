import { ActionPanel, Icon, List } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { useEffect } from "react";
import type { Location, DailyForecast, WeatherAlert } from "../types";
import { getPrefs } from "../preferences";
import { useSunEvents } from "../hooks";
import { iconForSymbol } from "../utils/icons";
import { colorForTemperature } from "../utils/colors";
import {
  formatTemperature,
  formatTemperatureRange,
} from "../utils/temperature";
import { formatWindSpeed, formatPrecipitation } from "../utils/units";
import {
  formatIsoTimeInTimezone,
  formatWindDirection,
  groupHourlyByPeriod,
  locationSummary,
} from "../utils";
import { AlertBadge } from "./AlertBadge";
import { CommonActions } from "./CommonActions";

export function DayDetailsView(props: {
  location: Location;
  day: DailyForecast;
  alerts: WeatherAlert[];
}) {
  const { location, day, alerts } = props;
  const prefs = getPrefs();
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

  const hourlyGroups = groupHourlyByPeriod(day.hourly);
  const pressureTrendLabel =
    day.pressureTrend === "rising"
      ? "rising"
      : day.pressureTrend === "falling"
        ? "falling"
        : "stable";

  return (
    <List
      isLoading={isSunLoading}
      searchBarPlaceholder={`${day.label} details`}
    >
      {alerts.length > 0 && <AlertBadge alerts={alerts} />}
      <List.Section title={`${locationSummary(location)} - ${day.dayAndDate}`}>
        <List.Item
          title="Summary"
          subtitle={[
            day.condition,
            formatTemperatureRange(
              day.minTempC,
              day.maxTempC,
              prefs.temperatureUnit,
            ),
            `rain ${formatPrecipitation(
              day.precipitationMm,
              prefs.precipitationUnit,
            )}`,
          ].join(" - ")}
          icon={{
            source: iconForSymbol(day.symbolCode),
            tintColor: colorForTemperature(day.maxTempC),
          }}
          actions={
            <ActionPanel>
              <CommonActions />
            </ActionPanel>
          }
        />
        <List.Item
          title="Feels Like Range"
          subtitle={formatTemperatureRange(
            day.minFeelsLikeC,
            day.maxFeelsLikeC,
            prefs.temperatureUnit,
          )}
          icon={Icon.Info}
          actions={
            <ActionPanel>
              <CommonActions />
            </ActionPanel>
          }
        />
        <List.Item
          title="Daily Temperature Timing"
          subtitle={[
            day.minTempTimeLabel
              ? `Low ${formatTemperature(day.minTempC, prefs.temperatureUnit)} at ${day.minTempTimeLabel}`
              : undefined,
            day.maxTempTimeLabel
              ? `High ${formatTemperature(day.maxTempC, prefs.temperatureUnit)} at ${day.maxTempTimeLabel}`
              : undefined,
          ]
            .filter(Boolean)
            .join(" - ")}
          icon={Icon.Clock}
          actions={
            <ActionPanel>
              <CommonActions />
            </ActionPanel>
          }
        />
        <List.Item
          title="Rain Window"
          subtitle={day.rainWindowSummary ?? "No meaningful rain window"}
          icon={Icon.CloudRain}
          actions={
            <ActionPanel>
              <CommonActions />
            </ActionPanel>
          }
        />
        <List.Item
          title="Sunrise / Sunset"
          subtitle={`${sunriseLabel} / ${sunsetLabel}`}
          icon={Icon.Sun}
          actions={
            <ActionPanel>
              <CommonActions />
            </ActionPanel>
          }
        />
        <List.Item
          title="Average Wind"
          subtitle={formatWindSpeed(day.avgWindSpeedMs, prefs.windSpeedUnit)}
          icon={Icon.Wind}
          actions={
            <ActionPanel>
              <CommonActions />
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
              <CommonActions />
            </ActionPanel>
          }
        />
        <List.Item
          title="Pressure"
          subtitle={
            day.avgPressureHpa !== undefined
              ? `${day.avgPressureHpa.toFixed(0)} hPa, ${pressureTrendLabel}`
              : "No data"
          }
          icon={Icon.Gauge}
          actions={
            <ActionPanel>
              <CommonActions />
            </ActionPanel>
          }
        />
        <List.Item
          title="Fog Coverage"
          subtitle={
            day.avgFogCoveragePct !== undefined
              ? `${day.avgFogCoveragePct.toFixed(0)}% average`
              : "No data"
          }
          icon={Icon.Cloud}
          actions={
            <ActionPanel>
              <CommonActions />
            </ActionPanel>
          }
        />
      </List.Section>
      {Object.entries(hourlyGroups).map(([period, hours]) =>
        hours.length > 0 ? (
          <List.Section key={period} title={period}>
            {hours.map((hour) => {
              const uvIndex = hour.uvIndex;
              const windDirection = formatWindDirection(hour.windDirectionDeg);
              return (
                <List.Item
                  key={hour.id}
                  icon={{
                    source: iconForSymbol(hour.symbolCode),
                    tintColor: colorForTemperature(hour.temperatureC),
                  }}
                  title={`${hour.localTimeLabel} - ${formatTemperature(
                    hour.temperatureC,
                    prefs.temperatureUnit,
                  )}`}
                  subtitle={[
                    hour.condition,
                    `rain ${formatPrecipitation(
                      hour.precipitationMm,
                      prefs.precipitationUnit,
                    )}`,
                    hour.precipitationProbabilityPct !== undefined
                      ? `${Math.round(
                          hour.precipitationProbabilityPct,
                        )}% chance`
                      : undefined,
                    [
                      formatWindSpeed(hour.windSpeedMs, prefs.windSpeedUnit),
                      windDirection,
                    ]
                      .filter(Boolean)
                      .join(" "),
                    hour.windGustMs !== undefined
                      ? `gust ${formatWindSpeed(
                          hour.windGustMs,
                          prefs.windSpeedUnit,
                        )}`
                      : undefined,
                    hour.humidityPct !== undefined
                      ? `${Math.round(hour.humidityPct)}% humidity`
                      : undefined,
                    uvIndex !== undefined && uvIndex >= 0.5
                      ? `UV ${uvIndex.toFixed(0)}`
                      : undefined,
                  ]
                    .filter(Boolean)
                    .join(" - ")}
                  actions={
                    <ActionPanel>
                      <CommonActions />
                    </ActionPanel>
                  }
                />
              );
            })}
          </List.Section>
        ) : null,
      )}
    </List>
  );
}
