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
import type { DailyForecast, Location, WeatherAlert } from "./types";
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
  dateFromDateKey,
  formatIsoTimeInTimezone,
  locationSummary,
} from "./utils";
import { formatTemperatureRange } from "./utils/temperature";
import { formatPrecipitation, formatWindSpeed } from "./utils/units";

function scoreColor(score: number): Color {
  if (score >= 75) return Color.Green;
  if (score >= 50) return Color.Yellow;
  return Color.Red;
}

function weekdayIndex(day: DailyForecast): number {
  return dateFromDateKey(day.dateKey).getUTCDay();
}

function weekendDaysFromForecast(days: DailyForecast[]): DailyForecast[] {
  const saturday = days.find((day) => weekdayIndex(day) === 6);
  const sundayAfterSaturday = saturday
    ? days.find(
        (day) => day.dateKey > saturday.dateKey && weekdayIndex(day) === 0,
      )
    : undefined;

  if (saturday && sundayAfterSaturday) return [saturday, sundayAfterSaturday];
  return days.filter((day) => [0, 6].includes(weekdayIndex(day))).slice(0, 2);
}

function reasonForPick(
  winner: DailyForecast,
  other: DailyForecast,
  winnerScore: number,
  otherScore: number,
): string {
  const reasons: string[] = [
    `${winnerScore - otherScore} comfort points higher`,
  ];

  if (winner.precipitationMm < other.precipitationMm) reasons.push("less rain");
  if ((winner.avgWindSpeedMs ?? 0) < (other.avgWindSpeedMs ?? 0)) {
    reasons.push("lighter wind");
  }
  if (winner.maxTempC > other.maxTempC && other.maxTempC < 10) {
    reasons.push("warmer");
  }
  if (winner.maxTempC < other.maxTempC && other.maxTempC > 28) {
    reasons.push("less hot");
  }

  return reasons.join(", ");
}

function WeekendDayRow(props: {
  day: DailyForecast;
  maxUvIndex?: number;
  alertCount: number;
}) {
  const { day, maxUvIndex, alertCount } = props;
  const prefs = getPrefs();
  const comfortScore = buildComfortScore(
    day,
    maxUvIndex,
    undefined,
    alertCount,
  );
  const tags = buildDecisionTags(day, maxUvIndex, alertCount);

  return (
    <List.Item
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
            value: `Comfort ${comfortScore}`,
            color: scoreColor(comfortScore),
          },
        },
        ...tags.slice(0, 2).map((tag) => ({ tag })),
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
      ]}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Weekend Day"
            content={`${day.dayAndDate}: ${buildPersonalitySummary(
              day,
              maxUvIndex,
            )}. Comfort ${comfortScore}. ${
              day.rainWindowSummary ?? "No meaningful rain window"
            }.`}
          />
          <CommonActions />
        </ActionPanel>
      }
    />
  );
}

