import { useMemo } from "react";
import type { Location } from "../types";
import { AIR_QUALITY_API } from "../constants";
import { useCachedFetch } from "./useCachedFetch";

export function useAirQuality(location: Location) {
  const url = useMemo(
    () =>
      `${AIR_QUALITY_API}?latitude=${location.latitude}&longitude=${location.longitude}&hourly=us_aqi,pm10,pm2_5,ozone,nitrogen_dioxide,carbon_monoxide&forecast_days=1&timeformat=unixtime`,
    [location.latitude, location.longitude],
  );

  return useCachedFetch<{
    hourly?: {
      time?: number[];
      us_aqi?: number[];
      pm10?: number[];
      pm2_5?: number[];
      ozone?: number[];
      nitrogen_dioxide?: number[];
      carbon_monoxide?: number[];
    };
  }>(url);
}
