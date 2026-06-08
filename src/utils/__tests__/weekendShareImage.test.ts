import { describe, expect, it } from "vitest";

import type { DailyForecast, Location, WeatherAlert } from "../../types";
import {
  buildWeekendShareImageModel,
  buildWeekendShareSvg,
  renderWeekendSharePng,
  type WeekendShareImageInput,
} from "../weekendShareImage";

function makeDay(overrides: Partial<DailyForecast> = {}): DailyForecast {
  return {
    dateKey: "2026-06-06",
    label: "Saturday",
    shortDate: "Jun 6",
    dayAndDate: "Saturday, Jun 6",
    minTempC: 14,
    maxTempC: 22,
    minFeelsLikeC: 14,
    maxFeelsLikeC: 22,
    minTempF: 57,
    maxTempF: 72,
    precipitationMm: 0,
    symbolCode: "clearsky_day",
    condition: "Clear sky",
    avgWindSpeedMs: 2,
    maxUvIndex: 6,
    hourly: [],
    ...overrides,
  };
}

function makeInput(alerts: WeatherAlert[] = []): WeekendShareImageInput {
  const location: Location = {
    id: "oslo-59.9139-10.7522",
    name: "Oslo",
    latitude: 59.9139,
    longitude: 10.7522,
    country: "Norway",
    timezone: "Europe/Oslo",
  };
  const saturday = {
    day: makeDay(),
    maxUvIndex: 6,
    aqi: 32,
    alertCount: 0,
    comfortScore: 92,
  };
  const sunday = {
    day: makeDay({
      dateKey: "2026-06-07",
      label: "Sunday",
      shortDate: "Jun 7",
      dayAndDate: "Sunday, Jun 7",
      precipitationMm: 8,
      condition: "Rain",
      avgWindSpeedMs: 7,
    }),
    maxUvIndex: 2,
    aqi: 48,
    alertCount: alerts.length,
    comfortScore: 54,
  };

  return {
    location,
    days: [saturday, sunday],
    bestDay: saturday,
    otherDay: sunday,
    updatedLabel: "9:30 AM",
    alerts,
    preferences: {
      temperatureUnit: "celsius",
      windSpeedUnit: "ms",
      precipitationUnit: "mm",
    },
    isFallbackWeekend: false,
  };
}

describe("weekend share image", () => {
  it("builds a compact model for the weekend recommendation", () => {
    const model = buildWeekendShareImageModel(makeInput());

    expect(model.location).toBe("Oslo, Norway");
    expect(model.recommendationTitle).toBe("Saturday looks best");
    expect(model.alertSummary).toBe("No weather alerts");
    expect(model.days).toHaveLength(2);
    expect(model.days[0]).toMatchObject({
      label: "Saturday, Jun 6",
      rain: "0.0 mm",
      wind: "2.0 m/s",
      uv: "6",
      aqi: "32",
      alerts: "None",
      isBest: true,
    });
  });

  it("includes alerts and key forecast text in the SVG", () => {
    const svg = buildWeekendShareSvg(
      makeInput([
        {
          area: "Oslo",
          event: "Thunderstorm",
          headline: "Thunderstorm risk",
          description: "Storms possible.",
          severity: "moderate",
        },
      ]),
    );

    expect(svg).toContain("Oslo, Norway");
    expect(svg).toContain("Saturday looks best");
    expect(svg).toContain("Sunday, Jun 7");
    expect(svg).toContain("Thunderstorm");
    expect(svg).toContain("met.no Locationforecast");
  });

  it("renders a PNG buffer", async () => {
    const png = await renderWeekendSharePng(makeInput());

    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });
});
