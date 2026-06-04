import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  LocalStorage,
  showToast,
  Toast,
} from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { useEffect, useMemo } from "react";
import type { Location, WeatherAlert } from "../types";
import { MENU_BAR_LOCATION_KEY } from "../constants";
import { getPrefs, getForecastDays } from "../preferences";
import {
  useAirQuality,
  useForecast,
  useWeatherAlerts,
  useUVIndex,
} from "../hooks";
import type { useFavoriteLocations } from "../hooks/useFavoriteLocations";
import type { useSearchHistory } from "../hooks/useSearchHistory";
import { iconForSymbol } from "../utils/icons";
import {
  colorForTemperature,
  colorForPrecipitation,
  colorForWind,
  colorForUV,
  colorForAqi,
} from "../utils/colors";
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
import { buildDailyForecast } from "../utils/forecast";
import { AlertBadge } from "./AlertBadge";
import { AirQualityView } from "./AirQualityView";
import { DayDetailsView } from "./DayDetailsView";
import { CommonActions } from "./CommonActions";

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
  const forecastDays = getForecastDays();
  const { data, error, isLoading, revalidate } = useForecast(location);

  useEffect(() => {
    if (error) {
      void showFailureToast(error, { title: "Failed to load forecast" });
    }
  }, [error]);

  useEffect(() => {
    addToHistory(location);
  }, [location.id, addToHistory]);

  const { data: alertsData } = useWeatherAlerts(location);
  const { data: uvData } = useUVIndex(location, forecastDays);
  const { data: airQualityData } = useAirQuality(location);

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
  }, [data, location.timezone, forecastDays]);

  const currentAqi = useMemo(() => {
    const values = airQualityData?.hourly?.us_aqi ?? [];
    return values.find((value) => value !== undefined);
  }, [airQualityData]);

  // Build UV max per day
  const uvMaxByDate = useMemo(() => {
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

  const currentDay = dailyForecast[0];
  const currentHour = currentDay ? getCurrentHour(currentDay) : undefined;
  const currentUv =
    currentDay && currentHour
      ? uvByDateHour.get(`${currentDay.dateKey}-${currentHour.hour}`)
      : undefined;
  const currentComfort =
    currentDay !== undefined
      ? buildComfortScore(currentDay, currentUv, currentAqi, alerts.length)
      : undefined;
  const currentComfortColor =
    currentComfort === undefined
      ? Color.SecondaryText
      : currentComfort >= 75
        ? Color.Green
        : currentComfort >= 50
          ? Color.Yellow
          : Color.Red;
  const updatedLabel = formatIsoTimeInTimezone(
    data?.properties?.meta?.updated_at,
    location.timezone,
  );

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
            subtitle={`${buildPersonalitySummary(
              currentDay,
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
              ...(currentComfort !== undefined
                ? [
                    {
                      tag: {
                        value: `Comfort ${currentComfort}`,
                        color: currentComfortColor,
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
              {
                text: formatWindSpeed(
                  currentHour.windSpeedMs,
                  prefs.windSpeedUnit,
                ),
              },
              ...(currentHour.humidityPct !== undefined
                ? [{ text: `${Math.round(currentHour.humidityPct)}% humidity` }]
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
              ...(alerts.length > 0
                ? [
                    {
                      tag: {
                        value:
                          alerts.length === 1
                            ? "1 alert"
                            : `${alerts.length} alerts`,
                        color: Color.Red,
                      },
                    },
                  ]
                : []),
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
                {favoriteAction}
                <CommonActions />
              </ActionPanel>
            }
          />
        </List.Section>
      ) : null}
      {alerts.length > 0 && <AlertBadge alerts={alerts} />}
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
      {dailyForecast.length === 0 ? (
        <List.EmptyView
          title="No forecast yet"
          description="Try refreshing the weather data."
        />
      ) : (
        <List.Section
          title={locationSummary(location)}
          subtitle={`${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`}
        >
          {dailyForecast.map((day, index) => {
            const maxUvIndex = uvMaxByDate.get(day.dateKey);
            const trendSummary = buildTrendSummary(
              day,
              dailyForecast[index - 1],
              dailyForecast[index + 1],
            );
            const personalitySummary = buildPersonalitySummary(day, maxUvIndex);
            const comfortScore = buildComfortScore(
              day,
              maxUvIndex,
              currentAqi,
              alerts.length,
            );
            const comfortColor =
              comfortScore >= 75
                ? Color.Green
                : comfortScore >= 50
                  ? Color.Yellow
                  : Color.Red;
            const decisionTags = buildDecisionTags(
              day,
              maxUvIndex,
              alerts.length,
            );
            const copyLine = `${locationSummary(location)} - ${day.dayAndDate}: ${day.condition}, ${formatTemperatureRange(
              day.minTempC,
              day.maxTempC,
              prefs.temperatureUnit,
            )}, ${formatPrecipitation(day.precipitationMm, prefs.precipitationUnit)} precipitation`;

            const dayAccessories = [
              ...decisionTags.map((tag) => ({ tag })),
              {
                tag: {
                  value: `Comfort ${comfortScore}`,
                  color: comfortColor,
                },
              },
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
              ...(day.avgWindSpeedMs !== undefined
                ? [
                    {
                      tag: {
                        value: formatWindSpeed(
                          day.avgWindSpeedMs,
                          prefs.windSpeedUnit,
                        ),
                        color: colorForWind(day.avgWindSpeedMs),
                      },
                    },
                  ]
                : []),
              ...(maxUvIndex !== undefined && maxUvIndex > 0
                ? [
                    {
                      tag: {
                        value: `UV ${maxUvIndex.toFixed(0)}`,
                        color: colorForUV(maxUvIndex),
                      },
                    },
                  ]
                : []),
            ];

            return (
              <List.Item
                key={day.dateKey}
                icon={{
                  source: iconForSymbol(day.symbolCode),
                  tintColor: colorForTemperature(day.maxTempC),
                }}
                title={`${day.label} (${day.shortDate})`}
                subtitle={[
                  personalitySummary,
                  trendSummary,
                  day.rainWindowSummary,
                ]
                  .filter(Boolean)
                  .join(" - ")}
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
