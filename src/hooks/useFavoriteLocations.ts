import { showToast, Toast } from "@raycast/api";
import { useCallback } from "react";
import type { Location } from "../types";
import { FAVORITE_LOCATIONS_KEY, MAX_FAVORITES } from "../constants";
import { useLocalStorage } from "./useLocalStorage";

export function useFavoriteLocations() {
  const [favorites, setFavorites] = useLocalStorage<Location[]>(
    FAVORITE_LOCATIONS_KEY,
    [],
  );

  const addFavorite = useCallback(
    (location: Location) => {
      if (!favorites.find((f) => f.id === location.id)) {
        const newFavorites = [...favorites, location].slice(0, MAX_FAVORITES);
        setFavorites(newFavorites);
        void showToast({
          style: Toast.Style.Success,
          title: `Added ${location.name} to favorites`,
        });
      }
    },
    [favorites, setFavorites],
  );

  const removeFavorite = useCallback(
    (locationId: string) => {
      setFavorites(favorites.filter((f) => f.id !== locationId));
      void showToast({
        style: Toast.Style.Success,
        title: "Removed from favorites",
      });
    },
    [favorites, setFavorites],
  );

  const isFavorite = useCallback(
    (locationId: string) => {
      return favorites.some((f) => f.id === locationId);
    },
    [favorites],
  );

  return { favorites, addFavorite, removeFavorite, isFavorite };
}
