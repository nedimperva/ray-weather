import { describe, expect, it } from "vitest";

import type { DailyForecast } from "../../types";
import { buildWeekendPlan, weekendDaysFromForecast } from "../weekendPlanner";

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
    hourly: [],
    ...overrides,
  };
}

describe("weekendDaysFromForecast", () => {
  it("selects the upcoming Saturday and following Sunday", () => {
    const days = weekendDaysFromForecast([
      makeDay({ dateKey: "2026-06-05", label: "Friday" }),
      makeDay({ dateKey: "2026-06-06", label: "Saturday" }),
      makeDay({ dateKey: "2026-06-07", label: "Sunday" }),
      makeDay({ dateKey: "2026-06-08", label: "Monday" }),
    ]);

    expect(days.map((day) => day.label)).toEqual(["Saturday", "Sunday"]);
  });

  it("keeps a single available weekend day when the pair is incomplete", () => {
    const days = weekendDaysFromForecast([
      makeDay({ dateKey: "2026-06-01", label: "Monday" }),
      makeDay({ dateKey: "2026-06-07", label: "Sunday" }),
    ]);

    expect(days.map((day) => day.label)).toEqual(["Sunday"]);
  });

  it("falls back to the first two available forecast days", () => {
    const plan = buildWeekendPlan([
      makeDay({ dateKey: "2026-06-01", label: "Monday" }),
      makeDay({ dateKey: "2026-06-02", label: "Tuesday" }),
      makeDay({ dateKey: "2026-06-03", label: "Wednesday" }),
    ]);

    expect(plan.weekendDays.map((day) => day.label)).toEqual([
      "Monday",
      "Tuesday",
    ]);
    expect(plan.isFallbackWeekend).toBe(true);
  });

  it("scores the selected days with AQI and alert context", () => {
    const plan = buildWeekendPlan(
      [
        makeDay({ dateKey: "2026-06-06", label: "Saturday" }),
        makeDay({
          dateKey: "2026-06-07",
          label: "Sunday",
          precipitationMm: 12,
        }),
      ],
      {
        aqiForDate: (dateKey) => (dateKey === "2026-06-07" ? 120 : 20),
        alertCountForDate: (dateKey) => (dateKey === "2026-06-07" ? 1 : 0),
      },
    );

    expect(plan.bestDay?.day.label).toBe("Saturday");
    expect(plan.scoredWeekendDays[1].aqi).toBe(120);
    expect(plan.scoredWeekendDays[1].alertCount).toBe(1);
  });
});
