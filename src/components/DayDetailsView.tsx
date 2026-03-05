import { ActionPanel, Icon, List } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { useEffect } from "react";
import type { Location, DailyForecast, WeatherAlert } from "../types";
import { getPrefs, getForecastDays } from "../preferences";
import { useSunEvents, useUVIndex } from "../hooks";
import { iconForSymbol } from "../utils/icons";
import { colorForTemperature, colorForUV } from "../utils/colors";
import {
  formatTemperature,
  formatTemperatureRange,
} from "../utils/temperature";
import { formatWindSpeed, formatPrecipitation } from "../utils/units";
import { formatIsoTimeInTimezone, locationSummary } from "../utils";
import { AlertBadge } from "./AlertBadge";
import { CommonActions } from "./CommonActions";

export function DayDetailsView(props: {
  location: Location;
  day: DailyForecast;
  alerts: WeatherAlert[];
}) {
  const { location, day, alerts } = props;
  const prefs = getPrefs();
  const {
    data: sunData,
    error: sunError,
    isLoading: isSunLoading,
  } = useSunEvents(location, day.dateKey);

  const forecastDays = getForecastDays();
  const { data: uvData } = useUVIndex(location, forecastDays);

  useEffect(() => {
    if (sunError) {
      void showFailureToast(sunError, { title: "Failed to load sun events" });
    }
  }, [sunError]);

  const sunriseLabel = formatIsoTimeInTimezone(
    sunData?.properties?.sunrise?.time,
    location.timezone,
  );
  const sunsetLabel = formatIsoTimeInTimezone(
    sunData?.properties?.sunset?.time,
    location.timezone,
  );

  // Merge UV data into hourly forecasts
  const uvByHour = new Map<string, number>();
  if (uvData?.hourly?.time && uvData?.hourly?.uv_index) {
    for (let i = 0; i < uvData.hourly.time.length; i++) {
      const time = uvData.hourly.time[i];
      const uv = uvData.hourly.uv_index[i];
      if (time && uv !== undefined) {
        const dateKey = time.slice(0, 10);
        if (dateKey === day.dateKey) {
          const hour = parseInt(time.slice(11, 13), 10);
          uvByHour.set(hour.toString(), uv);
        }
      }
    }
  }

  const pressureTrendIcon =
    day.pressureTrend === "rising"
      ? "↑"
      : day.pressureTrend === "falling"
        ? "↓"
        : "→";

  return (
    <List
      isLoading={isSunLoading}
      searchBarPlaceholder={`${day.label} details`}
    >
      {alerts.length > 0 && <AlertBadge alerts={alerts} />}
      <List.Section title={`${locationSummary(location)} - ${day.dayAndDate}`}>
        <List.Item
          title="Summary"
          subtitle={day.condition}
          icon={{
            source: iconForSymbol(day.symbolCode),
            tintColor: colorForTemperature(day.maxTempC),
          }}
          accessories={[
            {
              text: formatTemperatureRange(
                day.minTempC,
                day.maxTempC,
                prefs.temperatureUnit,
              ),
            },
            {
              text: formatPrecipitation(
                day.precipitationMm,
                prefs.precipitationUnit,
              ),
            },
          ]}
          actions={
            <ActionPanel>
              <CommonActions />
            </ActionPanel>
          }
        />
        <List.Item
          title="Feels Like Range"
          subtitle={formatTemperatureRange(
            day.minFeelsLikeC,
            day.maxFeelsLikeC,
            prefs.temperatureUnit,
          )}
          icon={Icon.Info}
          actions={
            <ActionPanel>
              <CommonActions />
            </ActionPanel>
          }
        />
        <List.Item
          title="Sunrise / Sunset"
          subtitle={`${sunriseLabel} / ${sunsetLabel}`}
          icon={Icon.Sun}
          actions={
            <ActionPanel>
              <CommonActions />
            </ActionPanel>
          }
        />
        <List.Item
          title="Average Wind"
          subtitle={formatWindSpeed(day.avgWindSpeedMs, prefs.windSpeedUnit)}
          icon={Icon.Wind}
          actions={
            <ActionPanel>
              <CommonActions />
            </ActionPanel>
          }
        />
        <List.Item
          title="Average Humidity"
          subtitle={
            day.avgHumidityPct !== undefined
              ? `${Math.round(day.avgHumidityPct)}%`
              : "No data"
          }
          icon={Icon.Droplets}
          actions={
            <ActionPanel>
              <CommonActions />
            </ActionPanel>
          }
        />
        <List.Item
          title="Pressure"
          subtitle={
            day.avgPressureHpa !== undefined
              ? `${day.avgPressureHpa.toFixed(0)} hPa ${pressureTrendIcon}`
              : "No data"
          }
          icon={Icon.Gauge}
          actions={
            <ActionPanel>
              <CommonActions />
            </ActionPanel>
          }
        />
        <List.Item
          title="Visibility"
          subtitle={
            day.avgVisibilityKm !== undefined
              ? `${day.avgVisibilityKm.toFixed(1)} km`
              : "No data"
          }
          icon={Icon.Eye}
          actions={
            <ActionPanel>
              <CommonActions />
            </ActionPanel>
          }
        />
      </List.Section>
      <List.Section title="Hourly Forecast">
        {day.hourly.map((hour) => {
          const uvIndex = uvByHour.get(hour.hour.toString());
          return (
            <List.Item
              key={hour.id}
              icon={{
                source: iconForSymbol(hour.symbolCode),
                tintColor: colorForTemperature(hour.temperatureC),
              }}
              title={hour.localTimeLabel}
              subtitle={hour.condition}
              accessories={[
                {
                  text: formatTemperature(
                    hour.temperatureC,
                    prefs.temperatureUnit,
                  ),
                },
                {
                  text: formatPrecipitation(
                    hour.precipitationMm,
                    prefs.precipitationUnit,
                  ),
                },
                {
                  text: formatWindSpeed(hour.windSpeedMs, prefs.windSpeedUnit),
                },
                {
                  text:
                    hour.humidityPct !== undefined
                      ? `${Math.round(hour.humidityPct)}%`
                      : "-",
                },
                ...(uvIndex !== undefined && uvIndex > 0
                  ? [
                      {
                        tag: {
                          value: `UV ${uvIndex.toFixed(0)}`,
                          color: colorForUV(uvIndex),
                        },
                      },
                    ]
                  : []),
              ]}
              actions={
                <ActionPanel>
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
