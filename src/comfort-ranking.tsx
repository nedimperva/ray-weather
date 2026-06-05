import {
  Action,
  ActionPanel,
  Color,
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
  colorForAqi,
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

function scoreColor(score: number): Color {
  if (score >= 75) return Color.Green;
  if (score >= 50) return Color.Yellow;
  return Color.Red;
}

function rankLabel(index: number): string {
  if (index === 0) return "Best";
  if (index === 1) return "Second";
  if (index === 2) return "Third";
  return `#${index + 1}`;
}

function ComfortRankingView(props: { location: Location }) {
  const { location } = props;
  const prefs = getPrefs();
  const forecastDays = getForecastDays();
  const {
    data,
    error,
    isLoading,
    isUsingFallback,
    cacheUpdatedAt,
    revalidate,
  } = useForecast(location);
  const { data: alertsData } = useWeatherAlerts(location);
  const { data: uvData, isUsingFallback: isUvUsingFallback } = useUVIndex(
    location,
    forecastDays,
  );
  const { data: airQualityData, isUsingFallback: isAqiUsingFallback } =
    useAirQuality(location);

  useEffect(() => {
    if (error) {
      void showFailureToast(error, { title: "Failed to load comfort ranking" });
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
  const rankedDays = useMemo(() => {
    return dailyForecast
      .map((day) => {
        const maxUvIndex = uvMaxByDate.get(day.dateKey);
        const comfortScore = buildComfortScore(
          day,
          maxUvIndex,
          currentAqi,
          alerts.length,
        );
        return { day, maxUvIndex, comfortScore };
      })
      .sort((a, b) => b.comfortScore - a.comfortScore);
  }, [alerts.length, currentAqi, dailyForecast, uvMaxByDate]);
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
    >
      {alerts.length > 0 && <AlertBadge alerts={alerts} />}
      {isUsingFallback || isUvUsingFallback || isAqiUsingFallback ? (
        <List.Section title="Cache Status">
          <List.Item
            title="Using cached data"
            subtitle={`Last successful forecast fetch ${formatIsoTimeInTimezone(
              cacheUpdatedAt,
              location.timezone,
            )}`}
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
                    color: scoreColor(best.comfortScore),
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
                    aqi={currentAqi}
                    alertCount={alerts.length}
                  />
                  <CommonActions />
                </ActionPanel>
              }
            />
          </List.Section>
          <List.Section title={locationSummary(location)}>
            {rankedDays.map((ranked, index) => {
              const tags = buildDecisionTags(
                ranked.day,
                ranked.maxUvIndex,
                alerts.length,
              );
              return (
                <List.Item
                  key={ranked.day.dateKey}
                  title={`${rankLabel(index)} - ${ranked.day.dayAndDate}`}
                  subtitle={[
                    buildPersonalitySummary(ranked.day, ranked.maxUvIndex),
                    ranked.day.rainWindowSummary,
                  ]
                    .filter(Boolean)
                    .join(" - ")}
                  icon={{
                    source: iconForSymbol(ranked.day.symbolCode),
                    tintColor: colorForTemperature(ranked.day.maxTempC),
                  }}
                  accessories={[
                    {
                      tag: {
                        value: `Comfort ${ranked.comfortScore}`,
                        color: scoreColor(ranked.comfortScore),
                      },
                    },
                    ...tags.slice(0, 2).map((tag) => ({ tag })),
                    {
                      tag: {
                        value: formatTemperatureRange(
                          ranked.day.minTempC,
                          ranked.day.maxTempC,
                          prefs.temperatureUnit,
                        ),
                        color: colorForTemperature(ranked.day.maxTempC),
                      },
                    },
                    {
                      tag: {
                        value: formatPrecipitation(
                          ranked.day.precipitationMm,
                          prefs.precipitationUnit,
                        ),
                        color: colorForPrecipitation(
                          ranked.day.precipitationMm,
                        ),
                      },
                    },
                    {
                      tag: {
                        value: formatWindSpeed(
                          ranked.day.avgWindSpeedMs,
                          prefs.windSpeedUnit,
                        ),
                        color: colorForWind(ranked.day.avgWindSpeedMs),
                      },
                    },
                    ...(ranked.maxUvIndex !== undefined && ranked.maxUvIndex > 0
                      ? [
                          {
                            tag: {
                              value: `UV ${ranked.maxUvIndex.toFixed(0)}`,
                              color: colorForUV(ranked.maxUvIndex),
                            },
                          },
                        ]
                      : []),
                    ...(currentAqi !== undefined
                      ? [
                          {
                            tag: {
                              value: `AQI ${currentAqi}`,
                              color: colorForAqi(currentAqi),
                            },
                          },
                        ]
                      : []),
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
  const { location, isLoading } = useDefaultLocation();

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

  return <ComfortRankingView location={location} />;
}
