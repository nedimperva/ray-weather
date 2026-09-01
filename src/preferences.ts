import { getPreferenceValues } from "@raycast/api";

export type TemperatureUnit = "celsius" | "fahrenheit";
export type WindSpeedUnit = "ms" | "kmh" | "mph" | "knots";
export type PrecipitationUnit = "mm" | "inches";
export type AlertNotificationMode = "off" | "severe" | "all";
export type MenuBarDisplayMode =
  | "temp-only"
  | "temp-condition"
  | "temp-rain"
  | "feels-like"
  | "location-temp"
  | "compact";

export interface Preferences {
  temperatureUnit: TemperatureUnit;
  windSpeedUnit: WindSpeedUnit;
  precipitationUnit: PrecipitationUnit;
  forecastDays: string;
  menuBarDisplayMode: MenuBarDisplayMode;
  morningCommuteStart: string;
  morningCommuteEnd: string;
  eveningCommuteStart: string;
  eveningCommuteEnd: string;
  alertNotifications: AlertNotificationMode;
  rainNotifications: boolean;
}

export function getPrefs(): Preferences {
  return getPreferenceValues<Preferences>();
}

export function getForecastDays(): number {
  const prefs = getPrefs();
  const days = parseInt(prefs.forecastDays, 10);
  return [3, 5, 7, 10].includes(days) ? days : 10;
}

function hourPreference(value: string | undefined, fallback: number): number {
  const hour = Number.parseInt(value ?? "", 10);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : fallback;
}

export function getCommuteHours() {
  const prefs = getPrefs();
  const morningStart = hourPreference(prefs.morningCommuteStart, 7);
  const morningEnd = hourPreference(prefs.morningCommuteEnd, 9);
  const eveningStart = hourPreference(prefs.eveningCommuteStart, 16);
  const eveningEnd = hourPreference(prefs.eveningCommuteEnd, 18);

  return {
    morningStart: Math.min(morningStart, morningEnd),
    morningEnd: Math.max(morningStart, morningEnd),
    eveningStart: Math.min(eveningStart, eveningEnd),
    eveningEnd: Math.max(eveningStart, eveningEnd),
  };
}
