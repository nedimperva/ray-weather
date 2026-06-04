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

function precipitationFromData(data: {
  next_1_hours?: { details?: { precipitation_amount?: number } };
  next_6_hours?: { details?: { precipitation_amount?: number } };
  next_12_hours?: { details?: { precipitation_amount?: number } };
}): { amountMm: number; windowHours: 1 | 6 | 12 } {
  const next1 = data.next_1_hours?.details?.precipitation_amount;
  if (typeof next1 === "number") {
    return { amountMm: next1, windowHours: 1 };
  }

  const next6 = data.next_6_hours?.details?.precipitation_amount;
  if (typeof next6 === "number") {
    return { amountMm: next6, windowHours: 6 };
  }

  const next12 = data.next_12_hours?.details?.precipitation_amount;
  if (typeof next12 === "number") {
    return { amountMm: next12, windowHours: 12 };
  }

  return { amountMm: 0, windowHours: 1 };
}

function symbolFromData(data: {
  next_1_hours?: { summary?: { symbol_code?: string } };
  next_6_hours?: { summary?: { symbol_code?: string } };
  next_12_hours?: { summary?: { symbol_code?: string } };
}): string {
  return (
    data.next_1_hours?.summary?.symbol_code ??
    data.next_6_hours?.summary?.symbol_code ??
    data.next_12_hours?.summary?.symbol_code ??
    "cloudy"
  );
}

function buildRainWindowSummary(hourly: HourlyForecast[]): string | undefined {
  const rainy = hourly.filter((hour) => hour.precipitationMm >= 0.1);
  if (rainy.length === 0) return undefined;

  const peak = rainy.reduce((max, hour) =>
    hour.precipitationMm > max.precipitationMm ? hour : max,
  );
  const first = rainy[0];
  const last = rainy[rainy.length - 1];
  const label =
    peak.precipitationMm >= 1 ? "Rain likely" : "Light rain possible";

  if (first.localTimeLabel === last.localTimeLabel) {
    return `${label} around ${first.localTimeLabel}`;
  }

  return `${label} ${first.localTimeLabel}-${last.localTimeLabel}, peak ${peak.localTimeLabel}`;
}

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
      minTempTimeLabel?: string;
      maxTempTimeLabel?: string;
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
      fogCoverageTotal: number;
      fogCoverageCount: number;
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
      next_6_hours?: {
        summary?: { symbol_code?: string };
        details?: { precipitation_amount?: number };
      };
      next_12_hours?: {
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
    const localTimeLabel = timeLabelFormatter.format(date);
    const { amountMm: precipitation, windowHours } =
      precipitationFromData(data);
    const symbol = symbolFromData(data);
    const windSpeed = data.instant?.details?.wind_speed as number | undefined;
    const windDirection = data.instant?.details?.wind_from_direction as
      | number
      | undefined;
    const windGust = data.instant?.details?.wind_speed_of_gust as
      | number
      | undefined;
    const humidity = data.instant?.details?.relative_humidity as
      | number
      | undefined;
    const pressure = data.instant?.details?.air_pressure_at_sea_level as
      | number
      | undefined;
    const fogCoverage = data.instant?.details?.fog_area_fraction as
      | number
      | undefined;
    const feelsLikeC = calculateFeelsLikeC(tempC, windSpeed, humidity);

    if (!groupedByDay.has(dayKey)) {
      groupedByDay.set(dayKey, {
        minTempC: tempC,
        maxTempC: tempC,
        minTempTimeLabel: localTimeLabel,
        maxTempTimeLabel: localTimeLabel,
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
        fogCoverageTotal: 0,
        fogCoverageCount: 0,
        uvIndexTotal: 0,
        uvIndexCount: 0,
        hourly: [],
        pressures: [],
      });
    }

    const current = groupedByDay.get(dayKey)!;
    if (tempC < current.minTempC) {
      current.minTempC = tempC;
      current.minTempTimeLabel = localTimeLabel;
    }
    if (tempC > current.maxTempC) {
      current.maxTempC = tempC;
      current.maxTempTimeLabel = localTimeLabel;
    }
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
    if (typeof fogCoverage === "number") {
      current.fogCoverageTotal += fogCoverage;
      current.fogCoverageCount += 1;
    }

    current.symbolCandidates.push({ symbol, hour });
    current.hourly.push({
      id: entry.time,
      localTimeLabel,
      hour,
      temperatureC: tempC,
      precipitationMm: precipitation,
      precipitationWindowHours: windowHours,
      windSpeedMs: windSpeed,
      windDirectionDeg: windDirection,
      windGustMs: windGust,
      humidityPct: humidity,
      pressureHpa: pressure,
      feelsLikeC,
      symbolCode: symbol,
      condition: conditionLabelForSymbol(symbol),
      fogCoveragePct: fogCoverage,
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
    const sortedHourly = current.hourly.sort((a, b) => a.hour - b.hour);
    const avgFogCoveragePct =
      current.fogCoverageCount > 0
        ? current.fogCoverageTotal / current.fogCoverageCount
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
      minTempTimeLabel: current.minTempTimeLabel,
      maxTempTimeLabel: current.maxTempTimeLabel,
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
      avgFogCoveragePct,
      rainWindowSummary: buildRainWindowSummary(sortedHourly),
      hourly: sortedHourly,
    };
  });
}
