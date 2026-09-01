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

import type { DailyForecast, Location } from "./types";
import { MAX_FORECAST_DAYS } from "./constants";
import { useLocationSwitcher, useWeatherData } from "./hooks";
import type { SearchBarDropdown } from "./hooks";
import { getPrefs } from "./preferences";
import { AlertBadge, CommonActions } from "./components";
import { CopyWeekendPlanImageAction } from "./components/CopyWeekendPlanImageAction";
import { SetWeekendWallpaperAction } from "./components/SetWeekendWallpaperAction";
import { iconForSymbol } from "./utils/icons";
import {
  colorForPrecipitation,
  colorForTemperature,
  colorForUV,
  colorForWind,
  comfortColor,
} from "./utils/colors";
import {
  buildWeekendPlan,
  buildComfortScore,
  buildDecisionTags,
  buildPersonalitySummary,
  formatIsoTimeInTimezone,
  locationSummary,
  reasonForPick,
} from "./utils";
import { formatTemperatureRange } from "./utils/temperature";
import { formatPrecipitation, formatWindSpeed } from "./utils/units";

function WeekendDayRow(props: {
  day: DailyForecast;
  maxUvIndex?: number;
  aqi?: number;
  alertCount: number;
}) {
  const { day, maxUvIndex, aqi, alertCount } = props;
  const prefs = getPrefs();
  const comfortScore = buildComfortScore(day, maxUvIndex, aqi, alertCount);
  const tags = buildDecisionTags(day, maxUvIndex, alertCount);
  const temperatureRange = formatTemperatureRange(
    day.minTempC,
    day.maxTempC,
    prefs.temperatureUnit,
  );
  const primaryTag =
    tags.find((tag) => !tag.value.startsWith("Rain after ")) ?? tags[0];

  return (
    <List.Item
      title={`${day.dayAndDate} - ${temperatureRange}`}
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
            color: comfortColor(comfortScore),
          },
        },
        ...(primaryTag ? [{ tag: primaryTag }] : []),
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

function WeekendPlannerView(props: {
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
  } = useWeatherData(location, { days: MAX_FORECAST_DAYS });

  useEffect(() => {
    if (error) {
      void showFailureToast(error, { title: "Failed to load weekend planner" });
    }
  }, [error]);

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
  const updatedLabel = formatIsoTimeInTimezone(
    forecastUpdatedAt,
    location.timezone,
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
      searchBarAccessory={dropdown}
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
                    color: comfortColor(bestDay.comfortScore),
                  },
                },
                ...(bestDay.maxUvIndex !== undefined &&
                bestDay.maxUvIndex >= 0.5
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
                  <CopyWeekendPlanImageAction input={weekendImageInput} />
                  <SetWeekendWallpaperAction input={weekendImageInput} />
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
            title={isFallbackWeekend ? "Next Available Days" : "Weekend Days"}
            subtitle={`Updated ${updatedLabel}`}
          >
            {weekendDays.map((day) => (
              <WeekendDayRow
                key={day.dateKey}
                day={day}
                maxUvIndex={day.maxUvIndex}
                aqi={aqiForDate(day.dateKey)}
                alertCount={alertCountForDate(day.dateKey)}
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
                  ...(day.maxUvIndex !== undefined && day.maxUvIndex >= 0.5
                    ? [
                        {
                          tag: {
                            value: `UV ${day.maxUvIndex.toFixed(0)}`,
                            color: colorForUV(day.maxUvIndex),
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
              title="Forecast, UV, and Alerts"
              subtitle="met.no Locationforecast and MetAlerts"
              icon={Icon.Cloud}
            />
          </List.Section>
        </>
      ) : (
        <List.Section title="Weekend Planner">
          <List.Item
            title={isLoading ? "Loading forecast" : "No forecast data"}
            subtitle={
              error
                ? "Refresh failed. Cached data was not available for this location."
                : `Default location: ${locationSummary(location)}`
            }
            icon={isLoading ? Icon.Clock : Icon.Calendar}
            actions={
              <ActionPanel>
                <Action
                  title="Refresh Weekend Planner"
                  icon={Icon.ArrowClockwise}
                  onAction={revalidate}
                />
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
        </List.Section>
      )}
    </List>
  );
}

export default function Command() {
  const { location, isLoading, dropdown } = useLocationSwitcher();

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

  return <WeekendPlannerView location={location} dropdown={dropdown} />;
}
