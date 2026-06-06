import { List } from "@raycast/api";
import { useMemo, useState, type ComponentProps } from "react";
import type { Location } from "../types";
import { displayLocationName } from "../utils/formatting";
import { useDefaultLocation } from "./useDefaultLocation";
import { useFavoriteLocations } from "./useFavoriteLocations";

export type SearchBarDropdown = ComponentProps<
  typeof List
>["searchBarAccessory"];

type LocationSwitcher = {
  location: Location | null;
  isLoading: boolean;
  /** A List.Dropdown for the search bar, or undefined when there is nothing to switch between. */
  dropdown: SearchBarDropdown;
};

/**
 * Lets single-location commands switch which favorite they are viewing without
 * changing the pinned menu-bar location. Returns a dropdown to drop into the
 * command's List `searchBarAccessory`.
 */
export function useLocationSwitcher(): LocationSwitcher {
  const { location: defaultLocation, isLoading } = useDefaultLocation();
  const { favorites } = useFavoriteLocations();
  const [selectedId, setSelectedId] = useState<string>();

  const options = useMemo(() => {
    const list: Location[] = [];
    const seen = new Set<string>();
    for (const candidate of [defaultLocation, ...favorites]) {
      if (candidate && !seen.has(candidate.id)) {
        seen.add(candidate.id);
        list.push(candidate);
      }
    }
    return list;
  }, [defaultLocation, favorites]);

  const location =
    options.find((option) => option.id === selectedId) ??
    defaultLocation ??
    options[0] ??
    null;

  const dropdown =
    options.length > 1 ? (
      <List.Dropdown
        tooltip="Location"
        value={location?.id}
        onChange={setSelectedId}
      >
        {options.map((option) => (
          <List.Dropdown.Item
            key={option.id}
            value={option.id}
            title={displayLocationName(option)}
          />
        ))}
      </List.Dropdown>
    ) : undefined;

  return { location, isLoading, dropdown };
}
