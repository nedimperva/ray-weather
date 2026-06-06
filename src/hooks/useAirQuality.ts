import { useMemo } from "react";
import type { Location } from "../types";
import { AIR_QUALITY_API, MAX_AIR_QUALITY_DAYS } from "../constants";
import { useCachedFetch } from "./useCachedFetch";

export type AirQualityResponse = {
  hourly?: {
    time?: string[];
    us_aqi?: number[];
    pm10?: number[];
    pm2_5?: number[];
    ozone?: number[];
    nitrogen_dioxide?: number[];
    carbon_monoxide?: number[];
  };
};

export function useAirQuality(location: Location, days = 1) {
  const forecastDays = Math.min(Math.max(days, 1), MAX_AIR_QUALITY_DAYS);
  const url = useMemo(
    () =>
      `${AIR_QUALITY_API}?latitude=${location.latitude}&longitude=${location.longitude}&hourly=us_aqi,pm10,pm2_5,ozone,nitrogen_dioxide,carbon_monoxide&forecast_days=${forecastDays}&timezone=${encodeURIComponent(location.timezone)}`,
    [location.latitude, location.longitude, location.timezone, forecastDays],
  );

  return useCachedFetch<AirQualityResponse>(url);
}
