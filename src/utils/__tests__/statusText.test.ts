import { describe, expect, it } from "vitest";

import { buildStatusText, type StatusConditions } from "../statusText";

const conditions: StatusConditions = {
  locationName: "Oslo",
  tempC: 4.4,
  feelsLikeC: 0.6,
  condition: "Light Rain",
  precipMm: 0.6,
};

const metric = {
  temperatureUnit: "celsius",
  precipitationUnit: "mm",
} as const;

describe("buildStatusText", () => {
  it("renders every display mode", () => {
    expect(buildStatusText(conditions, "temp-only", metric)).toBe("4°C");
    expect(buildStatusText(conditions, "temp-condition", metric)).toBe(
      "4°C Light Rain",
    );
    expect(buildStatusText(conditions, "temp-rain", metric)).toBe("4°C 0.6 mm");
    expect(buildStatusText(conditions, "feels-like", metric)).toBe("Feels 1°C");
    expect(buildStatusText(conditions, "location-temp", metric)).toBe(
      "Oslo 4°C",
    );
  });

  it("returns nothing for the icon-only mode", () => {
    expect(buildStatusText(conditions, "compact", metric)).toBeUndefined();
  });

  it("honours imperial units", () => {
    expect(
      buildStatusText(conditions, "temp-rain", {
        temperatureUnit: "fahrenheit",
        precipitationUnit: "inches",
      }),
    ).toBe("40°F 0.02 in");
  });
});
