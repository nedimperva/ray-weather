import {
  Action,
  ActionPanel,
  Icon,
  List,
  LaunchType,
  launchCommand,
} from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { useEffect } from "react";

import type { Location } from "./types";
import { useLocationSwitcher, useSunEvents, useWeatherData } from "./hooks";
import type { SearchBarDropdown } from "./hooks";
import { getPrefs } from "./preferences";
import { AlertBadge, CommonActions, ShouldIActions } from "./components";
import { iconForSymbol } from "./utils/icons";
import {
  colorForAqi,
  colorForPrecipitation,
  colorForProbability,
  colorForTemperature,
  colorForUV,
  colorForWind,
  comfortColor,
} from "./utils/colors";
import {
  buildComfortScore,
  buildDecisionTags,
  buildPersonalitySummary,
  formatIsoTimeInTimezone,
  getCurrentHour,
  locationSummary,
} from "./utils";
import { formatTemperature, formatTemperatureRange } from "./utils/temperature";
import { formatPrecipitation, formatWindSpeed } from "./utils/units";

function BriefView(props: {
  location: Location;
  dropdown?: SearchBarDropdown;
}) {
  const { location, dropdown } = props;
  const prefs = getPrefs();
  const {
    today,
    alerts,
    alertCountForDate,
    currentAqi,
    error,
    isLoading,
    isUsingFallback,
    isStale,
    cacheUpdatedAt,
    forecastUpdatedAt,
    aqiUsingFallback,
    aqiCacheUpdatedAt,
    revalidate,
    revalidateAqi,
  } = useWeatherData(location);

  const currentHour = today ? getCurrentHour(today) : undefined;
  const shouldLoadSunEvents = today?.dateKey !== undefined;
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

  const todayAlertCount = today ? alertCountForDate(today.dateKey) : 0;
  const currentUv = currentHour?.uvIndex;
  const comfortScore = today
    ? buildComfortScore(today, currentUv, currentAqi, todayAlertCount)
    : undefined;
  const decisionTags = today
    ? buildDecisionTags(today, currentUv, todayAlertCount)
    : [];
  const updatedLabel = formatIsoTimeInTimezone(
    forecastUpdatedAt,
    location.timezone,
  );
  const forecastFreshnessLabel = isUsingFallback
    ? `Cached fetch ${formatIsoTimeInTimezone(cacheUpdatedAt, location.timezone)}${
        isStale ? " (stale)" : ""
      }`
    : `Forecast ${updatedLabel}`;
  const aqiFreshnessLabel = aqiUsingFallback
    ? `Cached fetch ${formatIsoTimeInTimezone(
        aqiCacheUpdatedAt,
        location.timezone,
      )}`
    : "Live sample";
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
      isLoading={isLoading || (shouldLoadSunEvents && isSunLoading)}
      searchBarPlaceholder={`Weather brief for ${location.name}`}
      searchBarAccessory={dropdown}
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
                          color: comfortColor(comfortScore),
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
                ...(currentHour.precipitationProbabilityPct !== undefined
                  ? [
                      {
                        tag: {
                          value: `${Math.round(
                            currentHour.precipitationProbabilityPct,
                          )}%`,
                          color: colorForProbability(
                            currentHour.precipitationProbabilityPct,
                          ),
                        },
                      },
                    ]
                  : []),
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
                ...(currentUv !== undefined && currentUv >= 0.5
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
                    alertCount={todayAlertCount}
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
                    alertCount={todayAlertCount}
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
          </List.Section>
          <List.Section title="Sources">
            <List.Item
              title="Forecast, UV, and Alerts"
              subtitle="met.no Locationforecast and MetAlerts"
              icon={Icon.Cloud}
            />
            <List.Item
              title="Air Quality"
              subtitle="Open-Meteo"
              icon={Icon.Wind}
            />
          </List.Section>
        </>
      ) : (
        <List.Section title="Weather Brief">
          <List.Item
            title={isLoading ? "Loading forecast" : "No forecast data"}
            subtitle={
              error
                ? "Refresh failed. Cached data was not available for this location."
                : `Default location: ${locationSummary(location)}`
            }
            icon={isLoading ? Icon.Clock : Icon.Cloud}
            actions={
              <ActionPanel>
                <Action
                  title="Refresh Brief"
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

  return <BriefView location={location} dropdown={dropdown} />;
}
