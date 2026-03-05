import type { WindSpeedUnit, PrecipitationUnit } from "../preferences";

export function convertWindSpeed(speedMs: number, unit: WindSpeedUnit): number {
  switch (unit) {
    case "kmh":
      return speedMs * 3.6;
    case "mph":
      return speedMs * 2.237;
    case "knots":
      return speedMs * 1.944;
    case "ms":
    default:
      return speedMs;
  }
}

export function windSpeedLabel(unit: WindSpeedUnit): string {
  switch (unit) {
    case "kmh":
      return "km/h";
    case "mph":
      return "mph";
    case "knots":
      return "kn";
    case "ms":
    default:
      return "m/s";
  }
}

export function formatWindSpeed(
  speedMs: number | undefined,
  unit: WindSpeedUnit,
): string {
  if (speedMs === undefined) return "No data";
  return `${convertWindSpeed(speedMs, unit).toFixed(1)} ${windSpeedLabel(unit)}`;
}

export function convertPrecipitation(
  mm: number,
  unit: PrecipitationUnit,
): number {
  if (unit === "inches") {
    return mm / 25.4;
  }
  return mm;
}

export function precipitationLabel(unit: PrecipitationUnit): string {
  return unit === "inches" ? "in" : "mm";
}

export function formatPrecipitation(
  mm: number,
  unit: PrecipitationUnit,
): string {
  const value = convertPrecipitation(mm, unit);
  const label = precipitationLabel(unit);
  return unit === "inches"
    ? `${value.toFixed(2)} ${label}`
    : `${value.toFixed(1)} ${label}`;
}
