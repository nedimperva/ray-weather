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
import type {
  DailyForecast,
  HourlyForecast,
  Location,
  WeatherAlert,
} from "./types";
import {
  useDefaultLocation,
  useForecast,
  useUVIndex,
  useWeatherAlerts,
} from "./hooks";
import { getCommuteHours, getForecastDays, getPrefs } from "./preferences";
import { AlertBadge, CommonActions, ShouldIActions } from "./components";
import { buildDailyForecast } from "./utils/forecast";
import {
  colorForPrecipitation,
  colorForTemperature,
  colorForUV,
  colorForWind,
} from "./utils/colors";
import {
  formatIsoTimeInTimezone,
  locationSummary,
  parseWeatherAlerts,
} from "./utils";
import { formatTemperature } from "./utils/temperature";
import { formatPrecipitation, formatWindSpeed } from "./utils/units";

type CommuteWindow = {
  id: "morning" | "evening";
  title: string;
  startHour: number;
  endHour: number;
  hours: HourlyForecast[];
  precipitationMm: number;
  maxWindSpeedMs?: number;
  avgFeelsLikeC?: number;
  avgTempC?: number;
  maxUvIndex?: number;
  riskLevel: "low" | "moderate" | "high";
  recommendation: string;
  reason: string;
};

function hoursInWindow(
  day: DailyForecast,
  startHour: number,
  endHour: number,
): HourlyForecast[] {
  return day.hourly.filter(
    (hour) => hour.hour >= startHour && hour.hour <= endHour,
  );
}

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function windowLabel(startHour: number, endHour: number): string {
  return `${startHour.toString().padStart(2, "0")}:00-${endHour
    .toString()
    .padStart(2, "0")}:00`;
}

function riskColor(riskLevel: CommuteWindow["riskLevel"]): Color {
  if (riskLevel === "high") return Color.Red;
  if (riskLevel === "moderate") return Color.Orange;
  return Color.Green;
}

function buildCommuteWindow(
  id: CommuteWindow["id"],
  title: string,
  day: DailyForecast,
  startHour: number,
  endHour: number,
  maxUvByHour: Map<number, number>,
  alertCount: number,
): CommuteWindow {
  const hours = hoursInWindow(day, startHour, endHour);
  const precipitationMm = hours.reduce(
    (total, hour) => total + hour.precipitationMm,
    0,
  );
  const maxWindSpeedMs =
    hours.length > 0
      ? Math.max(...hours.map((hour) => hour.windSpeedMs ?? 0))
      : undefined;
  const avgFeelsLikeC = average(hours.map((hour) => hour.feelsLikeC));
  const avgTempC = average(hours.map((hour) => hour.temperatureC));
  const maxUvIndex = Math.max(
    0,
    ...hours.map((hour) => maxUvByHour.get(hour.hour) ?? 0),
  );
  const fogRisk = (day.avgFogCoveragePct ?? 0) >= 30;

  let riskLevel: CommuteWindow["riskLevel"] = "low";
  let recommendation = "Looks fine";
  let reason = "no major commute hazards in the forecast";

  if (alertCount > 0 || precipitationMm >= 3 || (maxWindSpeedMs ?? 0) >= 12) {
    riskLevel = "high";
    recommendation = "Leave extra time";
    reason =
      alertCount > 0
        ? "active weather alert"
        : precipitationMm >= 3
          ? "heavier rain during this window"
          : "strong wind during this window";
  } else if (
    precipitationMm >= 0.5 ||
    (maxWindSpeedMs ?? 0) >= 8 ||
    fogRisk ||
    (avgFeelsLikeC ?? 20) <= 3
  ) {
    riskLevel = "moderate";
    recommendation = "Plan with care";
    reason =
      precipitationMm >= 0.5
        ? "rain is possible"
        : (maxWindSpeedMs ?? 0) >= 8
          ? "wind may be noticeable"
          : fogRisk
            ? "fog coverage is elevated"
            : "it may feel cold";
  }

  return {
    id,
    title,
    startHour,
    endHour,
    hours,
    precipitationMm,
    maxWindSpeedMs,
    avgFeelsLikeC,
    avgTempC,
    maxUvIndex,
    riskLevel,
    recommendation,
    reason,
  };
}