function WeekendPlannerView(props: { location: Location }) {
  const { location } = props;
  const prefs = getPrefs();
  const forecastDays = Math.max(getForecastDays(), 10);
  const { data, error, isLoading, revalidate } = useForecast(location);
  const { data: alertsData } = useWeatherAlerts(location);
  const { data: uvData } = useUVIndex(location, forecastDays);

  useEffect(() => {
    if (error) {
      void showFailureToast(error, { title: "Failed to load weekend planner" });
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

  const alerts: WeatherAlert[] = useMemo(() => {
    const result: WeatherAlert[] = [];
    const features = alertsData?.features ?? [];
    for (const feature of features) {
      const p = feature.properties;
      if (p?.event) {
        result.push({
          area: p.area ?? "",
          event: p.event,
          headline: p.headline ?? "",
          description: p.description ?? "",
          severity:
            (p.severity?.toLowerCase() as WeatherAlert["severity"]) ??
            "unknown",
        });
      }
    }
    return result;
  }, [alertsData]);

  const maxUvByDate = useMemo(() => {
    const map = new Map<string, number>();
    if (uvData?.hourly?.time && uvData?.hourly?.uv_index) {
      for (let i = 0; i < uvData.hourly.time.length; i++) {
        const time = uvData.hourly.time[i];
        const uv = uvData.hourly.uv_index[i];
        if (time && uv !== undefined) {
          const dateKey = time.slice(0, 10);
          const current = map.get(dateKey);
          if (current === undefined || uv > current) {
            map.set(dateKey, uv);
          }
        }
      }
    }
    return map;
  }, [uvData]);

  const weekendDays = useMemo(
    () => weekendDaysFromForecast(dailyForecast),
    [dailyForecast],
  );
  const scoredWeekendDays = weekendDays.map((day) => ({
    day,
    maxUvIndex: maxUvByDate.get(day.dateKey),
    comfortScore: buildComfortScore(
      day,
      maxUvByDate.get(day.dateKey),
      undefined,
      alerts.length,
    ),
  }));
  const [bestDay, otherDay] = [...scoredWeekendDays].sort(
    (a, b) => b.comfortScore - a.comfortScore,
  );
  const updatedLabel = formatIsoTimeInTimezone(
    data?.properties?.meta?.updated_at,
    location.timezone,
  );
  const copyPlan = bestDay
    ? `${locationSummary(location)} weekend pick: ${
        bestDay.day.dayAndDate
      }. Comfort ${bestDay.comfortScore}. ${buildPersonalitySummary(
        bestDay.day,
        bestDay.maxUvIndex,
      )}. ${bestDay.day.rainWindowSummary ?? "No meaningful rain window"}.`
    : locationSummary(location);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder={`Weekend planner for ${location.name}`}
    >
      {alerts.length > 0 && <AlertBadge alerts={alerts} />}
      {bestDay ? (
        <>
          <List.Section title="Recommendation">
            <List.Item
              title={`${bestDay.day.label} looks best`}
              subtitle={
                otherDay
                  ? reasonForPick(
                      bestDay.day,
                      otherDay.day,
                      bestDay.comfortScore,
                      otherDay.comfortScore,
                    )
                  : buildPersonalitySummary(bestDay.day, bestDay.maxUvIndex)
              }
              icon={Icon.CheckCircle}
              accessories={[
                {
                  tag: {
                    value: `Comfort ${bestDay.comfortScore}`,
                    color: scoreColor(bestDay.comfortScore),
                  },
                },
                ...(bestDay.maxUvIndex !== undefined && bestDay.maxUvIndex > 0
                  ? [
                      {
                        tag: {
                          value: `UV ${bestDay.maxUvIndex.toFixed(0)}`,
                          color: colorForUV(bestDay.maxUvIndex),
                        },
                      },
                    ]
                  : []),
              ]}
              actions={
                <ActionPanel>
                  <Action.CopyToClipboard
                    title="Copy Weekend Plan"
                    content={copyPlan}
                  />
                  <Action
                    title="Refresh Weekend Planner"
                    icon={Icon.ArrowClockwise}
                    onAction={revalidate}
                  />
                  <CommonActions />
                </ActionPanel>
              }
            />
          </List.Section>
          <List.Section
            title="Weekend Days"
            subtitle={`Updated ${updatedLabel}`}
          >
            {weekendDays.map((day) => (
              <WeekendDayRow
                key={day.dateKey}
                day={day}
                maxUvIndex={maxUvByDate.get(day.dateKey)}
                alertCount={alerts.length}
              />
            ))}
          </List.Section>
          <List.Section title="Planner Details">
            {weekendDays.map((day) => (
              <List.Item
                key={day.dateKey}
                title={day.dayAndDate}
                subtitle={day.rainWindowSummary ?? "No meaningful rain window"}
                icon={Icon.BarChart}
                accessories={[
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
                  ...(maxUvByDate.get(day.dateKey) !== undefined
                    ? [
                        {
                          tag: {
                            value: `UV ${maxUvByDate
                              .get(day.dateKey)
                              ?.toFixed(0)}`,
                            color: colorForUV(
                              maxUvByDate.get(day.dateKey) ?? 0,
                            ),
                          },
                        },
                      ]
                    : []),
                ]}
              />
            ))}
          </List.Section>
          <List.Section title="Sources">
            <List.Item
              title="Forecast and Alerts"
              subtitle="met.no Locationforecast and MetAlerts"
              icon={Icon.Cloud}
            />
            <List.Item title="UV" subtitle="Open-Meteo" icon={Icon.Sun} />
          </List.Section>
        </>
      ) : (
        <List.EmptyView
          title="No weekend forecast yet"
          description="Try increasing Forecast Days to 10 or refreshing the forecast."
          actions={
            <ActionPanel>
              <Action
                title="Refresh Weekend Planner"
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
    return <List isLoading searchBarPlaceholder="Loading weekend planner" />;
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

  return <WeekendPlannerView location={location} />;
}
