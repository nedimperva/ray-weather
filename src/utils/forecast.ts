import type { DailyForecast, HourlyForecast } from "../types";
import {
  ensureValidTimeZone,
  dateKeyInTimezone,
  localHourInTimezone,
  dateFromDateKey,
} from "./dates";
import { calculateFeelsLikeC, toFahrenheit } from "./temperature";
import { conditionLabelForSymbol } from "./formatting";
import { dayLabelFromIndex } from "./formatting";

export function buildDailyForecast(
  timeseries: Array<{ time: string; data: unknown }>,
  timezone: string,
  maxDays: number,
): DailyForecast[] {
  const safeTimeZone = ensureValidTimeZone(timezone);
  const groupedByDay = new Map<
    string,
    {
      minTempC: number;
      maxTempC: number;
      minFeelsLikeC: number;
      maxFeelsLikeC: number;
      precipitationMm: number;
      symbolCandidates: Array<{ symbol: string; hour: number }>;
      windSpeedTotal: number;
      windSpeedCount: number;
      humidityTotal: number;
      humidityCount: number;
      pressureTotal: number;
      pressureCount: number;
      visibilityTotal: number;
      visibilityCount: number;
      uvIndexTotal: number;
      uvIndexCount: number;
      hourly: HourlyForecast[];
      pressures: number[];
    }
  >();
  const timeLabelFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone,
    hour: "numeric",
    minute: "2-digit",
  });

  for (const entry of timeseries) {
    const data = entry.data as {
      instant?: {
        details?: Record<string, unknown>;
      };
      next_1_hours?: {
        summary?: { symbol_code?: string };
        details?: { precipitation_amount?: number };
      };
    };
    const date = new Date(entry.time);
    if (Number.isNaN(date.getTime())) continue;

    const tempC = data?.instant?.details?.air_temperature as number | undefined;
    if (typeof tempC !== "number") continue;

    const dayKey = dateKeyInTimezone(date, safeTimeZone);
    const hour = localHourInTimezone(date, safeTimeZone);
    const precipitation =
      (data.next_1_hours?.details?.precipitation_amount as number) ?? 0;
    const symbol =
      (data.next_1_hours?.summary?.symbol_code as string) ?? "cloudy";
    const windSpeed = data.instant?.details?.wind_speed as number | undefined;
    const humidity = data.instant?.details?.relative_humidity as
      | number
      | undefined;
    const pressure = data.instant?.details?.air_pressure_at_sea_level as
      | number
      | undefined;
    const visibility = data.instant?.details?.fog_area_fraction as
      | number
      | undefined;
    const feelsLikeC = calculateFeelsLikeC(tempC, windSpeed, humidity);

    if (!groupedByDay.has(dayKey)) {
      groupedByDay.set(dayKey, {
        minTempC: tempC,
        maxTempC: tempC,
        minFeelsLikeC: feelsLikeC,
        maxFeelsLikeC: feelsLikeC,
        precipitationMm: 0,
        symbolCandidates: [],
        windSpeedTotal: 0,
        windSpeedCount: 0,
        humidityTotal: 0,
        humidityCount: 0,
        pressureTotal: 0,
        pressureCount: 0,
        visibilityTotal: 0,
        visibilityCount: 0,
        uvIndexTotal: 0,
        uvIndexCount: 0,
        hourly: [],
        pressures: [],
      });
    }

    const current = groupedByDay.get(dayKey)!;
    current.minTempC = Math.min(current.minTempC, tempC);
    current.maxTempC = Math.max(current.maxTempC, tempC);
    current.minFeelsLikeC = Math.min(current.minFeelsLikeC, feelsLikeC);
    current.maxFeelsLikeC = Math.max(current.maxFeelsLikeC, feelsLikeC);
    current.precipitationMm += precipitation;
    if (typeof windSpeed === "number") {
      current.windSpeedTotal += windSpeed;
      current.windSpeedCount += 1;
    }
    if (typeof humidity === "number") {
      current.humidityTotal += humidity;
      current.humidityCount += 1;
    }
    if (typeof pressure === "number") {
      current.pressureTotal += pressure;
      current.pressureCount += 1;
      current.pressures.push(pressure);
    }
    if (typeof visibility === "number") {
      current.visibilityTotal += visibility;
      current.visibilityCount += 1;
    }

    current.symbolCandidates.push({ symbol, hour });
    current.hourly.push({
      id: entry.time,
      localTimeLabel: timeLabelFormatter.format(date),
      hour,
      temperatureC: tempC,
      precipitationMm: precipitation,
      windSpeedMs: windSpeed,
      humidityPct: humidity,
      pressureHpa: pressure,
      feelsLikeC,
      symbolCode: symbol,
      condition: conditionLabelForSymbol(symbol),
      visibilityKm:
        visibility !== undefined ? (1 - visibility) * 10 : undefined,
    });
  }

  const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone,
    weekday: "long",
  });
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone,
    month: "short",
    day: "numeric",
  });
  const orderedDays = [...groupedByDay.keys()].sort().slice(0, maxDays);

  return orderedDays.map((dayKey, index) => {
    const current = groupedByDay.get(dayKey)!;
    const date = dateFromDateKey(dayKey);
    const weekday = weekdayFormatter.format(date);
    const shortDate = dateFormatter.format(date);
    const dayAndDate = `${weekday}, ${shortDate}`;
    const preferredSymbol = [...current.symbolCandidates].sort((a, b) => {
      const noonDistanceA = Math.abs(a.hour - 12);
      const noonDistanceB = Math.abs(b.hour - 12);
      return noonDistanceA - noonDistanceB;
    })[0]?.symbol;
    const symbolCode = preferredSymbol ?? "cloudy";
    const condition = conditionLabelForSymbol(symbolCode);
    const avgWindSpeedMs =
      current.windSpeedCount > 0
        ? current.windSpeedTotal / current.windSpeedCount
        : undefined;
    const avgHumidityPct =
      current.humidityCount > 0
        ? current.humidityTotal / current.humidityCount
        : undefined;
    const avgPressureHpa =
      current.pressureCount > 0
        ? current.pressureTotal / current.pressureCount
        : undefined;
    const avgVisibilityKm =
      current.visibilityCount > 0
        ? (1 - current.visibilityTotal / current.visibilityCount) * 10
        : undefined;

    let pressureTrend: "rising" | "falling" | "stable" = "stable";
    if (current.pressures.length >= 3) {
      const firstHalf = current.pressures.slice(
        0,
        Math.floor(current.pressures.length / 2),
      );
      const secondHalf = current.pressures.slice(
        Math.floor(current.pressures.length / 2),
      );
      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond =
        secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      const diff = avgSecond - avgFirst;
      if (diff > 1) pressureTrend = "rising";
      else if (diff < -1) pressureTrend = "falling";
    }

    return {
      dateKey: dayKey,
      label: dayLabelFromIndex(index, weekday),
      shortDate,
      dayAndDate,
      minTempC: current.minTempC,
      maxTempC: current.maxTempC,
      minFeelsLikeC: current.minFeelsLikeC,
      maxFeelsLikeC: current.maxFeelsLikeC,
      minTempF: toFahrenheit(current.minTempC),
      maxTempF: toFahrenheit(current.maxTempC),
      precipitationMm: current.precipitationMm,
      symbolCode,
      condition,
      avgWindSpeedMs,
      avgHumidityPct,
      avgPressureHpa,
      pressureTrend,
      avgVisibilityKm,
      hourly: current.hourly.sort((a, b) => a.hour - b.hour),
    };
  });
}
