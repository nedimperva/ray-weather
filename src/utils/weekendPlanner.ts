import type { DailyForecast } from "../types";
import { dateFromDateKey } from "./dates";
import { buildComfortScore } from "./weatherInsights";

export type WeekendDayScore = {
  day: DailyForecast;
  maxUvIndex?: number;
  aqi?: number;
  alertCount: number;
  comfortScore: number;
};

export type WeekendPlan = {
  weekendDays: DailyForecast[];
  isFallbackWeekend: boolean;
  scoredWeekendDays: WeekendDayScore[];
  bestDay?: WeekendDayScore;
  otherDay?: WeekendDayScore;
};

export function weekdayIndex(day: DailyForecast): number {
  return dateFromDateKey(day.dateKey).getUTCDay();
}

export function weekendDaysFromForecast(
  days: DailyForecast[],
): DailyForecast[] {
  const saturday = days.find((day) => weekdayIndex(day) === 6);
  const sundayAfterSaturday = saturday
    ? days.find(
        (day) => day.dateKey > saturday.dateKey && weekdayIndex(day) === 0,
      )
    : undefined;

  if (saturday && sundayAfterSaturday) return [saturday, sundayAfterSaturday];
  const availableWeekendDays = days
    .filter((day) => [0, 6].includes(weekdayIndex(day)))
    .slice(0, 2);

  return availableWeekendDays.length > 0
    ? availableWeekendDays
    : days.slice(0, 2);
}

export function reasonForPick(
  winner: DailyForecast,
  other: DailyForecast,
  winnerScore: number,
  otherScore: number,
): string {
  const reasons: string[] = [
    `${winnerScore - otherScore} comfort points higher`,
  ];

  if (winner.precipitationMm < other.precipitationMm) reasons.push("less rain");
  if ((winner.avgWindSpeedMs ?? 0) < (other.avgWindSpeedMs ?? 0)) {
    reasons.push("lighter wind");
  }
  if (winner.maxTempC > other.maxTempC && other.maxTempC < 10) {
    reasons.push("warmer");
  }
  if (winner.maxTempC < other.maxTempC && other.maxTempC > 28) {
    reasons.push("less hot");
  }

  return reasons.join(", ");
}

export function buildWeekendPlan(
  days: DailyForecast[],
  options: {
    aqiForDate?: (dateKey: string) => number | undefined;
    alertCountForDate?: (dateKey: string) => number;
  } = {},
): WeekendPlan {
  const weekendDays = weekendDaysFromForecast(days);
  const isFallbackWeekend = weekendDays.some(
    (day) => ![0, 6].includes(weekdayIndex(day)),
  );
  const scoredWeekendDays = weekendDays.map((day) => {
    const maxUvIndex = day.maxUvIndex;
    const aqi = options.aqiForDate?.(day.dateKey);
    const alertCount = options.alertCountForDate?.(day.dateKey) ?? 0;

    return {
      day,
      maxUvIndex,
      aqi,
      alertCount,
      comfortScore: buildComfortScore(day, maxUvIndex, aqi, alertCount),
    };
  });
  const [bestDay, otherDay] = [...scoredWeekendDays].sort(
    (a, b) => b.comfortScore - a.comfortScore,
  );

  return {
    weekendDays,
    isFallbackWeekend,
    scoredWeekendDays,
    bestDay,
    otherDay,
  };
}
