import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { useEffect } from "react";
import type { Location } from "../types";
import { useAirQuality } from "../hooks";
import { colorForAqi } from "../utils/colors";
import { iconForAqi } from "../utils/icons";
import { aqiLabel } from "../utils/formatting";
import { formatIsoTimeInTimezone, formatUnixTimeInTimezone } from "../utils";
import { CommonActions } from "./CommonActions";

export function AirQualityView(props: { location: Location }) {
  const { location } = props;
  const {
    data,
    error,
    isLoading,
    isUsingFallback,
    cacheUpdatedAt,
    revalidate,
  } = useAirQuality(location);

  useEffect(() => {
    if (error) {
      void showFailureToast(error, { title: "Failed to load air quality" });
    }
  }, [error]);

  const hourly = data?.hourly;
  const getCurrentValue = <T,>(arr: T[] | undefined): T | undefined => {
    if (!arr || arr.length === 0) return undefined;
    return arr.find((v) => v !== undefined) ?? arr[0];
  };

  const aqi = getCurrentValue(hourly?.us_aqi);
  const pm25 = getCurrentValue(hourly?.pm2_5);
  const pm10 = getCurrentValue(hourly?.pm10);
  const o3 = getCurrentValue(hourly?.ozone);
  const no2 = getCurrentValue(hourly?.nitrogen_dioxide);
  const co = getCurrentValue(hourly?.carbon_monoxide);
  const updatedAt = getCurrentValue(hourly?.time);
  const microgramUnit = "µg/m³";

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder={`Air Quality for ${location.name}`}
    >
      <List.Section title="Air Quality Index">
        <List.Item
          title={
            isUsingFallback ? "Using cached air quality" : "Data freshness"
          }
          subtitle={
            isUsingFallback
              ? `Last successful fetch ${formatIsoTimeInTimezone(
                  cacheUpdatedAt,
                  location.timezone,
                )}`
              : `AQI sample ${formatUnixTimeInTimezone(
                  updatedAt,
                  location.timezone,
                )}`
          }
          icon={Icon.Clock}
          actions={
            <ActionPanel>
              <Action
                title="Refresh Air Quality"
                icon={Icon.ArrowClockwise}
                onAction={revalidate}
              />
              <CommonActions />
            </ActionPanel>
          }
        />
        <List.Item
          title="AQI"
          subtitle={aqi !== undefined ? `${aqi} - ${aqiLabel(aqi)}` : "No data"}
          icon={{
            source: iconForAqi(aqi ?? 0),
            tintColor: aqi !== undefined ? colorForAqi(aqi) : undefined,
          }}
          accessories={aqi !== undefined ? [{ text: aqi.toString() }] : []}
          actions={
            <ActionPanel>
              <CommonActions />
            </ActionPanel>
          }
        />
        <List.Item
          title="PM2.5"
          subtitle={
            pm25 !== undefined
              ? `${pm25.toFixed(1)} ${microgramUnit}`
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
          title="PM10"
          subtitle={
            pm10 !== undefined
              ? `${pm10.toFixed(1)} ${microgramUnit}`
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
          title="Ozone"
          subtitle={
            o3 !== undefined ? `${o3.toFixed(1)} ${microgramUnit}` : "No data"
          }
          icon={Icon.Sun}
          actions={
            <ActionPanel>
              <CommonActions />
            </ActionPanel>
          }
        />
        <List.Item
          title="NO₂"
          subtitle={
            no2 !== undefined ? `${no2.toFixed(1)} ${microgramUnit}` : "No data"
          }
          icon={Icon.Wind}
          actions={
            <ActionPanel>
              <CommonActions />
            </ActionPanel>
          }
        />
        <List.Item
          title="CO"
          subtitle={
            co !== undefined ? `${co.toFixed(1)} ${microgramUnit}` : "No data"
          }
          icon={Icon.Wind}
          actions={
            <ActionPanel>
              <CommonActions />
            </ActionPanel>
          }
        />
      </List.Section>
    </List>
  );
}
