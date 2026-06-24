import {
  Action,
  ActionPanel,
  Icon,
  List,
  LocalStorage,
  showToast,
  Toast,
} from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { useEffect } from "react";
import type { Location } from "../types";
import { MENU_BAR_LOCATION_KEY } from "../constants";
import { getPrefs } from "../preferences";
import { useWeatherData } from "../hooks";
import type { useFavoriteLocations } from "../hooks/useFavoriteLocations";
import type { useSearchHistory } from "../hooks/useSearchHistory";
import { iconForSymbol } from "../utils/icons";
import { colorForTemperature, comfortColor } from "../utils/colors";
import {
  formatTemperature,
  formatTemperatureRange,
} from "../utils/temperature";
import { formatWindSpeed, formatPrecipitation } from "../utils/units";
import {
  buildComfortScore,
  buildDecisionTags,
  buildPersonalitySummary,
  buildTrendSummary,
  formatIsoTimeInTimezone,
  getCurrentHour,
  locationSummary,
} from "../utils";
import { AlertBadge } from "./AlertBadge";
import { AirQualityView } from "./AirQualityView";
import { DayDetailsView } from "./DayDetailsView";
import { CommonActions } from "./CommonActions";
import { ShouldIActions } from "./ShouldIActions";

export function ForecastView(props: {
  location: Location;
  addFavorite: ReturnType<typeof useFavoriteLocations>["addFavorite"];
  removeFavorite: ReturnType<typeof useFavoriteLocations>["removeFavorite"];
  isFavorite: ReturnType<typeof useFavoriteLocations>["isFavorite"];
  addToHistory: ReturnType<typeof useSearchHistory>["addToHistory"];
}) {
  const { location, addFavorite, removeFavorite, isFavorite, addToHistory } =
    props;
  const prefs = getPrefs();
  const {
    days,
    alerts,
    alertCountForDate,
    currentAqi,
    aqiForDate,
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

  useEffect(() => {
    if (error) {
      void showFailureToast(error, { title: "Failed to load forecast" });
    }
  }, [error]);

  useEffect(() => {
    addToHistory(location);
  }, [location.id, addToHistory]);

  const currentDay = days[0];
  const currentHour = currentDay ? getCurrentHour(currentDay) : undefined;
  const currentUv = currentHour?.uvIndex;
  const todayAlertCount = currentDay
    ? alertCountForDate(currentDay.dateKey)
    : alerts.length;
  const currentComfort =
    currentDay !== undefined
      ? buildComfortScore(currentDay, currentUv, currentAqi, todayAlertCount)
      : undefined;
  const currentDecisionTags = currentDay
    ? buildDecisionTags(currentDay, currentUv, todayAlertCount)
    : [];
  const currentPrimaryTag =
    currentDecisionTags.find((tag) => !tag.value.startsWith("Rain after ")) ??
    currentDecisionTags[0];
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
  const nowDetailParts =
    currentDay && currentHour
      ? [
          buildPersonalitySummary(currentDay, currentUv),
          `feels like ${formatTemperature(
            currentHour.feelsLikeC,
            prefs.temperatureUnit,
          )}`,
          `rain ${formatPrecipitation(
            currentHour.precipitationMm,
            prefs.precipitationUnit,
          )}`,
          currentHour.precipitationProbabilityPct !== undefined
            ? `${Math.round(currentHour.precipitationProbabilityPct)}% chance`
            : undefined,
          currentHour.windSpeedMs !== undefined
            ? `wind ${formatWindSpeed(
                currentHour.windSpeedMs,
                prefs.windSpeedUnit,
              )}`
            : undefined,
          currentHour.humidityPct !== undefined
            ? `${Math.round(currentHour.humidityPct)}% humidity`
            : undefined,
          currentAqi !== undefined ? `AQI ${currentAqi}` : undefined,
          currentUv !== undefined && currentUv >= 0.5
            ? `UV ${currentUv.toFixed(0)}`
            : undefined,
          todayAlertCount > 0
            ? todayAlertCount === 1
              ? "1 alert"
              : `${todayAlertCount} alerts`
            : undefined,
          `updated ${updatedLabel}`,
        ].filter(Boolean)
      : [];

  const favoriteAction = isFavorite(location.id) ? (
    <Action
      title="Remove from Favorites"
      icon={Icon.StarDisabled}
      onAction={() => removeFavorite(location.id)}
    />
  ) : (
    <Action
      title="Add to Favorites"
      icon={Icon.Star}
      onAction={() => addFavorite(location)}
    />
  );

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder={`Forecast for ${location.name}`}
    >
      {currentDay && currentHour ? (
        <List.Section title="Now">
          <List.Item
            title={`${formatTemperature(
              currentHour.temperatureC,
              prefs.temperatureUnit,
            )} - ${currentHour.condition}`}
            subtitle={nowDetailParts.join(" - ")}
            icon={{
              source: iconForSymbol(currentHour.symbolCode),
              tintColor: colorForTemperature(currentHour.temperatureC),
            }}
            accessories={[
              ...(currentComfort !== undefined
                ? [
                    {
                      tag: {
                        value: `Comfort ${currentComfort}`,
                        color: comfortColor(currentComfort),
                      },
                    },
                  ]
                : []),
              ...(currentPrimaryTag ? [{ tag: currentPrimaryTag }] : []),
            ]}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Air Quality"
                  icon={Icon.Wind}
                  target={<AirQualityView location={location} />}
                />
                <Action
                  title="Refresh Forecast"
                  icon={Icon.ArrowClockwise}
                  onAction={revalidate}
                />
                <ShouldIActions
                  day={currentDay}
                  maxUvIndex={currentUv}
                  aqi={currentAqi}
                  alertCount={todayAlertCount}
                />
                {favoriteAction}
                <CommonActions />
              </ActionPanel>
            }
          />
        </List.Section>
      ) : null}
      {alerts.length > 0 && <AlertBadge alerts={alerts} />}
      {currentDay ? (
        <List.Section title="Data Freshness">
          <List.Item
            title="Forecast"
            subtitle={forecastFreshnessLabel}
            icon={Icon.Clock}
            actions={
              <ActionPanel>
                <Action
                  title="Refresh Forecast"
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
      ) : null}
      <List.Section title="Quick Actions">
        <List.Item
          title="View Air Quality"
          icon={Icon.Wind}
          actions={
            <ActionPanel>
              <Action.Push
                title="Air Quality"
                target={<AirQualityView location={location} />}
              />
              {favoriteAction}
              <CommonActions />
            </ActionPanel>
          }
        />
      </List.Section>
      {days.length === 0 ? (
        <List.EmptyView
          title="No forecast yet"
          description="Try refreshing the weather data."
        />
      ) : (
        <List.Section
          title={locationSummary(location)}
          subtitle={`${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`}
        >
          {days.map((day, index) => {
            const maxUvIndex = day.maxUvIndex;
            const dayAqi = aqiForDate(day.dateKey);
            const dayAlertCount = alertCountForDate(day.dateKey);
            const trendSummary = buildTrendSummary(
              day,
              days[index - 1],
              days[index + 1],
            );
            const personalitySummary = buildPersonalitySummary(day, maxUvIndex);
            const comfortScore = buildComfortScore(
              day,
              maxUvIndex,
              dayAqi,
              dayAlertCount,
            );
            const decisionTags = buildDecisionTags(
              day,
              maxUvIndex,
              dayAlertCount,
            );
            const primaryDecisionTag =
              decisionTags.find(
                (tag) => !tag.value.startsWith("Rain after "),
              ) ?? decisionTags[0];
            const temperatureRange = formatTemperatureRange(
              day.minTempC,
              day.maxTempC,
              prefs.temperatureUnit,
            );
            const detailParts = [
              personalitySummary,
              trendSummary,
              day.rainWindowSummary,
              `rain ${formatPrecipitation(
                day.precipitationMm,
                prefs.precipitationUnit,
              )}`,
              day.avgWindSpeedMs !== undefined
                ? `wind ${formatWindSpeed(
                    day.avgWindSpeedMs,
                    prefs.windSpeedUnit,
                  )}`
                : undefined,
              maxUvIndex !== undefined && maxUvIndex >= 0.5
                ? `UV ${maxUvIndex.toFixed(0)}`
                : undefined,
              dayAqi !== undefined ? `AQI ${dayAqi}` : undefined,
              dayAlertCount > 0
                ? dayAlertCount === 1
                  ? "1 alert"
                  : `${dayAlertCount} alerts`
                : undefined,
            ].filter(Boolean);
            const copyLine = `${locationSummary(location)} - ${day.dayAndDate}: ${day.condition}, ${formatTemperatureRange(
              day.minTempC,
              day.maxTempC,
              prefs.temperatureUnit,
            )}, ${formatPrecipitation(day.precipitationMm, prefs.precipitationUnit)} precipitation`;

            const dayAccessories = [
              {
                tag: {
                  value: `Comfort ${comfortScore}`,
                  color: comfortColor(comfortScore),
                },
              },
              ...(primaryDecisionTag ? [{ tag: primaryDecisionTag }] : []),
            ];

            return (
              <List.Item
                key={day.dateKey}
                icon={{
                  source: iconForSymbol(day.symbolCode),
                  tintColor: colorForTemperature(day.maxTempC),
                }}
                title={`${day.label} (${day.shortDate}) - ${temperatureRange}`}
                subtitle={detailParts.join(" - ")}
                accessories={dayAccessories}
                actions={
                  <ActionPanel>
                    <Action.Push
                      title="Open Day Details"
                      icon={Icon.List}
                      target={
                        <DayDetailsView
                          location={location}
                          day={day}
                          alerts={alerts}
                        />
                      }
                    />
                    <Action.CopyToClipboard
                      title="Copy Forecast Line"
                      content={copyLine}
                    />
                    <Action
                      title="Refresh Forecast"
                      icon={Icon.ArrowClockwise}
                      onAction={revalidate}
                    />
                    <ShouldIActions
                      day={day}
                      maxUvIndex={maxUvIndex}
                      aqi={dayAqi}
                      alertCount={dayAlertCount}
                    />
                    {favoriteAction}
                    <Action
                      title="Set as Menu Bar Location"
                      icon={Icon.Pin}
                      onAction={() => {
                        void LocalStorage.setItem(
                          MENU_BAR_LOCATION_KEY,
                          JSON.stringify(location),
                        );
                        void showToast({
                          style: Toast.Style.Success,
                          title: `${location.name} pinned to menu bar`,
                        });
                      }}
                    />
                    <CommonActions />
                  </ActionPanel>
                }
              />
            );
          })}
        </List.Section>
      )}
    </List>
  );
}
