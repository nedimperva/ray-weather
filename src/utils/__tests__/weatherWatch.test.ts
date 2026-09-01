import { describe, expect, it } from "vitest";

import type { ForecastEntry, Location, WeatherAlert } from "../../types";
import {
  buildWatchReport,
  SEEN_RETENTION_MS,
  type WatchInput,
} from "../weatherWatch";

const NOW = new Date("2026-03-14T12:00:00Z");

const location: Location = {
  id: "sarajevo",
  name: "Sarajevo",
  latitude: 43.85,
  longitude: 18.38,
  country: "Bosnia and Herzegovina",
  timezone: "Europe/Sarajevo",
};

function entry(
  time: string,
  overrides: {
    temperature?: number;
    precipitation?: number;
    probability?: number;
    symbol?: string;
  } = {},
): ForecastEntry {
  return {
    time,
    data: {
      instant: {
        details: {
          air_temperature: overrides.temperature ?? 11,
          wind_speed: 2,
          relative_humidity: 60,
          cloud_area_fraction: 40,
          ultraviolet_index_clear_sky: 3,
        },
      },
      next_1_hours: {
        summary: { symbol_code: overrides.symbol ?? "partlycloudy_day" },
        details: {
          precipitation_amount: overrides.precipitation ?? 0,
          probability_of_precipitation: overrides.probability ?? 0,
        },
      },
    },
  };
}

function alert(overrides: Partial<WeatherAlert> = {}): WeatherAlert {
  return {
    area: "Sarajevo Canton",
    event: "Heavy rain",
    headline: "Heavy rain expected through the evening.",
    description: "Localized flooding possible.",
    severity: "severe",
    onsetISO: "2026-03-14T15:00:00Z",
    expiresISO: "2026-03-15T03:00:00Z",
    ...overrides,
  };
}

function input(overrides: Partial<WatchInput> = {}): WatchInput {
  return {
    now: NOW,
    location,
    timeseries: [
      entry("2026-03-14T11:00:00Z"),
      entry("2026-03-14T12:00:00Z"),
      entry("2026-03-14T13:00:00Z"),
    ],
    alerts: [],
    seen: [],
    alertNotifications: "severe",
    rainNotifications: true,
    units: {
      temperatureUnit: "celsius",
      windSpeedUnit: "ms",
      precipitationUnit: "mm",
      displayMode: "temp-condition",
    },
    ...overrides,
  };
}

describe("buildWatchReport alerts", () => {
  it("notifies about a severe alert and remembers it", () => {
    const first = buildWatchReport(input({ alerts: [alert()] }));

    expect(first.notifications).toHaveLength(1);
    expect(first.notifications[0].kind).toBe("alert");
    expect(first.notifications[0].urgency).toBe("High");
    expect(first.notifications[0].title).toContain("Sarajevo");

    const second = buildWatchReport(
      input({ alerts: [alert()], seen: first.seen }),
    );
    expect(second.notifications).toHaveLength(0);
  });

  it("notifies again when the same event is escalated", () => {
    const first = buildWatchReport(
      input({ alerts: [alert({ severity: "moderate" })] }),
    );
    // "severe" mode ignores moderate alerts entirely.
    expect(first.notifications).toHaveLength(0);

    const escalated = buildWatchReport(
      input({ alerts: [alert({ severity: "extreme" })], seen: first.seen }),
    );
    expect(escalated.notifications).toHaveLength(1);
    expect(escalated.notifications[0].urgency).toBe("High");
  });

  it("honours the all and off modes", () => {
    const all = buildWatchReport(
      input({
        alerts: [alert({ severity: "minor" })],
        alertNotifications: "all",
      }),
    );
    expect(all.notifications).toHaveLength(1);
    expect(all.notifications[0].urgency).toBe("Low");

    const off = buildWatchReport(
      input({ alerts: [alert()], alertNotifications: "off" }),
    );
    expect(off.notifications).toHaveLength(0);
    // The status file still reports the alert; only the notification is muted.
    expect(off.snapshot.alerts).toHaveLength(1);
  });

  it("sorts alerts by severity in the snapshot", () => {
    const report = buildWatchReport(
      input({
        alerts: [
          alert({ event: "Wind", severity: "minor" }),
          alert({ event: "Flood", severity: "extreme" }),
        ],
        alertNotifications: "off",
      }),
    );

    expect(report.snapshot.alerts.map((a) => a.event)).toEqual([
      "Flood",
      "Wind",
    ]);
    expect(report.snapshot.class).toBe("alert-extreme");
  });
});

