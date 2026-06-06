import type { WeatherAlert } from "../types";
import { dateKeyInTimezone } from "./dates";

export type WeatherAlertsPayload = {
  features?: Array<{
    when?: {
      interval?: string[];
    };
    properties?: {
      event?: string;
      headline?: string;
      description?: string;
      severity?: string;
      area?: string;
      onset?: string;
      expires?: string;
    };
  }>;
};

export function parseWeatherAlerts(
  alertsData: WeatherAlertsPayload | undefined,
): WeatherAlert[] {
  const result: WeatherAlert[] = [];
  const features = alertsData?.features ?? [];

  for (const feature of features) {
    const properties = feature.properties;
    if (!properties?.event) continue;

    const interval = feature.when?.interval;
    result.push({
      area: properties.area ?? "",
      event: properties.event,
      headline: properties.headline ?? "",
      description: properties.description ?? "",
      severity:
        (properties.severity?.toLowerCase() as WeatherAlert["severity"]) ??
        "unknown",
      onsetISO: properties.onset ?? interval?.[0],
      expiresISO: properties.expires ?? interval?.[1],
    });
  }

  return result;
}

export function severityRank(severity: WeatherAlert["severity"]): number {
  switch (severity) {
    case "extreme":
      return 5;
    case "severe":
      return 4;
    case "moderate":
      return 3;
    case "minor":
      return 2;
    case "unknown":
    default:
      return 1;
  }
}

const FAR_FUTURE_DATE_KEY = "9999-12-31";

// Active alerts describe a window in time. Applying every active alert to every
// forecast day (today through day 10) over-penalizes the distant forecast, so we
// map each alert to the local dates it actually covers. Alerts without timing
// information are treated as covering today only.
export function alertCoversDate(
  alert: WeatherAlert,
  dateKey: string,
  timeZone: string,
): boolean {
  const todayKey = dateKeyInTimezone(new Date(), timeZone);
  const onsetKey = isoToDateKey(alert.onsetISO, timeZone);
  const expiresKey = isoToDateKey(alert.expiresISO, timeZone);

  const startKey = onsetKey ?? todayKey;
  const endKey = expiresKey ?? (onsetKey ? FAR_FUTURE_DATE_KEY : todayKey);

  return dateKey >= startKey && dateKey <= endKey;
}

export function alertCountForDate(
  alerts: WeatherAlert[],
  dateKey: string,
  timeZone: string,
): number {
  return alerts.filter((alert) => alertCoversDate(alert, dateKey, timeZone))
    .length;
}

function isoToDateKey(
  iso: string | undefined,
  timeZone: string,
): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return dateKeyInTimezone(date, timeZone);
}