function CommuteWindowRow(props: {
  commuteWindow: CommuteWindow;
  day: DailyForecast;
  alertCount: number;
}) {
  const { commuteWindow, day, alertCount } = props;
  const prefs = getPrefs();
  const label = windowLabel(commuteWindow.startHour, commuteWindow.endHour);
  const copyText = `${commuteWindow.title} commute (${label}): ${
    commuteWindow.recommendation
  }. ${commuteWindow.reason}. Feels like ${
    commuteWindow.avgFeelsLikeC !== undefined
      ? formatTemperature(commuteWindow.avgFeelsLikeC, prefs.temperatureUnit)
      : "No data"
  }, rain ${formatPrecipitation(
    commuteWindow.precipitationMm,
    prefs.precipitationUnit,
  )}.`;

  return (
    <List.Item
      title={`${commuteWindow.title} Commute`}
      subtitle={`${commuteWindow.recommendation} - ${commuteWindow.reason} - ${label}`}
      icon={{
        source: commuteWindow.riskLevel === "low" ? Icon.Car : Icon.Warning,
        tintColor: riskColor(commuteWindow.riskLevel),
      }}
      accessories={[
        {
          tag: {
            value: commuteWindow.riskLevel,
            color: riskColor(commuteWindow.riskLevel),
          },
        },
        ...(commuteWindow.avgFeelsLikeC !== undefined
          ? [
              {
                tag: {
                  value: `Feels ${formatTemperature(
                    commuteWindow.avgFeelsLikeC,
                    prefs.temperatureUnit,
                  )}`,
                  color: colorForTemperature(commuteWindow.avgFeelsLikeC),
                },
              },
            ]
          : []),
        {
          tag: {
            value: formatPrecipitation(
              commuteWindow.precipitationMm,
              prefs.precipitationUnit,
            ),
            color: colorForPrecipitation(commuteWindow.precipitationMm),
          },
        },
        {
          tag: {
            value: formatWindSpeed(
              commuteWindow.maxWindSpeedMs,
              prefs.windSpeedUnit,
            ),
            color: colorForWind(commuteWindow.maxWindSpeedMs),
          },
        },
        ...(commuteWindow.maxUvIndex !== undefined &&
        commuteWindow.maxUvIndex > 0
          ? [
              {
                tag: {
                  value: `UV ${commuteWindow.maxUvIndex.toFixed(0)}`,
                  color: colorForUV(commuteWindow.maxUvIndex),
                },
              },
            ]
          : []),
      ]}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Commute Forecast"
            content={copyText}
          />
          <ShouldIActions day={day} alertCount={alertCount} />
          <CommonActions />
        </ActionPanel>
      }
    />
  );
}

function CommuteForecastView(props: { location: Location }) {
  const { location } = props;
  const forecastDays = getForecastDays();
  const { data, error, isLoading, revalidate } = useForecast(location);
  const { data: alertsData } = useWeatherAlerts(location);
  const { data: uvData } = useUVIndex(location, forecastDays);
  const commuteHours = getCommuteHours();

  useEffect(() => {
    if (error) {
      void showFailureToast(error, {
        title: "Failed to load commute forecast",
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
  const today = dailyForecast[0];

  const maxUvByHour = useMemo(() => {
    const map = new Map<number, number>();
    if (!today || !uvData?.hourly?.time || !uvData.hourly.uv_index) return map;

    for (let i = 0; i < uvData.hourly.time.length; i++) {
      const time = uvData.hourly.time[i];
      const uv = uvData.hourly.uv_index[i];
      if (time?.startsWith(today.dateKey) && uv !== undefined) {
        const hour = Number.parseInt(time.slice(11, 13), 10);
        const current = map.get(hour);
        if (current === undefined || uv > current) map.set(hour, uv);
      }
    }
    return map;
  }, [today, uvData]);

  const commuteWindows = today
    ? [
        buildCommuteWindow(
          "morning",
          "Morning",
          today,
          commuteHours.morningStart,
          commuteHours.morningEnd,
          maxUvByHour,
          alerts.length,
        ),
        buildCommuteWindow(
          "evening",
          "Evening",
          today,
          commuteHours.eveningStart,
          commuteHours.eveningEnd,
          maxUvByHour,
          alerts.length,
        ),
      ]
    : [];
  const riskiestWindow = [...commuteWindows].sort((a, b) => {
    const rank = { low: 1, moderate: 2, high: 3 };
    return rank[b.riskLevel] - rank[a.riskLevel];
  })[0];
  const updatedLabel = formatIsoTimeInTimezone(
    data?.properties?.meta?.updated_at,
    location.timezone,
  );

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder={`Commute forecast for ${location.name}`}
    >
      {alerts.length > 0 && <AlertBadge alerts={alerts} />}
      {today && riskiestWindow ? (
        <>
          <List.Section title="Commute Summary">
            <List.Item
              title={
                riskiestWindow.riskLevel === "low"
                  ? "Commute looks calm"
                  : `${riskiestWindow.title} commute needs attention`
              }
              subtitle={`${riskiestWindow.recommendation} - ${riskiestWindow.reason} - updated ${updatedLabel}`}
              icon={{
                source:
                  riskiestWindow.riskLevel === "low" ? Icon.Car : Icon.Warning,
                tintColor: riskColor(riskiestWindow.riskLevel),
              }}
              accessories={[
                {
                  tag: {
                    value: riskiestWindow.riskLevel,
                    color: riskColor(riskiestWindow.riskLevel),
                  },
                },
              ]}
              actions={
                <ActionPanel>
                  <Action
                    title="Refresh Commute Forecast"
                    icon={Icon.ArrowClockwise}
                    onAction={revalidate}
                  />
                  <ShouldIActions day={today} alertCount={alerts.length} />
                  <CommonActions />
                </ActionPanel>
              }
            />
          </List.Section>
          <List.Section title={locationSummary(location)}>
            {commuteWindows.map((commuteWindow) => (
              <CommuteWindowRow
                key={commuteWindow.id}
                commuteWindow={commuteWindow}
                day={today}
                alertCount={alerts.length}
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
          title="No commute forecast yet"
          description="Try refreshing the default location forecast."
          actions={
            <ActionPanel>
              <Action
                title="Refresh Commute Forecast"
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
    return <List isLoading searchBarPlaceholder="Loading commute forecast" />;
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

  return <CommuteForecastView location={location} />;
}
