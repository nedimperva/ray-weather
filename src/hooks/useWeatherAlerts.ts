import { useMemo } from "react";
import type { Location } from "../types";
import { MET_NO_ALERTS_API } from "../constants";
import { useCachedFetch } from "./useCachedFetch";

export function useWeatherAlerts(location: Location) {
  const url = useMemo(
    () =>
      `${MET_NO_ALERTS_API}?lat=${location.latitude}&lon=${location.longitude}`,
    [location.latitude, location.longitude],
  );

  return useCachedFetch<{
    features?: Array<{
      properties?: {
        event?: string;
        headline?: string;
        description?: string;
        severity?: string;
        area?: string;
      };
    }>;
  }>(url);
}
