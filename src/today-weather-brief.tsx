import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  LaunchType,
  launchCommand,
} from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { useEffect, useMemo } from "react";
import type { Location, WeatherAlert } from "./types";
import {
  useAirQuality,
  useDefaultLocation,
  useForecast,
  useSunEvents,
  useUVIndex,
  useWeatherAlerts,
} from "./hooks";
import { getForecastDays, getPrefs } from "./preferences";
import { AlertBadge } from "./components";
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
  formatLocalDateTimeInTimezone,
  formatUnixTimeInTimezone,
  getCurrentHour,
  locationSummary,
  parseWeatherAlerts,
} from "./utils";
import { formatTemperature, formatTemperatureRange } from "./utils/temperature";
import { formatPrecipitation, formatWindSpeed } from "./utils/units";
import { CommonActions, ShouldIActions } from "./components";

function BriefView(props: { location: Location }) {
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
  const {
    data: airQualityData,
    isUsingFallback: isAqiUsingFallback,
    cacheUpdatedAt: aqiCacheUpdatedAt,
    revalidate: revalidateAqi,
  } = useAirQuality(location);
  const {
    data: uvData,
    isUsingFallback: isUvUsingFallback,
    cacheUpdatedAt: uvCacheUpdatedAt,
    revalidate: revalidateUv,
  } = useUVIndex(location, forecastDays);

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

  const today = dailyForecast[0];
  const currentHour = today ? getCurrentHour(today) : undefined;
  const {
    data: sunData,
    error: sunError,
    isLoading: isSunLoading,
  } = useSunEvents(location, today?.dateKey ?? "");

  useEffect(() => {
    if (error) {
      void showFailureToast(error, { title: "Failed to load weather brief" });
    }
  }, [error]);

  useEffect(() => {
    if (sunError) {
      void showFailureToast(sunError, { title: "Failed to load sun events" });
    }
  }, [sunError]);

  const alerts: WeatherAlert[] = useMemo(
    () => parseWeatherAlerts(alertsData),
    [alertsData],
  );

  const currentAqi = useMemo(() => {
    const values = airQualityData?.hourly?.us_aqi ?? [];
    return values.find((value) => value !== undefined);
  }, [airQualityData]);
  const currentAqiUpdatedAt = useMemo(() => {
    const values = airQualityData?.hourly?.us_aqi ?? [];
    const times = airQualityData?.hourly?.time ?? [];
    const index = values.findIndex((value) => value !== undefined);
    return index >= 0 ? times[index] : undefined;
  }, [airQualityData]);

  const uvByDateHour = useMemo(() => {
    const map = new Map<string, number>();
    if (uvData?.hourly?.time && uvData?.hourly?.uv_index) {
      for (let i = 0; i < uvData.hourly.time.length; i++) {
        const time = uvData.hourly.time[i];
        const uv = uvData.hourly.uv_index[i];
        if (time && uv !== undefined) {
          const dateKey = time.slice(0, 10);
          const hour = parseInt(time.slice(11, 13), 10);
          map.set(`${dateKey}-${hour}`, uv);
        }
      }
    }
    return map;
  }, [uvData]);

  const currentUv =
    today && currentHour
      ? uvByDateHour.get(`${today.dateKey}-${currentHour.hour}`)
      : undefined;
  const currentUvUpdatedAt =
    today && currentHour
      ? uvData?.hourly?.time?.find((time) => {
          if (!time) return false;
          const hour = parseInt(time.slice(11, 13), 10);
          return time.startsWith(today.dateKey) && hour === currentHour.hour;
        })
      : undefined;
  const comfortScore = today
    ? buildComfortScore(today, currentUv, currentAqi, alerts.length)
    : undefined;
  const comfortColor =
    comfortScore === undefined
      ? Color.SecondaryText
      : comfortScore >= 75
        ? Color.Green
        : comfortScore >= 50
          ? Color.Yellow
          : Color.Red;
  const decisionTags = today
    ? buildDecisionTags(today, currentUv, alerts.length)
    : [];
  const updatedLabel = formatIsoTimeInTimezone(
    data?.properties?.meta?.updated_at,
    location.timezone,
  );
  const forecastFreshnessLabel = isUsingFallback
    ? `Cached fetch ${formatIsoTimeInTimezone(cacheUpdatedAt, location.timezone)}`
    : `Forecast ${updatedLabel}`;
  const aqiFreshnessLabel = isAqiUsingFallback
    ? `Cached fetch ${formatIsoTimeInTimezone(
        aqiCacheUpdatedAt,
        location.timezone,
      )}`
    : `AQI sample ${formatUnixTimeInTimezone(
        currentAqiUpdatedAt,
        location.timezone,
      )}`;
  const uvFreshnessLabel = isUvUsingFallback
    ? `Cached fetch ${formatIsoTimeInTimezone(
        uvCacheUpdatedAt,
        location.timezone,
      )}`
    : `UV sample ${formatLocalDateTimeInTimezone(
        currentUvUpdatedAt,
        location.timezone,
      )}`;
  const sunriseLabel = formatIsoTimeInTimezone(
    sunData?.properties?.sunrise?.time,
    location.timezone,
  );
  const sunsetLabel = formatIsoTimeInTimezone(
    sunData?.properties?.sunset?.time,
    location.timezone,
  );

  const copyBrief =
    today && currentHour
      ? `${locationSummary(location)} today: ${formatTemperature(
          currentHour.temperatureC,
          prefs.temperatureUnit,
        )}, ${currentHour.condition}. ${decisionTags
          .map((tag) => tag.value)
          .join(", ")}. Range ${formatTemperatureRange(
          today.minTempC,
          today.maxTempC,
          prefs.temperatureUnit,
        )}. ${today.rainWindowSummary ?? "No meaningful rain window"}.`
      : locationSummary(location);

  return (
    <List
      isLoading={isLoading || isSunLoading}
      searchBarPlaceholder={`Weather brief for ${location.name}`}
    >
      {alerts.length > 0 && <AlertBadge alerts={alerts} />}
      {today && currentHour ? (
        <>
          <List.Section title="Brief">
            <List.Item
              title={`${formatTemperature(
                currentHour.temperatureC,
                prefs.temperatureUnit,
              )} - ${currentHour.condition}`}
              subtitle={`${buildPersonalitySummary(
                today,
                currentUv,
              )} - feels like ${formatTemperature(
                currentHour.feelsLikeC,
                prefs.temperatureUnit,
              )} - updated ${updatedLabel}`}
              icon={{
                source: iconForSymbol(currentHour.symbolCode),
                tintColor: colorForTemperature(currentHour.temperatureC),
              }}
              accessories={[
                ...(comfortScore !== undefined
                  ? [
                      {
                        tag: {
                          value: `Comfort ${comfortScore}`,
                          color: comfortColor,
                        },
                      },
                    ]
                  : []),
                {
                  tag: {
                    value: `Rain ${formatPrecipitation(
                      currentHour.precipitationMm,
                      prefs.precipitationUnit,
                    )}`,
                    color: colorForPrecipitation(currentHour.precipitationMm),
                  },
                },
                ...(currentHour.windSpeedMs !== undefined
                  ? [
                      {
                        tag: {
                          value: formatWindSpeed(
                            currentHour.windSpeedMs,
                            prefs.windSpeedUnit,
                          ),
                          color: colorForWind(currentHour.windSpeedMs),
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
                ...(currentUv !== undefined && currentUv > 0
                  ? [
                      {
                        tag: {
                          value: `UV ${currentUv.toFixed(0)}`,
                          color: colorForUV(currentUv),
                        },
                      },
                    ]
                  : []),
              ]}
              actions={
                <ActionPanel>
                  <Action.CopyToClipboard
                    title="Copy Weather Brief"
                    content={copyBrief}
                  />
                  <Action
                    title="Refresh Brief"
                    icon={Icon.ArrowClockwise}
                    onAction={revalidate}
                  />
                  <ShouldIActions
                    day={today}
                    maxUvIndex={currentUv}
                    aqi={currentAqi}
                    alertCount={alerts.length}
                  />
                  <CommonActions />
                </ActionPanel>
              }
            />
          </List.Section>
          <List.Section title="Decisions">
            <List.Item
              title="Today's Calls"
              subtitle={decisionTags.map((tag) => tag.value).join(" - ")}
              icon={Icon.CheckCircle}
              accessories={decisionTags.map((tag) => ({ tag }))}
              actions={
                <ActionPanel>
                  <Action.CopyToClipboard
                    title="Copy Weather Brief"
                    content={copyBrief}
                  />
                  <ShouldIActions
                    day={today}
                    maxUvIndex={currentUv}
                    aqi={currentAqi}
                    alertCount={alerts.length}
                  />
                  <CommonActions />
                </ActionPanel>
              }
            />
          </List.Section>
          <List.Section title="Timing">
            <List.Item
              title="Temperature Range"
              subtitle={[
                today.minTempTimeLabel
                  ? `Low ${formatTemperature(today.minTempC, prefs.temperatureUnit)} at ${today.minTempTimeLabel}`
                  : undefined,
                today.maxTempTimeLabel
                  ? `High ${formatTemperature(today.maxTempC, prefs.temperatureUnit)} at ${today.maxTempTimeLabel}`
                  : undefined,
              ]
                .filter(Boolean)
                .join(" - ")}
              icon={Icon.Clock}
            />
            <List.Item
              title="Rain Window"
              subtitle={today.rainWindowSummary ?? "No meaningful rain window"}
              icon={Icon.CloudRain}
            />
            <List.Item
              title="Sunrise / Sunset"
              subtitle={`${sunriseLabel} / ${sunsetLabel}`}
              icon={Icon.Sun}
            />
          </List.Section>
          <List.Section title="Freshness">
            <List.Item
              title="Forecast"
              subtitle={forecastFreshnessLabel}
              icon={Icon.Clock}
              actions={
                <ActionPanel>
                  <Action
                    title="Refresh Brief"
                    icon={Icon.ArrowClockwise}
                    onAction={revalidate}
                  />
                  <CommonActions />
                </ActionPanel>
              }
            />
            <List.Item
              title="Air Quality"
              subtitle={aqiFreshnessLabel}
              icon={Icon.Wind}
              actions={
                <ActionPanel>
                  <Action
                    title="Refresh Air Quality"
                    icon={Icon.ArrowClockwise}
                    onAction={revalidateAqi}
                  />
                  <CommonActions />
                </ActionPanel>
              }
            />
            <List.Item
              title="UV"
              subtitle={uvFreshnessLabel}
              icon={Icon.Sun}
              actions={
                <ActionPanel>
                  <Action
                    title="Refresh UV"
                    icon={Icon.ArrowClockwise}
                    onAction={revalidateUv}
                  />
                  <CommonActions />
                </ActionPanel>
              }
            />
          </List.Section>
          <List.Section title="Sources">
            <List.Item
              title="Forecast and Alerts"
              subtitle="met.no Locationforecast and MetAlerts"
              icon={Icon.Cloud}
            />
            <List.Item
              title="Air Quality and UV"
              subtitle="Open-Meteo"
              icon={Icon.Wind}
            />
          </List.Section>
        </>
      ) : (
        <List.EmptyView
          title="No brief yet"
          description="Try refreshing the default location forecast."
        />
      )}
    </List>
  );
}

export default function Command() {
  const { location, isLoading } = useDefaultLocation();

  if (isLoading) {
    return <List isLoading searchBarPlaceholder="Loading weather brief" />;
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

  return <BriefView location={location} />;
}
