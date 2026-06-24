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
import { colorForTemperature, comfortColor } from "./utils/colors";
import {
  buildComfortScore,
  buildDecisionTags,
  buildPersonalitySummary,
  formatIsoTimeInTimezone,
  locationSummary,
} from "./utils";
import { formatTemperatureRange } from "./utils/temperature";

function rankLabel(index: number): string {
  if (index === 0) return "Best";
  if (index === 1) return "Second";
  if (index === 2) return "Third";
  return `#${index + 1}`;
}

function ComfortRankingView(props: {
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
    isUsingFallback,
    isStale,
    cacheUpdatedAt,
    aqiUsingFallback,
    revalidate,
  } = useWeatherData(location);

  useEffect(() => {
    if (error) {
      void showFailureToast(error, { title: "Failed to load comfort ranking" });
    }
  }, [error]);

  const rankedDays = useMemo(() => {
    return days
      .map((day) => {
        const maxUvIndex = day.maxUvIndex;
        const comfortScore = buildComfortScore(
          day,
          maxUvIndex,
          aqiForDate(day.dateKey),
          alertCountForDate(day.dateKey),
        );
        return { day, maxUvIndex, comfortScore };
      })
      .sort((a, b) => b.comfortScore - a.comfortScore);
  }, [alertCountForDate, aqiForDate, days]);
  const best = rankedDays[0];
  const copyRanking = rankedDays
    .slice(0, 5)
    .map(
      (ranked, index) =>
        `${index + 1}. ${ranked.day.dayAndDate}: comfort ${ranked.comfortScore}`,
    )
    .join("\n");

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder={`Comfort ranking for ${location.name}`}
      searchBarAccessory={dropdown}
    >
      {alerts.length > 0 && <AlertBadge alerts={alerts} />}
      {isUsingFallback || aqiUsingFallback ? (
        <List.Section title="Cache Status">
          <List.Item
            title="Using cached data"
            subtitle={`Last successful forecast fetch ${formatIsoTimeInTimezone(
              cacheUpdatedAt,
              location.timezone,
            )}${isStale ? " (stale)" : ""}`}
            icon={Icon.Clock}
            actions={
              <ActionPanel>
                <Action
                  title="Refresh Comfort Ranking"
                  icon={Icon.ArrowClockwise}
                  onAction={revalidate}
                />
                <CommonActions />
              </ActionPanel>
            }
          />
        </List.Section>
      ) : null}
      {best ? (
        <>
          <List.Section title="Best Day">
            <List.Item
              title={`${best.day.dayAndDate} looks best`}
              subtitle={`${buildPersonalitySummary(
                best.day,
                best.maxUvIndex,
              )} - ${best.day.rainWindowSummary ?? "No meaningful rain window"}`}
              icon={{
                source: iconForSymbol(best.day.symbolCode),
                tintColor: colorForTemperature(best.day.maxTempC),
              }}
              accessories={[
                {
                  tag: {
                    value: `Comfort ${best.comfortScore}`,
                    color: comfortColor(best.comfortScore),
                  },
                },
              ]}
              actions={
                <ActionPanel>
                  <Action.CopyToClipboard
                    title="Copy Comfort Ranking"
                    content={copyRanking}
                  />
                  <Action
                    title="Refresh Comfort Ranking"
                    icon={Icon.ArrowClockwise}
                    onAction={revalidate}
                  />
                  <ShouldIActions
                    day={best.day}
                    maxUvIndex={best.maxUvIndex}
                    aqi={aqiForDate(best.day.dateKey)}
                    alertCount={alertCountForDate(best.day.dateKey)}
                  />
                  <CommonActions />
                </ActionPanel>
              }
            />
          </List.Section>
          <List.Section title={locationSummary(location)}>
            {rankedDays.map((ranked, index) => {
              const dayAqi = aqiForDate(ranked.day.dateKey);
              const tags = buildDecisionTags(
                ranked.day,
                ranked.maxUvIndex,
                alertCountForDate(ranked.day.dateKey),
              );
              const temperatureRange = formatTemperatureRange(
                ranked.day.minTempC,
                ranked.day.maxTempC,
                prefs.temperatureUnit,
              );
              const primaryTag =
                tags.find((tag) => !tag.value.startsWith("Rain after ")) ??
                tags[0];
              const detailParts = [
                buildPersonalitySummary(ranked.day, ranked.maxUvIndex),
                ranked.day.rainWindowSummary,
                ranked.maxUvIndex !== undefined && ranked.maxUvIndex >= 0.5
                  ? `UV ${ranked.maxUvIndex.toFixed(0)}`
                  : undefined,
                dayAqi !== undefined ? `AQI ${dayAqi}` : undefined,
              ].filter(Boolean);
              return (
                <List.Item
                  key={ranked.day.dateKey}
                  title={`${rankLabel(index)} - ${ranked.day.dayAndDate} - ${temperatureRange}`}
                  subtitle={detailParts.join(" - ")}
                  icon={{
                    source: iconForSymbol(ranked.day.symbolCode),
                    tintColor: colorForTemperature(ranked.day.maxTempC),
                  }}
                  accessories={[
                    {
                      tag: {
                        value: `Comfort ${ranked.comfortScore}`,
                        color: comfortColor(ranked.comfortScore),
                      },
                    },
                    ...(primaryTag ? [{ tag: primaryTag }] : []),
                  ]}
                  actions={
                    <ActionPanel>
                      <Action.CopyToClipboard
                        title="Copy Day Ranking"
                        content={`${ranked.day.dayAndDate}: comfort ${
                          ranked.comfortScore
                        }. ${buildPersonalitySummary(
                          ranked.day,
                          ranked.maxUvIndex,
                        )}. ${
                          ranked.day.rainWindowSummary ??
                          "No meaningful rain window"
                        }.`}
                      />
                      <ShouldIActions
                        day={ranked.day}
                        maxUvIndex={ranked.maxUvIndex}
                        aqi={dayAqi}
                        alertCount={alertCountForDate(ranked.day.dateKey)}
                      />
                      <CommonActions />
                    </ActionPanel>
                  }
                />
              );
            })}
          </List.Section>
        </>
      ) : (
        <List.EmptyView
          title="No comfort ranking yet"
          description="Try refreshing the default location forecast."
          actions={
            <ActionPanel>
              <Action
                title="Refresh Comfort Ranking"
                icon={Icon.ArrowClockwise}
                onAction={revalidate}
              />
              <CommonActions />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}

export default function Command() {
  const { location, isLoading, dropdown } = useLocationSwitcher();

  if (isLoading) {
    return <List isLoading searchBarPlaceholder="Loading comfort ranking" />;
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

  return <ComfortRankingView location={location} dropdown={dropdown} />;
}
