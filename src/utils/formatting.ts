import type { Location } from "../types";

export function conditionLabelForSymbol(symbolCode: string): string {
  const value = symbolCode
    .replace(/_/g, " ")
    .replace(/\b(day|night)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return value.length > 0
    ? value.replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Cloudy";
}

export function aqiLabel(aqi: number): string {
  if (aqi >= 4) return "Unhealthy";
  if (aqi >= 3) return "Unhealthy for Sensitive";
  if (aqi >= 2) return "Moderate";
  return "Good";
}

export function formatLocationSubtitle(location: Location): string {
  return [location.region, location.country].filter(Boolean).join(", ");
}

export function locationSummary(location: Location): string {
  const subtitle = formatLocationSubtitle(location);
  return subtitle ? `${location.name}, ${subtitle}` : location.name;
}

export function dayLabelFromIndex(dayIndex: number, weekday: string): string {
  if (dayIndex === 0) return "Today";
  if (dayIndex === 1) return "Tomorrow";
  return weekday;
}
