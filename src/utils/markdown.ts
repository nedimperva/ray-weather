import type { DailyForecast, HourlyForecast } from "../types";
import type { Preferences } from "../preferences";
import { formatTemperature, formatTemperatureRange } from "./temperature";
import { formatWindSpeed } from "./units";
import { formatPrecipitation } from "./units";

export function buildDaySummaryMarkdown(
  day: DailyForecast,
  prefs: Preferences,
  sunrise?: string,
  sunset?: string,
  maxUvIndex?: number,
): string {
  const lines: string[] = [];
  lines.push(`## ${day.dayAndDate}`);
  lines.push(`**${day.condition}**`);
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(
    `| Temperature | ${formatTemperatureRange(day.minTempC, day.maxTempC, prefs.temperatureUnit)} |`,
  );
  lines.push(
    `| Feels Like | ${formatTemperatureRange(day.minFeelsLikeC, day.maxFeelsLikeC, prefs.temperatureUnit)} |`,
  );
  lines.push(
    `| Precipitation | ${formatPrecipitation(day.precipitationMm, prefs.precipitationUnit)} |`,
  );
  if (day.avgWindSpeedMs !== undefined) {
    lines.push(
      `| Wind | ${formatWindSpeed(day.avgWindSpeedMs, prefs.windSpeedUnit)} |`,
    );
  }
  if (day.avgHumidityPct !== undefined) {
    lines.push(`| Humidity | ${Math.round(day.avgHumidityPct)}% |`);
  }
  if (day.avgPressureHpa !== undefined) {
    const trendIcon =
      day.pressureTrend === "rising"
        ? " ↑"
        : day.pressureTrend === "falling"
          ? " ↓"
          : "";
    lines.push(
      `| Pressure | ${day.avgPressureHpa.toFixed(0)} hPa${trendIcon} |`,
    );
  }
  if (maxUvIndex !== undefined) {
    lines.push(`| UV Index | ${maxUvIndex.toFixed(1)} |`);
  }
  if (sunrise) {
    lines.push(`| Sunrise | ${sunrise} |`);
  }
  if (sunset) {
    lines.push(`| Sunset | ${sunset} |`);
  }

  return lines.join("\n");
}

export function buildHourlyDetailMarkdown(
  hour: HourlyForecast,
  prefs: Preferences,
): string {
  const lines: string[] = [];
  lines.push(`## ${hour.localTimeLabel}`);
  lines.push(`**${hour.condition}**`);
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(
    `| Temperature | ${formatTemperature(hour.temperatureC, prefs.temperatureUnit)} |`,
  );
  lines.push(
    `| Feels Like | ${formatTemperature(hour.feelsLikeC, prefs.temperatureUnit)} |`,
  );
  lines.push(
    `| Precipitation | ${formatPrecipitation(hour.precipitationMm, prefs.precipitationUnit)} |`,
  );
  if (hour.windSpeedMs !== undefined) {
    lines.push(
      `| Wind | ${formatWindSpeed(hour.windSpeedMs, prefs.windSpeedUnit)} |`,
    );
  }
  if (hour.humidityPct !== undefined) {
    lines.push(`| Humidity | ${Math.round(hour.humidityPct)}% |`);
  }
  if (hour.pressureHpa !== undefined) {
    lines.push(`| Pressure | ${hour.pressureHpa.toFixed(0)} hPa |`);
  }
  if (hour.uvIndex !== undefined) {
    lines.push(`| UV Index | ${hour.uvIndex.toFixed(1)} |`);
  }

  return lines.join("\n");
}