describe("buildWatchReport rain", () => {
  it("warns once when rain starts within the lookahead window", () => {
    const timeseries = [
      entry("2026-03-14T12:00:00Z"),
      entry("2026-03-14T13:00:00Z", {
        precipitation: 1.4,
        probability: 80,
        symbol: "rain",
      }),
    ];

    const first = buildWatchReport(input({ timeseries }));
    expect(first.notifications).toHaveLength(1);
    expect(first.notifications[0].kind).toBe("rain");
    expect(first.notifications[0].body).toContain("1.4 mm");
    expect(first.snapshot.class).toBe("rain-soon");
    expect(first.snapshot.rainStartsAtISO).toBe("2026-03-14T13:00:00Z");

    const second = buildWatchReport(input({ timeseries, seen: first.seen }));
    expect(second.notifications).toHaveLength(0);
  });

  it("stays quiet while it is already raining", () => {
    const report = buildWatchReport(
      input({
        timeseries: [
          entry("2026-03-14T12:00:00Z", { precipitation: 0.8, symbol: "rain" }),
          entry("2026-03-14T13:00:00Z", { precipitation: 1.2, symbol: "rain" }),
        ],
      }),
    );

    expect(report.notifications).toHaveLength(0);
    expect(report.snapshot.class).toBe("raining");
  });

  it("ignores rain beyond the lookahead window", () => {
    const report = buildWatchReport(
      input({
        timeseries: [
          entry("2026-03-14T12:00:00Z"),
          entry("2026-03-14T18:00:00Z", { precipitation: 3, symbol: "rain" }),
        ],
      }),
    );

    expect(report.notifications).toHaveLength(0);
    expect(report.snapshot.rainStartsAtISO).toBeUndefined();
  });

  it("can be turned off without affecting alerts", () => {
    const report = buildWatchReport(
      input({
        rainNotifications: false,
        alerts: [alert()],
        timeseries: [
          entry("2026-03-14T12:00:00Z"),
          entry("2026-03-14T13:00:00Z", { precipitation: 2, symbol: "rain" }),
        ],
      }),
    );

    expect(report.notifications.map((n) => n.kind)).toEqual(["alert"]);
  });
});

describe("buildWatchReport snapshot", () => {
  it("reports the observation for the current hour", () => {
    const report = buildWatchReport(
      input({
        timeseries: [
          entry("2026-03-14T11:00:00Z", { temperature: 5 }),
          entry("2026-03-14T12:00:00Z", { temperature: 9 }),
          entry("2026-03-14T13:00:00Z", { temperature: 14 }),
        ],
      }),
    );

    expect(report.snapshot.current?.temperatureC).toBe(9);
    expect(report.snapshot.text).toBe("9°C Partlycloudy");
    expect(report.snapshot.alt).toBe("partlycloudy_day");
    expect(report.snapshot.class).toBe("clear");
    expect(report.snapshot.tooltip.split("\n")[0]).toBe("Sarajevo");
  });

  it("follows the display preference and unit preferences", () => {
    const report = buildWatchReport(
      input({
        units: {
          temperatureUnit: "fahrenheit",
          windSpeedUnit: "mph",
          precipitationUnit: "inches",
          displayMode: "location-temp",
        },
      }),
    );

    expect(report.snapshot.text).toBe("Sarajevo 52°F");
  });

  it("survives an empty forecast", () => {
    const report = buildWatchReport(input({ timeseries: [] }));

    expect(report.snapshot.current).toBeNull();
    expect(report.snapshot.text).toBe("");
    expect(report.notifications).toHaveLength(0);
  });
});

describe("buildWatchReport seen records", () => {
  it("drops records past the retention window", () => {
    const stale = {
      id: "alert|old|severe|",
      at: new Date(NOW.getTime() - SEEN_RETENTION_MS - 1000).toISOString(),
    };
    const recent = { id: "alert|recent|severe|", at: NOW.toISOString() };

    const report = buildWatchReport(input({ seen: [stale, recent] }));

    expect(report.seen.map((record) => record.id)).toEqual([recent.id]);
  });

  it("discards records with an unparseable timestamp", () => {
    const report = buildWatchReport(
      input({ seen: [{ id: "alert|broken", at: "not a date" }] }),
    );

    expect(report.seen).toHaveLength(0);
  });
});
