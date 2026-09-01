import type { ForecastEntry, Location, WeatherAlert } from "../types";
import type {
  AlertNotificationMode,
  MenuBarDisplayMode,
  PrecipitationUnit,
  TemperatureUnit,
  WindSpeedUnit,
} from "../preferences";
import { severityRank } from "./alerts";
import { conditionLabelForSymbol, displayLocationName } from "./formatting";
import { buildStatusText } from "./statusText";
import { calculateFeelsLikeC, formatTemperature } from "./temperature";
import { adjustUvForClouds } from "./uv";
import { formatPrecipitation, formatWindSpeed } from "./units";

export const STATUS_SCHEMA_VERSION = 1;

/** How far ahead a rain notification looks. */
export const RAIN_LOOKAHEAD_MINUTES = 90;

/** Below this, an hour counts as dry. */
export const RAIN_THRESHOLD_MM = 0.1;

/** Notified events are remembered this long so a run does not repeat itself. */
export const SEEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export type { AlertNotificationMode };

export type NotificationUrgency = "Low" | "Normal" | "High";

export type WatchNotification = {
  /** Stable per event, so the same alert or rain window notifies only once. */
  id: string;
  kind: "alert" | "rain";
  title: string;
  body: string;
  urgency: NotificationUrgency;
};

export type SeenRecord = {
  id: string;
  at: string;
};

export type StatusSnapshotAlert = {
  event: string;
  severity: WeatherAlert["severity"];
  headline: string;
  area?: string;
  onsetISO?: string;
  expiresISO?: string;
};

/**
 * Written to disk for status bars to read. `text`, `alt`, `tooltip` and `class`
 * match Waybar's custom-module JSON contract; everything else is there for
 * richer widgets.
 */
export type StatusSnapshot = {
  schema: number;
  updatedAt: string;
  forecastUpdatedAt?: string;
  location: {
    name: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };
  current: {
    temperatureC: number;
    feelsLikeC: number;
    symbolCode: string;
    condition: string;
    windSpeedMs?: number;
    humidityPct?: number;
    precipitationNext1hMm: number;
    precipitationProbabilityNext1hPct?: number;
    uvIndex?: number;
  } | null;
  alerts: StatusSnapshotAlert[];
  rainStartsAtISO?: string;
  text: string;
  alt: string;
  tooltip: string;
  class: string;
};

export type WatchUnits = {
  temperatureUnit: TemperatureUnit;
  windSpeedUnit: WindSpeedUnit;
  precipitationUnit: PrecipitationUnit;
  displayMode: MenuBarDisplayMode;
};

export type WatchInput = {
  now: Date;
  location: Location;
  timeseries: ForecastEntry[];
  alerts: WeatherAlert[];
  forecastUpdatedAt?: string;
  seen: SeenRecord[];
  alertNotifications: AlertNotificationMode;
  rainNotifications: boolean;
  units: WatchUnits;
};

export type WatchReport = {
  notifications: WatchNotification[];
  seen: SeenRecord[];
  snapshot: StatusSnapshot;
};

function urgencyForSeverity(
  severity: WeatherAlert["severity"],
): NotificationUrgency {
  const rank = severityRank(severity);
  if (rank >= 4) return "High";
  if (rank === 3) return "Normal";
  return "Low";
}

/**
 * Severity is part of the key on purpose: when met.no upgrades a warning from
 * moderate to severe it is news again, and the changed key lets it through.
 */
function alertNotificationId(alert: WeatherAlert): string {
  return [
    "alert",
    alert.event.toLowerCase(),
    alert.severity,
    alert.onsetISO ?? "",
  ].join("|");
}

