import { describe, it, expect } from "vitest";
import {
  alertCountForDate,
  alertCoversDate,
  parseWeatherAlerts,
  severityRank,
} from "../alerts";
import { dateKeyInTimezone } from "../dates";
import type { WeatherAlert } from "../../types";

describe("parseWeatherAlerts", () => {
  it("reads event, lower-cased severity, and timing from properties", () => {
    const [alert] = parseWeatherAlerts({
      features: [
        {
          properties: {
            event: "Heavy rain",
            severity: "Severe",
            area: "West coast",
            onset: "2026-06-06T06:00:00Z",
            expires: "2026-06-06T18:00:00Z",
          },
        },
      ],
    });

    expect(alert.event).toBe("Heavy rain");
    expect(alert.severity).toBe("severe");
    expect(alert.area).toBe("West coast");
    expect(alert.onsetISO).toBe("2026-06-06T06:00:00Z");
    expect(alert.expiresISO).toBe("2026-06-06T18:00:00Z");
  });

  it("falls back to the GeoJSON when.interval for timing", () => {
    const [alert] = parseWeatherAlerts({
      features: [
        {
          when: { interval: ["2026-06-06T00:00:00Z", "2026-06-08T00:00:00Z"] },
          properties: { event: "Gale" },
        },
      ],
    });

    expect(alert.onsetISO).toBe("2026-06-06T00:00:00Z");
    expect(alert.expiresISO).toBe("2026-06-08T00:00:00Z");
    expect(alert.severity).toBe("unknown");
  });

  it("skips features without an event", () => {
    expect(parseWeatherAlerts({ features: [{ properties: {} }] })).toHaveLength(
      0,
    );
  });
});

describe("severityRank", () => {
  it("orders extreme above severe above unknown", () => {
    expect(severityRank("extreme")).toBeGreaterThan(severityRank("severe"));
    expect(severityRank("severe")).toBeGreaterThan(severityRank("moderate"));
    expect(severityRank("minor")).toBeGreaterThan(severityRank("unknown"));
  });
});

const baseAlert: WeatherAlert = {
  area: "",
  event: "Test",
  headline: "",
  description: "",
  severity: "moderate",
};

describe("alertCoversDate", () => {
  it("covers dates inside the onset/expires window only", () => {
    const alert: WeatherAlert = {
      ...baseAlert,
      onsetISO: "2026-06-06T00:00:00Z",
      expiresISO: "2026-06-08T00:00:00Z",
    };

    expect(alertCoversDate(alert, "2026-06-07", "UTC")).toBe(true);
    expect(alertCoversDate(alert, "2026-06-08", "UTC")).toBe(true);
    expect(alertCoversDate(alert, "2026-06-05", "UTC")).toBe(false);
    expect(alertCoversDate(alert, "2026-06-09", "UTC")).toBe(false);
  });

  it("treats an untimed alert as covering only today", () => {
    const todayKey = dateKeyInTimezone(new Date(), "UTC");
    expect(alertCoversDate(baseAlert, todayKey, "UTC")).toBe(true);
    expect(alertCoversDate(baseAlert, "2000-01-01", "UTC")).toBe(false);
  });

  it("counts only alerts that cover the given date", () => {
    const alerts: WeatherAlert[] = [
      {
        ...baseAlert,
        onsetISO: "2026-06-06T00:00:00Z",
        expiresISO: "2026-06-06T23:00:00Z",
      },
      {
        ...baseAlert,
        onsetISO: "2026-06-10T00:00:00Z",
        expiresISO: "2026-06-11T00:00:00Z",
      },
    ];

    expect(alertCountForDate(alerts, "2026-06-06", "UTC")).toBe(1);
    expect(alertCountForDate(alerts, "2026-06-10", "UTC")).toBe(1);
    expect(alertCountForDate(alerts, "2026-06-08", "UTC")).toBe(0);
  });
});
