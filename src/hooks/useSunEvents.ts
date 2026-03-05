import { useMemo } from "react";
import type { Location, MetNoSunResponse } from "../types";
import { MET_NO_SUNRISE_API } from "../constants";
import { useCachedFetch } from "./useCachedFetch";

export function useSunEvents(location: Location, dateKey: string) {
  const url = useMemo(
    () =>
      `${MET_NO_SUNRISE_API}?lat=${location.latitude.toFixed(4)}&lon=${location.longitude.toFixed(4)}&date=${dateKey}`,
    [location.latitude, location.longitude, dateKey],
  );

  return useCachedFetch<MetNoSunResponse>(url);
}
