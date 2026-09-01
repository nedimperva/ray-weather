import {
  Color,
  Icon,
  LaunchType,
  LocalStorage,
  Toast,
  environment,
  showToast,
  updateCommandMetadata,
} from "@raycast/api";

import {
  APP_USER_AGENT,
  MET_NO_ALERTS_API,
  MET_NO_FORECAST_API,
  WATCH_SEEN_KEY,
} from "./constants";
import { getPrefs } from "./preferences";
import type { Location, MetNoForecastResponse } from "./types";
import { parseWeatherAlerts, type WeatherAlertsPayload } from "./utils/alerts";
import { readDefaultLocation } from "./utils/defaultLocation";
import { displayLocationName } from "./utils/formatting";
import {
  canSendDesktopNotifications,
  sendDesktopNotification,
} from "./utils/hostApi";
import { writeStatusFile } from "./utils/statusFile";
import {
  buildWatchReport,
  type SeenRecord,
  type WatchNotification,
} from "./utils/weatherWatch";

const REQUEST_TIMEOUT_MS = 15_000;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "User-Agent": APP_USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

async function readSeen(): Promise<SeenRecord[]> {
  const raw = await LocalStorage.getItem<string>(WATCH_SEEN_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as SeenRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function notificationIcon(notification: WatchNotification) {
  if (notification.kind === "alert") {
    return {
      source: Icon.Warning,
      tintColor: notification.urgency === "High" ? Color.Red : Color.Orange,
    };
  }

  return { source: Icon.CloudRain, tintColor: Color.Blue };
}

/**
 * Vicinae can push a real desktop notification. Raycast has no notification API
 * at all, so there the command falls back to the command subtitle in the root
 * search (already updated by the caller) plus a toast when the user ran it by
 * hand.
 */
async function deliver(
  notifications: WatchNotification[],
  isBackground: boolean,
): Promise<number> {
  if (notifications.length === 0) return 0;

  if (canSendDesktopNotifications()) {
    let delivered = 0;
    for (const notification of notifications) {
      const sent = await sendDesktopNotification({
        title: notification.title,
        body: notification.body,
        urgency: notification.urgency,
        icon: notificationIcon(notification),
      });
      if (sent) delivered += 1;
    }
    return delivered;
  }

  if (!isBackground) {
    const [first] = notifications;
    await showToast({
      style:
        first.urgency === "High" ? Toast.Style.Failure : Toast.Style.Success,
      title: first.title,
      message: first.body,
    });
  }

  return 0;
}

async function summarize(
  location: Location | null,
  statusText: string,
  alertCount: number,
): Promise<void> {
  if (!location) {
    await updateCommandMetadata({ subtitle: "No location pinned" });
    return;
  }

  const parts = [displayLocationName(location), statusText].filter(Boolean);
  if (alertCount > 0) {
    parts.push(`${alertCount} alert${alertCount === 1 ? "" : "s"}`);
  }

  await updateCommandMetadata({ subtitle: parts.join(" · ") });
}

export default async function WeatherWatch() {
  const isBackground = environment.launchType === LaunchType.Background;
  const location = await readDefaultLocation();

  if (!location) {
    await summarize(null, "", 0);
    if (!isBackground) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No location to watch",
        message: "Pin a location from Search Weather first.",
      });
    }
    return;
  }

  const prefs = getPrefs();
  const coordinates = `lat=${location.latitude.toFixed(4)}&lon=${location.longitude.toFixed(4)}`;

  let forecast: MetNoForecastResponse;
  try {
    forecast = await fetchJson<MetNoForecastResponse>(
      `${MET_NO_FORECAST_API}?${coordinates}`,
    );
  } catch (error) {
    if (!isBackground) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Could not refresh weather",
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  // Alerts are supplementary: a met.no outage on that endpoint should not stop
  // the status file from being refreshed.
  let alertsPayload: WeatherAlertsPayload | undefined;
  try {
    alertsPayload = await fetchJson<WeatherAlertsPayload>(
      `${MET_NO_ALERTS_API}?${coordinates}`,
    );
  } catch {
    alertsPayload = undefined;
  }

  const report = buildWatchReport({
    now: new Date(),
    location,
    timeseries: forecast.properties?.timeseries ?? [],
    alerts: parseWeatherAlerts(alertsPayload),
    forecastUpdatedAt: forecast.properties?.meta?.updated_at,
    seen: await readSeen(),
    alertNotifications: prefs.alertNotifications,
    rainNotifications: prefs.rainNotifications,
    units: {
      temperatureUnit: prefs.temperatureUnit,
      windSpeedUnit: prefs.windSpeedUnit,
      precipitationUnit: prefs.precipitationUnit,
      displayMode: prefs.menuBarDisplayMode,
    },
  });

  // A read-only or missing state directory should not cost the user their
  // alert notification, so the status file is best-effort.
  try {
    await writeStatusFile(report.snapshot);
  } catch (error) {
    console.error("Could not write the status file", error);
  }

  await LocalStorage.setItem(WATCH_SEEN_KEY, JSON.stringify(report.seen));
  await summarize(
    location,
    report.snapshot.text,
    report.snapshot.alerts.length,
  );

  // `deliver` already surfaces anything new, so only the quiet case is left.
  await deliver(report.notifications, isBackground);

  if (!isBackground && report.notifications.length === 0) {
    await showToast({
      style: Toast.Style.Success,
      title: "Weather checked",
      message:
        report.snapshot.alerts.length > 0
          ? `${report.snapshot.alerts.length} active alert(s), already notified.`
          : "Nothing new to report.",
    });
  }
}
