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
import { AlertBadge, CommonActions, ShouldIActions } from "./components";
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
} from "./utils";
import { formatTemperatureRange } from "./utils/temperature";
import { formatPrecipitation, formatWindSpeed } from "./utils/units";

function TravelPackingView(props: {
  location: Location;
  dropdown?: SearchBarDropdown;
}) {
  const { location, dropdown } = props;
  const prefs = getPrefs();
  const {
    days,
    alerts,
    alertCountForDate,
    currentAqi,
    aqiForDate,
    error,
    isLoading,
    revalidate,
  } = useWeatherData(location);

  useEffect(() => {
    if (error) {
      void showFailureToast(error, {
        title: "Failed to load packing forecast",
      });
    }
  }, [error]);

  const uvMaxByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const day of days) {
      if (day.maxUvIndex !== undefined) map.set(day.dateKey, day.maxUvIndex);
    }
    return map;
  }, [days]);

  const suggestions = buildPackingSuggestions(
    days,
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
    ...days.map(
      (day) =>
        `- ${day.dayAndDate}: ${buildPersonalitySummary(
          day,
          day.maxUvIndex,
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
      searchBarAccessory={dropdown}
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
        {days.map((day) => {
          const maxUvIndex = day.maxUvIndex;
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
              actions={
                <ActionPanel>
                  <Action.CopyToClipboard
                    title="Copy Packing List"
                    content={copyPackingList}
                  />
                  <ShouldIActions
                    day={day}
                    maxUvIndex={maxUvIndex}
                    aqi={aqiForDate(day.dateKey)}
                    alertCount={alertCountForDate(day.dateKey)}
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
  const { location, isLoading, dropdown } = useLocationSwitcher();

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

  return <TravelPackingView location={location} dropdown={dropdown} />;
}
