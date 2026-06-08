import { describe, it, expect } from "vitest";
import { buildDailyForecast } from "../forecast";

function entry(
  time: string,
  details: Record<string, number>,
  next1: {
    precipitation_amount?: number;
    probability_of_precipitation?: number;
  },
) {
  return {
    time,
    data: {
      instant: { details },
      next_1_hours: {
        summary: { symbol_code: "clearsky_day" },
        details: next1,
      },
    },
  };
}

describe("buildDailyForecast", () => {
  const timeseries = [
    entry(
      "2026-06-06T10:00:00Z",
      {
        air_temperature: 20,
        wind_speed: 3,
        relative_humidity: 50,
        ultraviolet_index_clear_sky: 6,
        cloud_area_fraction: 0,
      },
      { precipitation_amount: 0, probability_of_precipitation: 10 },
    ),
    entry(
      "2026-06-06T12:00:00Z",
      {
        air_temperature: 24,
        wind_speed: 5,
        ultraviolet_index_clear_sky: 8,
        cloud_area_fraction: 0,
      },
      { precipitation_amount: 1, probability_of_precipitation: 70 },
    ),
    entry(
      "2026-06-07T12:00:00Z",
      {
        air_temperature: 15,
        ultraviolet_index_clear_sky: 4,
        cloud_area_fraction: 100,
      },
      { precipitation_amount: 2, probability_of_precipitation: 90 },
    ),
  ];

  it("groups timeseries into local days", () => {
    const days = buildDailyForecast(timeseries, "UTC", 10);
    expect(days).toHaveLength(2);
    expect(days[0].dateKey).toBe("2026-06-06");
    expect(days[0].hourly).toHaveLength(2);
  });

  it("aggregates temperature extremes and precipitation", () => {
    const [day] = buildDailyForecast(timeseries, "UTC", 10);
    expect(day.minTempC).toBe(20);
    expect(day.maxTempC).toBe(24);
    expect(day.precipitationMm).toBeCloseTo(1);
  });

  it("derives max UV (cloud-adjusted) and max rain probability per day", () => {
    const days = buildDailyForecast(timeseries, "UTC", 10);
    // Clear sky on day one, so UV is the unattenuated peak.
    expect(days[0].maxUvIndex).toBeCloseTo(8);
    expect(days[0].maxPrecipitationProbabilityPct).toBe(70);
    // Day two is fully overcast: UV 4 -> 4 * 0.25 = 1.
    expect(days[1].maxUvIndex).toBeCloseTo(1);
    expect(days[1].maxPrecipitationProbabilityPct).toBe(90);
  });

  it("respects the maxDays limit", () => {
    expect(buildDailyForecast(timeseries, "UTC", 1)).toHaveLength(1);
  });
});
