import { useMemo } from "react";
import type { Location } from "../types";
import { UV_INDEX_API } from "../constants";
import { useCachedFetch } from "./useCachedFetch";

export type UVIndexData = {
  hourly?: {
    time?: string[];
    uv_index?: number[];
  };
};

export function useUVIndex(location: Location, forecastDays: number) {
  const url = useMemo(
    () =>
      `${UV_INDEX_API}?latitude=${location.latitude}&longitude=${location.longitude}&hourly=uv_index&forecast_days=${forecastDays}&timezone=${encodeURIComponent(location.timezone)}`,
    [location.latitude, location.longitude, location.timezone, forecastDays],
  );

  return useCachedFetch<UVIndexData>(url);
}
