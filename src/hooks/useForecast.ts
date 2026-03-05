import { useMemo } from "react";
import type { Location, MetNoForecastResponse } from "../types";
import { MET_NO_FORECAST_API } from "../constants";
import { useCachedFetch } from "./useCachedFetch";

export function useForecast(location: Location) {
  const url = useMemo(
    () =>
      `${MET_NO_FORECAST_API}?lat=${location.latitude.toFixed(4)}&lon=${location.longitude.toFixed(4)}`,
    [location.latitude, location.longitude],
  );

  return useCachedFetch<MetNoForecastResponse>(url);
}
