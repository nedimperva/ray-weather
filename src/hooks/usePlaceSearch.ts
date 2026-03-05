import { useMemo } from "react";
import { useFetch } from "@raycast/utils";
import type { GeocodeApiResponse } from "../types";
import { GEOCODE_API } from "../constants";
import { ensureValidTimeZone, normalizeLocationId } from "../utils/dates";
import { useDebouncedValue } from "./useDebouncedValue";

export function usePlaceSearch(searchText: string) {
  const debouncedText = useDebouncedValue(searchText, 250);
  const query = debouncedText.trim();
  const shouldFetch = query.length >= 2;
  const url = useMemo(
    () =>
      `${GEOCODE_API}?name=${encodeURIComponent(query)}&count=8&language=en&format=json`,
    [query],
  );

  return useFetch(url, {
    execute: shouldFetch,
    keepPreviousData: true,
    parseResponse: async (response) => {
      if (!response.ok) {
        throw new Error(`Geocoding failed (${response.status})`);
      }

      const payload = (await response.json()) as GeocodeApiResponse;
      const locations = payload.results ?? [];

      return locations.map((location) => ({
        id: normalizeLocationId({
          name: location.name,
          latitude: location.latitude,
          longitude: location.longitude,
        }),
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        country: location.country,
        region: location.admin1,
        timezone: ensureValidTimeZone(location.timezone),
      }));
    },
  });
}
