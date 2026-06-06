import { describe, it, expect } from "vitest";
import { adjustUvForClouds } from "../uv";

describe("adjustUvForClouds", () => {
  it("returns undefined when clear-sky UV is missing", () => {
    expect(adjustUvForClouds(undefined, 50)).toBeUndefined();
  });

  it("leaves UV unchanged when cloud cover is unknown", () => {
    expect(adjustUvForClouds(7, undefined)).toBe(7);
  });

  it("does not attenuate under a clear sky", () => {
    expect(adjustUvForClouds(8, 0)).toBeCloseTo(8);
  });

  it("cuts UV substantially under full overcast", () => {
    // factor = 1 - 0.75 * 1^3 = 0.25
    expect(adjustUvForClouds(8, 100)).toBeCloseTo(2);
  });

  it("barely attenuates under thin/partial cloud", () => {
    const adjusted = adjustUvForClouds(8, 40) ?? 0;
    expect(adjusted).toBeGreaterThan(7.5);
    expect(adjusted).toBeLessThanOrEqual(8);
  });

  it("clamps out-of-range cloud fractions", () => {
    expect(adjustUvForClouds(8, 150)).toBeCloseTo(2);
    expect(adjustUvForClouds(8, -20)).toBeCloseTo(8);
  });
});
