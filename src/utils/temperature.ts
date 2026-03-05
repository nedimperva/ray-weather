import type { TemperatureUnit } from "../preferences";

export function toFahrenheit(tempC: number): number {
  return (tempC * 9) / 5 + 32;
}

export function toCelsius(tempF: number): number {
  return ((tempF - 32) * 5) / 9;
}

export function calculateFeelsLikeC(
  tempC: number,
  windSpeedMs?: number,
  humidityPct?: number,
): number {
  const windSpeedKph = (windSpeedMs ?? 0) * 3.6;

  if (tempC <= 10 && windSpeedKph > 4.8) {
    return (
      13.12 +
      0.6215 * tempC -
      11.37 * Math.pow(windSpeedKph, 0.16) +
      0.3965 * tempC * Math.pow(windSpeedKph, 0.16)
    );
  }

  if (tempC >= 27 && typeof humidityPct === "number" && humidityPct >= 40) {
    const tempF = toFahrenheit(tempC);
    const heatIndexF =
      -42.379 +
      2.04901523 * tempF +
      10.14333127 * humidityPct -
      0.22475541 * tempF * humidityPct -
      0.00683783 * tempF * tempF -
      0.05481717 * humidityPct * humidityPct +
      0.00122874 * tempF * tempF * humidityPct +
      0.00085282 * tempF * humidityPct * humidityPct -
      0.00000199 * tempF * tempF * humidityPct * humidityPct;
    return toCelsius(heatIndexF);
  }

  return tempC;
}

export function formatTemperature(
  tempC: number,
  unit: TemperatureUnit,
): string {
  if (unit === "fahrenheit") {
    return `${Math.round(toFahrenheit(tempC))}°F`;
  }
  return `${Math.round(tempC)}°C`;
}

export function formatTemperatureRange(
  minTempC: number,
  maxTempC: number,
  unit: TemperatureUnit,
): string {
  return `${formatTemperature(maxTempC, unit)} / ${formatTemperature(minTempC, unit)}`;
}
