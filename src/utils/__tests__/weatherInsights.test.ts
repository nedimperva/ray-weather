import { describe, it, expect } from "vitest";
import {
  buildComfortScore,
  buildDecisionTags,
  buildShouldIDecisions,
  formatWindDirection,
  periodForHour,
} from "../weatherInsights";
import type { DailyForecast, HourlyForecast } from "../../types";

function makeHour(overrides: Partial<HourlyForecast> = {}): HourlyForecast {
  return {
    id: "h",
    localTimeLabel: "12:00",
    hour: 12,
    temperatureC: 19,
    precipitationMm: 0,
    precipitationWindowHours: 1,
    feelsLikeC: 19,
    symbolCode: "clearsky_day",
    condition: "Clearsky",
    ...overrides,
  };
}

function makeDay(overrides: Partial<DailyForecast> = {}): DailyForecast {
  return {
    dateKey: "2026-06-06",
    label: "Today",
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
    condition: "Clearsky",
    avgWindSpeedMs: 2,
    hourly: [makeHour()],
    ...overrides,
  };
}

describe("buildComfortScore", () => {
  it("scores a calm, mild day highly", () => {
    expect(buildComfortScore(makeDay())).toBeGreaterThanOrEqual(90);
  });

  it("penalizes rain, wind, AQI, and alerts and clamps to 0-100", () => {
    const harsh = makeDay({
      maxTempC: 2,
      precipitationMm: 20,
      avgWindSpeedMs: 18,
    });
    const score = buildComfortScore(harsh, 11, 180, 2);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThan(40);
  });

  it("drops the score when an alert covers the day", () => {
    const day = makeDay();
    expect(buildComfortScore(day, 0, 0, 1)).toBeLessThan(
      buildComfortScore(day, 0, 0, 0),
    );
  });
});

describe("buildDecisionTags", () => {
  it("flags rain from probability even when accumulation is low", () => {
    const tags = buildDecisionTags(
      makeDay({ precipitationMm: 0, maxPrecipitationProbabilityPct: 75 }),
    );
    expect(tags.some((tag) => tag.value.includes("Rain likely 75%"))).toBe(
      true,
    );
  });

  it("surfaces an alert tag first", () => {
    const tags = buildDecisionTags(makeDay(), 0, 2);
    expect(tags[0].value).toBe("2 alerts");
  });

  it("calls a calm, mild day great to be outside", () => {
    const tags = buildDecisionTags(makeDay());
    expect(tags.some((tag) => tag.value === "Great outside")).toBe(true);
  });
});

describe("buildShouldIDecisions", () => {
  it("recommends an umbrella when rain probability is high", () => {
    const decisions = buildShouldIDecisions(
      makeDay({ maxPrecipitationProbabilityPct: 80 }),
    );
    const umbrella = decisions.find((d) => d.id === "umbrella");
    expect(umbrella?.answer).toBe("Yes");
    expect(umbrella?.reason).toContain("80%");
  });

  it("does not recommend an umbrella on a dry day", () => {
    const decisions = buildShouldIDecisions(makeDay());
    expect(decisions.find((d) => d.id === "umbrella")?.answer).toBe("No");
  });
});

describe("helpers", () => {
  it("maps wind bearings to compass points", () => {
    expect(formatWindDirection(0)).toBe("N");
    expect(formatWindDirection(90)).toBe("E");
    expect(formatWindDirection(180)).toBe("S");
    expect(formatWindDirection(270)).toBe("W");
    expect(formatWindDirection(undefined)).toBeUndefined();
  });

  it("buckets hours into day periods", () => {
    expect(periodForHour(3)).toBe("Night");
    expect(periodForHour(9)).toBe("Morning");
    expect(periodForHour(15)).toBe("Afternoon");
    expect(periodForHour(21)).toBe("Evening");
  });
});
