import { LocalStorage } from "@raycast/api";

import { FAVORITE_LOCATIONS_KEY, MENU_BAR_LOCATION_KEY } from "../constants";
import type { Location } from "../types";

function parse<T>(raw: string | undefined): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/**
 * The location single-location commands work on: the pinned one, else the first
 * favorite. Shared by `useDefaultLocation` and by commands that run headless and
 * cannot use hooks.
 */
export async function readDefaultLocation(): Promise<Location | null> {
  const pinned = parse<Location>(
    await LocalStorage.getItem<string>(MENU_BAR_LOCATION_KEY),
  );
  if (pinned) return pinned;

  const favorites = parse<Location[]>(
    await LocalStorage.getItem<string>(FAVORITE_LOCATIONS_KEY),
  );

  return favorites?.[0] ?? null;
}
