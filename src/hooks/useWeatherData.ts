import { useMemo } from "react";
import type { DailyForecast, Location, WeatherAlert } from "../types";
import { getForecastDays } from "../preferences";
import { buildDailyForecast } from "../utils/forecast";
import { alertCountForDate, parseWeatherAlerts } from "../utils/alerts";
import { useForecast } from "./useForecast";
import { useWeatherAlerts } from "./useWeatherAlerts";
import { useAirQuality } from "./useAirQuality";

export type WeatherData = {
  days: DailyForecast[];
  today?: DailyForecast;
  alerts: WeatherAlert[];
  /** Number of active alerts whose time window covers the given local date. */
  alertCountForDate: (dateKey: string) => number;
  /** AQI sample nearest the start of the available data (roughly "now"). */
  currentAqi?: number;
  /** Highest AQI sampled on the given local date, falling back to currentAqi. */
  aqiForDate: (dateKey: string) => number | undefined;
  isLoading: boolean;
  error?: Error;
  forecastUpdatedAt?: string;
  isUsingFallback: boolean;
  isStale: boolean;
  cacheUpdatedAt?: string;
  aqiUsingFallback: boolean;
  aqiCacheUpdatedAt?: string;
  revalidate: () => void;
  revalidateAqi: () => void;
};

/**
 * Single source of truth for a location's weather: the daily forecast (with UV
 * and precipitation probability derived from the met.no "complete" feed), active
 * alerts mapped to the days they cover, and air quality sampled per day. Commands
 * consume this instead of wiring up four hooks and rebuilding the same maps.
 */
export function useWeatherData(
  location: Location,
  options?: { days?: number },
): WeatherData {
  const forecastDays = options?.days ?? getForecastDays();
  const {
    data,
    error,
    isLoading,
    isUsingFallback,
    isStale,
    cacheUpdatedAt,
    revalidate,
  } = useForecast(location);
  const { data: alertsData, isLoading: isAlertsLoading } =
    useWeatherAlerts(location);
  const {
    data: airQualityData,
    isLoading: isAirQualityLoading,
    isUsingFallback: aqiUsingFallback,
    cacheUpdatedAt: aqiCacheUpdatedAt,
    revalidate: revalidateAqi,
  } = useAirQuality(location, forecastDays);

  const days = useMemo(() => {
    try {
      const timeseries = data?.properties?.timeseries ?? [];
      return buildDailyForecast(
        timeseries as Array<{ time: string; data: unknown }>,
        location.timezone,
        forecastDays,
      );
    } catch {
      return [];
    }
  }, [data, forecastDays, location.timezone]);

  const alerts = useMemo(() => parseWeatherAlerts(alertsData), [alertsData]);

  const aqiByDate = useMemo(() => {
    const map = new Map<string, number>();
    const times = airQualityData?.hourly?.time ?? [];
    const values = airQualityData?.hourly?.us_aqi ?? [];
    for (let i = 0; i < times.length; i++) {
      const time = times[i];
      const value = values[i];
      if (time && value !== undefined) {
        const dateKey = time.slice(0, 10);
        const current = map.get(dateKey);
        if (current === undefined || value > current) map.set(dateKey, value);
      }
    }
    return map;
  }, [airQualityData]);

  const currentAqi = useMemo(() => {
    const values = airQualityData?.hourly?.us_aqi ?? [];
    return values.find((value) => value !== undefined);
  }, [airQualityData]);

  const timeZone = location.timezone;
  const alertCountForDateFn = useMemo(
    () => (dateKey: string) => alertCountForDate(alerts, dateKey, timeZone),
    [alerts, timeZone],
  );
  const aqiForDateFn = useMemo(
    () => (dateKey: string) => aqiByDate.get(dateKey) ?? currentAqi,
    [aqiByDate, currentAqi],
  );

  return {
    days,
    today: days[0],
    alerts,
    alertCountForDate: alertCountForDateFn,
    currentAqi,
    aqiForDate: aqiForDateFn,
    isLoading: isLoading || isAlertsLoading || isAirQualityLoading,
    error,
    forecastUpdatedAt: data?.properties?.meta?.updated_at,
    isUsingFallback,
    isStale: isStale ?? false,
    cacheUpdatedAt,
    aqiUsingFallback,
    aqiCacheUpdatedAt,
    revalidate,
    revalidateAqi,
  };
}
