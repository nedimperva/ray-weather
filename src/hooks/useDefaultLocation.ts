import { LocalStorage } from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import type { Location } from "../types";
import { FAVORITE_LOCATIONS_KEY, MENU_BAR_LOCATION_KEY } from "../constants";

export function useDefaultLocation() {
  const [location, setLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    void (async () => {
      const pinned = await LocalStorage.getItem<string>(MENU_BAR_LOCATION_KEY);
      if (pinned) {
        try {
          setLocation(JSON.parse(pinned) as Location);
          setIsLoading(false);
          return;
        } catch {
          // fall through to favorites
        }
      }

      const favorites = await LocalStorage.getItem<string>(
        FAVORITE_LOCATIONS_KEY,
      );
      if (favorites) {
        try {
          const parsed = JSON.parse(favorites) as Location[];
          if (parsed.length > 0) {
            setLocation(parsed[0]);
            setIsLoading(false);
            return;
          }
        } catch {
          // fall through to no location
        }
      }

      setIsLoading(false);
    })();
  }, []);

  return { location, isLoading };
}
