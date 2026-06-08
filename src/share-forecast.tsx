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

import type { Location } from "./types";
import { useLocationSwitcher, useWeatherData } from "./hooks";
import type { SearchBarDropdown } from "./hooks";
import { getPrefs } from "./preferences";
import { AlertBadge, CommonActions } from "./components";
import { CopyWeekendPlanImageAction } from "./components/CopyWeekendPlanImageAction";
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
  buildWeekendPlan,
  buildPersonalitySummary,
  formatIsoTimeInTimezone,
  locationSummary,
} from "./utils";
import { formatTemperatureRange } from "./utils/temperature";
import { formatPrecipitation, formatWindSpeed } from "./utils/units";

function ShareForecastView(props: {
  location: Location;
  dropdown?: SearchBarDropdown;
}) {
  const { location, dropdown } = props;
  const prefs = getPrefs();
  const {
    days,
    alerts,
    alertCountForDate,
    aqiForDate,
    error,
    isLoading,
    forecastUpdatedAt,
    revalidate,
  } = useWeatherData(location);

  useEffect(() => {
    if (error) {
      void showFailureToast(error, { title: "Failed to load share forecast" });
    }
  }, [error]);

  const updatedLabel = formatIsoTimeInTimezone(
    forecastUpdatedAt,
    location.timezone,
  );
  const {
    weekendDays,
    isFallbackWeekend,
    scoredWeekendDays,
    bestDay,
    otherDay,
  } = useMemo(
    () => buildWeekendPlan(days, { aqiForDate, alertCountForDate }),
    [alertCountForDate, aqiForDate, days],
  );
  const weekendImageInput = {
    location,
    days: scoredWeekendDays,
    bestDay,
    otherDay,
    updatedLabel,
    alerts,
    preferences: prefs,
    isFallbackWeekend,
  };
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
    ...days.map((day) => {
      const maxUvIndex = day.maxUvIndex;
      const comfortScore = buildComfortScore(
        day,
        maxUvIndex,
        aqiForDate(day.dateKey),
        alertCountForDate(day.dateKey),
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
  const compact = days
    .slice(0, 3)
    .map((day) => {
      const maxUvIndex = day.maxUvIndex;
      const tags = buildDecisionTags(
        day,
        maxUvIndex,
        alertCountForDate(day.dateKey),
      )
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
      searchBarAccessory={dropdown}
    >
      {alerts.length > 0 && <AlertBadge alerts={alerts} />}
      <List.Section title="Share">
        {bestDay ? (
          <List.Item
            title="Weekend Plan Image"
            subtitle={`Pasteable PNG for ${weekendDays
              .map((day) => day.shortDate)
              .join(" / ")}`}
            icon={Icon.Image}
            actions={
              <ActionPanel>
                <CopyWeekendPlanImageAction input={weekendImageInput} />
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
        ) : null}
        <List.Item
          title="Markdown Forecast"
          subtitle="Table with temperature, rain, wind, UV, and comfort"
          icon={Icon.Document}
          actions={
            <ActionPanel>
              {bestDay ? (
                <CopyWeekendPlanImageAction input={weekendImageInput} />
              ) : null}
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
              {bestDay ? (
                <CopyWeekendPlanImageAction input={weekendImageInput} />
              ) : null}
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
        {days.map((day) => {
          const maxUvIndex = day.maxUvIndex;
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
                ...(maxUvIndex !== undefined && maxUvIndex >= 0.5
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
  const { location, isLoading, dropdown } = useLocationSwitcher();

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

  return <ShareForecastView location={location} dropdown={dropdown} />;
}
