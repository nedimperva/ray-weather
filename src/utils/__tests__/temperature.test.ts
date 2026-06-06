import { describe, it, expect } from "vitest";
import {
  calculateFeelsLikeC,
  formatTemperature,
  toCelsius,
  toFahrenheit,
} from "../temperature";

describe("temperature conversions", () => {
  it("converts between Celsius and Fahrenheit", () => {
    expect(toFahrenheit(0)).toBe(32);
    expect(toFahrenheit(100)).toBe(212);
    expect(toCelsius(32)).toBeCloseTo(0);
    expect(toCelsius(212)).toBeCloseTo(100);
  });

  it("formats with rounding and the chosen unit", () => {
    expect(formatTemperature(20.4, "celsius")).toBe("20°C");
    expect(formatTemperature(0, "fahrenheit")).toBe("32°F");
  });
});

describe("calculateFeelsLikeC", () => {
  it("returns the air temperature in mild conditions", () => {
    expect(calculateFeelsLikeC(18, 2, 50)).toBe(18);
  });

  it("applies wind chill when cold and windy", () => {
    expect(calculateFeelsLikeC(0, 10)).toBeLessThan(0);
  });

  it("applies heat index when hot and humid", () => {
    expect(calculateFeelsLikeC(32, 1, 70)).toBeGreaterThan(32);
  });
});
