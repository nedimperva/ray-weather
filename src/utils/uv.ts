// The met.no "complete" endpoint only exposes a clear-sky UV index. Clouds can
// cut surface UV substantially, so we attenuate the clear-sky value using the
// cloud cover reported in the same timeseries point. The cubic curve keeps thin
// or partial cloud almost neutral while letting full overcast drop UV by ~75%.
export function adjustUvForClouds(
  uvClearSky: number | undefined,
  cloudCoveragePct: number | undefined,
): number | undefined {
  if (uvClearSky === undefined) return undefined;
  if (cloudCoveragePct === undefined) return uvClearSky;

  const fraction = Math.min(Math.max(cloudCoveragePct / 100, 0), 1);
  const cloudFactor = 1 - 0.75 * fraction ** 3;
  return uvClearSky * cloudFactor;
}
