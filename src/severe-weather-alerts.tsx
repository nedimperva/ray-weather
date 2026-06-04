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
  useDefaultLocation,
  useFavoriteLocations,
  useWeatherAlerts,
} from "./hooks";
import { CommonActions } from "./components";
import { locationSummary, parseWeatherAlerts, severityRank } from "./utils";

const severityColors: Record<WeatherAlert["severity"], Color> = {
  extreme: Color.Red,
  severe: Color.Orange,
  moderate: Color.Yellow,
  minor: Color.Green,
  unknown: Color.SecondaryText,
};

function severityLabel(severity: WeatherAlert["severity"]): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function useLocationAlerts(location: Location) {
  const { data, error, isLoading, revalidate } = useWeatherAlerts(location);

  useEffect(() => {
    if (error) {
      void showFailureToast(error, {
        title: `Failed to load alerts for ${location.name}`,
      });
    }
  }, [error, location.name]);

  const alerts = useMemo(() => {
    return parseWeatherAlerts(data).sort(
      (a, b) => severityRank(b.severity) - severityRank(a.severity),
    );
  }, [data]);

  return { alerts, isLoading, revalidate };
}

function AlertLocationSection(props: {
  location: Location;
  title?: string;
  showClearState?: boolean;
}) {
  const { location, title, showClearState = true } = props;
  const { alerts, isLoading, revalidate } = useLocationAlerts(location);
  const copyText =
    alerts.length > 0
      ? `${locationSummary(location)} alerts: ${alerts
          .map((alert) => `${severityLabel(alert.severity)} ${alert.event}`)
          .join(", ")}`
      : `${locationSummary(location)}: no active weather alerts`;

  if (alerts.length === 0 && !showClearState) return null;

  return (
    <List.Section
      title={title ?? locationSummary(location)}
      subtitle={alerts.length > 0 ? `${alerts.length} active` : "Clear"}
    >
      {alerts.length > 0 ? (
        alerts.map((alert, index) => (
          <List.Item
            key={`${location.id}-${alert.event}-${index}`}
            title={alert.event}
            subtitle={alert.headline || alert.description || alert.area}
            icon={{
              source: Icon.Warning,
              tintColor: severityColors[alert.severity],
            }}
            accessories={[
              {
                tag: {
                  value: severityLabel(alert.severity),
                  color: severityColors[alert.severity],
                },
              },
              ...(alert.area ? [{ text: alert.area }] : []),
            ]}
            actions={
              <ActionPanel>
                <Action.CopyToClipboard
                  title="Copy Alert"
                  content={`${locationSummary(location)}: ${severityLabel(
                    alert.severity,
                  )} ${alert.event}. ${alert.headline || alert.description}`}
                />
                <Action.CopyToClipboard
                  title="Copy Location Alerts"
                  content={copyText}
                />
                <Action
                  title="Refresh Alerts"
                  icon={Icon.ArrowClockwise}
                  onAction={revalidate}
                />
                <CommonActions />
              </ActionPanel>
            }
          />
        ))
      ) : (
        <List.Item
          title="No active alerts"
          subtitle={
            isLoading ? "Checking alerts..." : locationSummary(location)
          }
          icon={{ source: Icon.CheckCircle, tintColor: Color.Green }}
          actions={
            <ActionPanel>
              <Action
                title="Refresh Alerts"
                icon={Icon.ArrowClockwise}
                onAction={revalidate}
              />
              <CommonActions />
            </ActionPanel>
          }
        />
      )}
    </List.Section>
  );
}

function FavoriteAlertSummary(props: { location: Location }) {
  const { location } = props;
  const { alerts, isLoading, revalidate } = useLocationAlerts(location);
  const highestSeverity = alerts[0]?.severity;

  return (
    <List.Item
      title={location.name}
      subtitle={
        alerts.length > 0
          ? `${alerts.length} active - ${alerts[0]?.event ?? "Weather alert"}`
          : isLoading
            ? "Checking alerts..."
            : "No active alerts"
      }
      icon={{
        source: alerts.length > 0 ? Icon.Warning : Icon.CheckCircle,
        tintColor: highestSeverity
          ? severityColors[highestSeverity]
          : Color.Green,
      }}
      accessories={[
        ...(alerts.length > 0 && highestSeverity
          ? [
              {
                tag: {
                  value: severityLabel(highestSeverity),
                  color: severityColors[highestSeverity],
                },
              },
            ]
          : []),
      ]}
      actions={
        <ActionPanel>
          <Action.Push
            title="Open Location Alerts"
            icon={Icon.Warning}
            target={
              <List searchBarPlaceholder={`Alerts for ${location.name}`}>
                <AlertLocationSection
                  location={location}
                  title={locationSummary(location)}
                />
              </List>
            }
          />
          <Action
            title="Refresh Alerts"
            icon={Icon.ArrowClockwise}
            onAction={revalidate}
          />
          <CommonActions />
        </ActionPanel>
      }
    />
  );
}

export default function Command() {
  const { location, isLoading: isDefaultLoading } = useDefaultLocation();
  const { favorites } = useFavoriteLocations();
  const favoriteLocations = location
    ? favorites.filter((favorite) => favorite.id !== location.id)
    : favorites;

  if (isDefaultLoading) {
    return <List isLoading searchBarPlaceholder="Loading weather alerts" />;
  }

  if (!location && favoriteLocations.length === 0) {
    return (
      <List>
        <List.EmptyView
          title="No locations to check"
          description="Pin a location from Search Weather or add favorites."
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

  return (
    <List searchBarPlaceholder="Weather alerts">
      {location ? (
        <AlertLocationSection
          location={location}
          title={`Default - ${locationSummary(location)}`}
        />
      ) : null}
      {favoriteLocations.length > 0 ? (
        <List.Section title="Favorite Locations">
          {favoriteLocations.map((favorite) => (
            <FavoriteAlertSummary key={favorite.id} location={favorite} />
          ))}
        </List.Section>
      ) : null}
      <List.Section title="Sources">
        <List.Item
          title="Weather Alerts"
          subtitle="met.no MetAlerts"
          icon={Icon.Warning}
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
