import { Color } from "@raycast/api";
import type { DailyForecast, HourlyForecast } from "../types";

export type WeatherDecisionTag = {
  value: string;
  color: Color;
};

export type HourlyPeriod = "Night" | "Morning" | "Afternoon" | "Evening";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function firstRainHour(day: DailyForecast): HourlyForecast | undefined {
  return day.hourly.find((hour) => hour.precipitationMm >= 0.1);
}

export function getCurrentHour(day: DailyForecast): HourlyForecast | undefined {
  return day.hourly[0];
}

export function buildDecisionTags(
  day: DailyForecast,
  maxUvIndex?: number,
  alertCount = 0,
): WeatherDecisionTag[] {
  const tags: WeatherDecisionTag[] = [];
  const rainHour = firstRainHour(day);

  if (alertCount > 0) {
    tags.push({
      value: alertCount === 1 ? "Weather alert" : `${alertCount} alerts`,
      color: Color.Red,
    });
  }

  if (day.precipitationMm >= 2) {
    tags.push({ value: "Bring umbrella", color: Color.Blue });
  } else if (day.precipitationMm >= 0.2) {
    tags.push({ value: "Rain possible", color: Color.Blue });
  }

  if (rainHour) {
    tags.push({
      value: `Rain after ${rainHour.localTimeLabel}`,
      color: Color.Blue,
    });
  }

  if (day.avgWindSpeedMs !== undefined && day.avgWindSpeedMs >= 10) {
    tags.push({ value: "Windy", color: Color.Red });
  } else if (day.avgWindSpeedMs !== undefined && day.avgWindSpeedMs >= 6) {
    tags.push({ value: "Breezy", color: Color.Orange });
  }

  if (maxUvIndex !== undefined && maxUvIndex >= 6) {
    tags.push({ value: "High UV", color: Color.Orange });
  } else if (maxUvIndex !== undefined && maxUvIndex >= 3) {
    tags.push({ value: "Moderate UV", color: Color.Yellow });
  }

  if (day.minTempC <= 5) {
    tags.push({ value: "Cold morning", color: Color.Blue });
  }

  if (day.maxTempC >= 28) {
    tags.push({ value: "Hot afternoon", color: Color.Red });
  }

  if (day.avgFogCoveragePct !== undefined && day.avgFogCoveragePct >= 30) {
    tags.push({ value: "Foggy", color: Color.SecondaryText });
  }

  if (
    tags.length === 0 &&
    day.maxTempC >= 10 &&
    day.maxTempC <= 26 &&
    day.precipitationMm < 0.2 &&
    (day.avgWindSpeedMs ?? 0) < 6 &&
    (maxUvIndex ?? 0) < 6
  ) {
    tags.push({ value: "Great outside", color: Color.Green });
  }

  if (tags.length === 0) {
    tags.push({ value: "Calm", color: Color.Green });
  }

  return tags.slice(0, 4);
}

export function buildComfortScore(
  day: DailyForecast,
  maxUvIndex?: number,
  aqi?: number,
  alertCount = 0,
): number {
  let score = 100;
  const comfortTemp = 19;

  score -= Math.abs(day.maxTempC - comfortTemp) * 2;
  score -= Math.min(day.precipitationMm * 5, 30);
  score -= Math.max((day.avgWindSpeedMs ?? 0) - 4, 0) * 3;
  score -= Math.max((maxUvIndex ?? 0) - 5, 0) * 4;
  score -= Math.max((aqi ?? 0) - 50, 0) / 5;
  score -= Math.min(alertCount * 15, 30);
  score -= Math.max((day.avgFogCoveragePct ?? 0) - 30, 0) / 2;

  return Math.round(clamp(score, 0, 100));
}

export function buildPersonalitySummary(
  day: DailyForecast,
  maxUvIndex?: number,
): string {
  if (day.precipitationMm >= 5) return "Wet and unsettled";
  if ((day.avgWindSpeedMs ?? 0) >= 10) return "Windy and exposed";
  if (day.maxTempC <= 5) return "Cold and crisp";
  if (day.maxTempC >= 28) return "Hot and bright";
  if ((maxUvIndex ?? 0) >= 6) return "Bright with strong sun";
  if (day.precipitationMm >= 0.2) return "Patchy rain";
  if ((day.avgWindSpeedMs ?? 0) < 4 && day.precipitationMm < 0.2) {
    return "Calm and settled";
  }
  return day.condition;
}

export function buildTrendSummary(
  day: DailyForecast,
  previousDay?: DailyForecast,
  nextDay?: DailyForecast,
): string | undefined {
  if (previousDay) {
    const tempDiff = day.maxTempC - previousDay.maxTempC;
    const rainDiff = day.precipitationMm - previousDay.precipitationMm;

    if (tempDiff >= 3) return "Warmer than previous day";
    if (tempDiff <= -3) return "Cooler than previous day";
    if (rainDiff >= 2) return "Rainier than previous day";
    if (rainDiff <= -2) return "Drier than previous day";
  }

  if (nextDay) {
    const tempDiff = day.maxTempC - nextDay.maxTempC;
    const rainDiff = day.precipitationMm - nextDay.precipitationMm;

    if (tempDiff >= 3) return "Warmer than tomorrow";
    if (tempDiff <= -3) return "Cooler than tomorrow";
    if (rainDiff >= 2) return "Rainier than tomorrow";
    if (rainDiff <= -2) return "Drier than tomorrow";
  }

  return undefined;
}

export function periodForHour(hour: number): HourlyPeriod {
  if (hour < 6) return "Night";
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

export function groupHourlyByPeriod(hourly: HourlyForecast[]) {
  const groups: Record<HourlyPeriod, HourlyForecast[]> = {
    Night: [],
    Morning: [],
    Afternoon: [],
    Evening: [],
  };

  for (const hour of hourly) {
    groups[periodForHour(hour.hour)].push(hour);
  }

  return groups;
}

export function formatWindDirection(degrees?: number): string | undefined {
  if (degrees === undefined) return undefined;
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(degrees / 45) % directions.length;
  return directions[index];
}
