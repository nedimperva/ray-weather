import { Color } from "@raycast/api";
import type { DailyForecast, HourlyForecast } from "../types";

export type WeatherDecisionTag = {
  value: string;
  color: Color;
};

export type HourlyPeriod = "Night" | "Morning" | "Afternoon" | "Evening";

export type ShouldIDecision = {
  id: "umbrella" | "jacket" | "walk" | "drive";
  question: string;
  answer: string;
  reason: string;
  color: Color;
};

export type PackingSuggestion = {
  item: string;
  reason: string;
  color: Color;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function firstRainHour(day: DailyForecast): HourlyForecast | undefined {
  return day.hourly.find((hour) => hour.precipitationMm >= 0.1);
}

function hoursInWindow(
  day: DailyForecast,
  startHour: number,
  endHour: number,
): HourlyForecast[] {
  return day.hourly.filter(
    (hour) => hour.hour >= startHour && hour.hour <= endHour,
  );
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
  const rainProbability = day.maxPrecipitationProbabilityPct;

  if (alertCount > 0) {
    tags.push({
      value: alertCount === 1 ? "Weather alert" : `${alertCount} alerts`,
      color: Color.Red,
    });
  }

  if (day.precipitationMm >= 2 || (rainProbability ?? 0) >= 60) {
    tags.push({
      value:
        rainProbability !== undefined
          ? `Rain likely ${Math.round(rainProbability)}%`
          : "Bring umbrella",
      color: Color.Blue,
    });
  } else if (day.precipitationMm >= 0.2 || (rainProbability ?? 0) >= 30) {
    tags.push({
      value:
        rainProbability !== undefined
          ? `Rain ${Math.round(rainProbability)}%`
          : "Rain possible",
      color: Color.Blue,
    });
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

export function buildShouldIDecisions(
  day: DailyForecast,
  maxUvIndex?: number,
  aqi?: number,
  alertCount = 0,
): ShouldIDecision[] {
  const rainyHour = firstRainHour(day);
  const maxWind = Math.max(...day.hourly.map((hour) => hour.windSpeedMs ?? 0));
  const morningLow = Math.min(
    ...hoursInWindow(day, 5, 10).map((hour) => hour.feelsLikeC),
    day.minFeelsLikeC,
  );
  const afternoon = hoursInWindow(day, 12, 18);
  const afternoonRain = afternoon.reduce(
    (total, hour) => total + hour.precipitationMm,
    0,
  );
  const fogRisk = (day.avgFogCoveragePct ?? 0) >= 30;
  const rainProbability = day.maxPrecipitationProbabilityPct;

  const umbrella =
    day.precipitationMm >= 2 ||
    afternoonRain >= 1 ||
    rainyHour !== undefined ||
    (rainProbability ?? 0) >= 60
      ? {
          answer: "Yes",
          reason: rainyHour
            ? `rain starts around ${rainyHour.localTimeLabel}`
            : rainProbability !== undefined
              ? `${Math.round(rainProbability)}% chance of rain`
              : `${day.precipitationMm.toFixed(1)} mm expected`,
          color: Color.Blue,
        }
      : {
          answer: "No",
          reason: "meaningful rain is unlikely",
          color: Color.Green,
        };

  const jacket =
    morningLow <= 8 || day.maxTempC <= 14 || maxWind >= 8
      ? {
          answer: "Yes",
          reason:
            morningLow <= 8
              ? `feels like ${morningLow.toFixed(0)} deg C in the morning`
              : maxWind >= 8
                ? "wind will make it feel cooler"
                : "the day stays cool",
          color: Color.Blue,
        }
      : {
          answer: "No",
          reason: "temperatures should stay comfortable",
          color: Color.Green,
        };

  const walkRisk =
    alertCount > 0 ||
    day.precipitationMm >= 3 ||
    maxWind >= 10 ||
    (maxUvIndex ?? 0) >= 8 ||
    (aqi ?? 0) > 100;
  const walk = walkRisk
    ? {
        answer: "Maybe later",
        reason:
          alertCount > 0
            ? "active weather alert"
            : day.precipitationMm >= 3
              ? "rain may interrupt plans"
              : maxWind >= 10
                ? "wind is high"
                : (aqi ?? 0) > 100
                  ? "air quality is reduced"
                  : "UV is high",
        color: Color.Orange,
      }
    : {
        answer: "Yes",
        reason: "conditions look manageable",
        color: Color.Green,
      };

  const driveRisk =
    alertCount > 0 || fogRisk || maxWind >= 12 || day.precipitationMm >= 5;
  const drive = driveRisk
    ? {
        answer: "Use caution",
        reason:
          alertCount > 0
            ? "active weather alert"
            : fogRisk
              ? "fog coverage is elevated"
              : maxWind >= 12
                ? "strong wind is possible"
                : "heavier rain is possible",
        color: Color.Orange,
      }
    : {
        answer: "Yes",
        reason: "no major driving hazards in the forecast",
        color: Color.Green,
      };

  return [
    {
      id: "umbrella",
      question: "Should I bring an umbrella?",
      ...umbrella,
    },
    {
      id: "jacket",
      question: "Should I wear a jacket?",
      ...jacket,
    },
    {
      id: "walk",
      question: "Good time for a walk?",
      ...walk,
    },
    {
      id: "drive",
      question: "Safe to drive?",
      ...drive,
    },
  ];
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

export function buildPackingSuggestions(
  days: DailyForecast[],
  maxUvByDate = new Map<string, number>(),
  aqi?: number,
  alertCount = 0,
): PackingSuggestion[] {
  const suggestions: PackingSuggestion[] = [];
  const totalRain = days.reduce((total, day) => total + day.precipitationMm, 0);
  const maxRain = Math.max(0, ...days.map((day) => day.precipitationMm));
  const minFeelsLike = Math.min(
    ...days.map((day) => day.minFeelsLikeC),
    Number.POSITIVE_INFINITY,
  );
  const maxTemp = Math.max(...days.map((day) => day.maxTempC), 0);
  const maxWind = Math.max(...days.map((day) => day.avgWindSpeedMs ?? 0), 0);
  const maxUv = Math.max(
    ...days.map((day) => maxUvByDate.get(day.dateKey) ?? 0),
    0,
  );
  const foggyDays = days.filter((day) => (day.avgFogCoveragePct ?? 0) >= 30);

  if (totalRain >= 2 || maxRain >= 1) {
    suggestions.push({
      item: "Umbrella",
      reason: `${totalRain.toFixed(1)} mm rain across the forecast`,
      color: Color.Blue,
    });
    suggestions.push({
      item: "Waterproof layer",
      reason: "rain is likely enough to plan for",
      color: Color.Blue,
    });
  }

  if (minFeelsLike <= 5) {
    suggestions.push({
      item: "Warm jacket",
      reason: `feels like ${minFeelsLike.toFixed(0)} deg C at the low point`,
      color: Color.Blue,
    });
  } else if (minFeelsLike <= 12) {
    suggestions.push({
      item: "Light layers",
      reason: "cooler mornings or evenings are possible",
      color: Color.Green,
    });
  }

  if (maxTemp >= 28) {
    suggestions.push({
      item: "Light clothing",
      reason: `highs may reach ${maxTemp.toFixed(0)} deg C`,
      color: Color.Orange,
    });
  }

  if (maxUv >= 6) {
    suggestions.push({
      item: "Sunscreen",
      reason: `UV may reach ${maxUv.toFixed(0)}`,
      color: Color.Orange,
    });
    suggestions.push({
      item: "Sunglasses",
      reason: "sun exposure may be strong",
      color: Color.Yellow,
    });
  }

  if (maxWind >= 8) {
    suggestions.push({
      item: "Windproof layer",
      reason: `wind may reach ${maxWind.toFixed(1)} m/s`,
      color: Color.Orange,
    });
  }

  if ((aqi ?? 0) > 100) {
    suggestions.push({
      item: "Air quality backup plan",
      reason: `AQI may be unhealthy for sensitive groups`,
      color: Color.Red,
    });
  }

  if (alertCount > 0) {
    suggestions.push({
      item: "Weather alert plan",
      reason: `${alertCount} active alert${alertCount === 1 ? "" : "s"}`,
      color: Color.Red,
    });
  }

  if (foggyDays.length > 0) {
    suggestions.push({
      item: "Extra travel time",
      reason: "fog coverage is elevated on at least one day",
      color: Color.SecondaryText,
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      item: "Normal day bag",
      reason: "conditions look fairly settled",
      color: Color.Green,
    });
  }

  return suggestions;
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
