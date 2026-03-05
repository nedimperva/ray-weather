import { getPreferenceValues } from "@raycast/api";

export type TemperatureUnit = "celsius" | "fahrenheit";
export type WindSpeedUnit = "ms" | "kmh" | "mph" | "knots";
export type PrecipitationUnit = "mm" | "inches";

export interface Preferences {
  temperatureUnit: TemperatureUnit;
  windSpeedUnit: WindSpeedUnit;
  precipitationUnit: PrecipitationUnit;
  forecastDays: string;
}

export function getPrefs(): Preferences {
  return getPreferenceValues<Preferences>();
}

export function getForecastDays(): number {
  const prefs = getPrefs();
  const days = parseInt(prefs.forecastDays, 10);
  return [3, 5, 7, 10].includes(days) ? days : 10;
}