function truncate(value: string, maxLength: number): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength - 1).trimEnd()}…`;
}

function timeLabel(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(11, 16);
  }
}

function precipitationForEntry(entry: ForecastEntry): number {
  return (
    entry.data?.next_1_hours?.details?.precipitation_amount ??
    entry.data?.next_6_hours?.details?.precipitation_amount ??
    0
  );
}

function probabilityForEntry(entry: ForecastEntry): number | undefined {
  return (
    entry.data?.next_1_hours?.details?.probability_of_precipitation ??
    entry.data?.next_6_hours?.details?.probability_of_precipitation
  );
}

function symbolForEntry(entry: ForecastEntry): string {
  return (
    entry.data?.next_1_hours?.summary?.symbol_code ??
    entry.data?.next_6_hours?.summary?.symbol_code ??
    "cloudy"
  );
}

/** The observation closest to, but not after, `now`; falls back to the first. */
function currentEntry(
  timeseries: ForecastEntry[],
  now: Date,
): ForecastEntry | undefined {
  const nowMs = now.getTime();
  let candidate: ForecastEntry | undefined;

  for (const entry of timeseries) {
    const entryMs = new Date(entry.time).getTime();
    if (Number.isNaN(entryMs)) continue;
    if (entryMs <= nowMs) candidate = entry;
    else break;
  }

  return candidate ?? timeseries[0];
}

function findRainStart(
  timeseries: ForecastEntry[],
  now: Date,
): ForecastEntry | undefined {
  const nowMs = now.getTime();
  const horizonMs = nowMs + RAIN_LOOKAHEAD_MINUTES * 60 * 1000;

  return timeseries.find((entry) => {
    const entryMs = new Date(entry.time).getTime();
    if (Number.isNaN(entryMs)) return false;
    if (entryMs <= nowMs || entryMs > horizonMs) return false;
    if (precipitationForEntry(entry) >= RAIN_THRESHOLD_MM) return true;
    return (probabilityForEntry(entry) ?? 0) >= 50;
  });
}

function buildAlertNotifications(
  alerts: WeatherAlert[],
  locationName: string,
  mode: AlertNotificationMode,
): WatchNotification[] {
  if (mode === "off") return [];

  const minimumRank = mode === "severe" ? 4 : 0;

  return alerts
    .filter((alert) => severityRank(alert.severity) >= minimumRank)
    .map((alert) => ({
      id: alertNotificationId(alert),
      kind: "alert" as const,
      title: `${alert.event} · ${locationName}`,
      body: truncate(
        alert.headline || alert.description || "Active weather alert.",
        220,
      ),
      urgency: urgencyForSeverity(alert.severity),
    }));
}

function buildRainNotification(
  rainStart: ForecastEntry | undefined,
  isRainingNow: boolean,
  input: WatchInput,
): WatchNotification | undefined {
  if (!input.rainNotifications || !rainStart || isRainingNow) return undefined;

  const locationName = displayLocationName(input.location);
  const amount = precipitationForEntry(rainStart);
  const probability = probabilityForEntry(rainStart);
  const at = timeLabel(rainStart.time, input.location.timezone);

  const details = [
    amount > 0
      ? formatPrecipitation(amount, input.units.precipitationUnit)
      : undefined,
    probability !== undefined
      ? `${Math.round(probability)}% chance`
      : undefined,
  ].filter(Boolean);

  return {
    id: `rain|${rainStart.time}`,
    kind: "rain",
    title: `Rain around ${at} · ${locationName}`,
    body: [
      conditionLabelForSymbol(symbolForEntry(rainStart)),
      details.join(", "),
    ]
      .filter(Boolean)
      .join(" · "),
    urgency: "Low",
  };
}

function buildTooltip(
  snapshotCurrent: StatusSnapshot["current"],
  alerts: WeatherAlert[],
  input: WatchInput,
): string {
  const locationName = displayLocationName(input.location);
  const lines: string[] = [locationName];

  if (snapshotCurrent) {
    lines.push(
      `${formatTemperature(
        snapshotCurrent.temperatureC,
        input.units.temperatureUnit,
      )} · ${snapshotCurrent.condition}`,
      `Feels like ${formatTemperature(
        snapshotCurrent.feelsLikeC,
        input.units.temperatureUnit,
      )}`,
    );

    if (snapshotCurrent.windSpeedMs !== undefined) {
      lines.push(
        `Wind ${formatWindSpeed(
          snapshotCurrent.windSpeedMs,
          input.units.windSpeedUnit,
        )}`,
      );
    }

    lines.push(
      `Precipitation ${formatPrecipitation(
        snapshotCurrent.precipitationNext1hMm,
        input.units.precipitationUnit,
      )}`,
    );
  } else {
    lines.push("No forecast data");
  }

  for (const alert of alerts) {
    lines.push(`⚠ ${alert.event}${alert.area ? ` (${alert.area})` : ""}`);
  }

  return lines.join("\n");
}

function statusClass(
  alerts: WeatherAlert[],
  isRainingNow: boolean,
  rainStart: ForecastEntry | undefined,
): string {
  const worst = alerts[0];
  if (worst && severityRank(worst.severity) >= 3)
    return `alert-${worst.severity}`;
  if (worst) return "alert";
  if (isRainingNow) return "raining";
  if (rainStart) return "rain-soon";
  return "clear";
}

/**
 * Decides what to notify about and what a status bar should display, from a
 * forecast payload and the events already notified. Pure on purpose: the
 * command around it only does I/O.
 */
export function buildWatchReport(input: WatchInput): WatchReport {
  const nowISO = input.now.toISOString();
  const locationName = displayLocationName(input.location);
  const sortedAlerts = [...input.alerts].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity),
  );

  const entry = currentEntry(input.timeseries, input.now);
  const details = entry?.data?.instant?.details;

  let current: StatusSnapshot["current"] = null;
  if (entry && details) {
    const symbolCode = symbolForEntry(entry);
    current = {
      temperatureC: details.air_temperature,
      feelsLikeC: calculateFeelsLikeC(
        details.air_temperature,
        details.wind_speed,
        details.relative_humidity,
      ),
      symbolCode,
      condition: conditionLabelForSymbol(symbolCode),
      windSpeedMs: details.wind_speed,
      humidityPct: details.relative_humidity,
      precipitationNext1hMm: precipitationForEntry(entry),
      precipitationProbabilityNext1hPct: probabilityForEntry(entry),
      uvIndex: adjustUvForClouds(
        details.ultraviolet_index_clear_sky,
        details.cloud_area_fraction,
      ),
    };
  }

  const isRainingNow =
    (current?.precipitationNext1hMm ?? 0) >= RAIN_THRESHOLD_MM;
  const rainStart = findRainStart(input.timeseries, input.now);

  const candidates = [
    ...buildAlertNotifications(
      sortedAlerts,
      locationName,
      input.alertNotifications,
    ),
    buildRainNotification(rainStart, isRainingNow, input),
  ].filter((value): value is WatchNotification => value !== undefined);

  const seenIds = new Set(input.seen.map((record) => record.id));
  const notifications = candidates.filter(
    (notification) => !seenIds.has(notification.id),
  );

  const cutoff = input.now.getTime() - SEEN_RETENTION_MS;
  const seen: SeenRecord[] = [
    ...input.seen.filter((record) => {
      const at = new Date(record.at).getTime();
      return Number.isNaN(at) ? false : at >= cutoff;
    }),
    ...notifications.map((notification) => ({
      id: notification.id,
      at: nowISO,
    })),
  ];

  const text = current
    ? (buildStatusText(
        {
          locationName,
          tempC: current.temperatureC,
          feelsLikeC: current.feelsLikeC,
          condition: current.condition,
          precipMm: current.precipitationNext1hMm,
        },
        input.units.displayMode,
        input.units,
      ) ?? "")
    : "";

  return {
    notifications,
    seen,
    snapshot: {
      schema: STATUS_SCHEMA_VERSION,
      updatedAt: nowISO,
      forecastUpdatedAt: input.forecastUpdatedAt,
      location: {
        name: locationName,
        latitude: input.location.latitude,
        longitude: input.location.longitude,
        timezone: input.location.timezone,
      },
      current,
      alerts: sortedAlerts.map((alert) => ({
        event: alert.event,
        severity: alert.severity,
        headline: alert.headline,
        area: alert.area || undefined,
        onsetISO: alert.onsetISO,
        expiresISO: alert.expiresISO,
      })),
      rainStartsAtISO: rainStart?.time,
      text,
      alt: current?.symbolCode ?? "unknown",
      tooltip: buildTooltip(current, sortedAlerts, input),
      class: statusClass(sortedAlerts, isRainingNow, rainStart),
    },
  };
}
