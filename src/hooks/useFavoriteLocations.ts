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

  const moveFavorite = useCallback(
    (locationId: string, direction: "up" | "down") => {
      const currentIndex = favorites.findIndex((f) => f.id === locationId);
      if (currentIndex === -1) return;

      const nextIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= favorites.length) return;

      const nextFavorites = [...favorites];
      const [favorite] = nextFavorites.splice(currentIndex, 1);
      if (!favorite) return;
      nextFavorites.splice(nextIndex, 0, favorite);
      setFavorites(nextFavorites);
    },
    [favorites, setFavorites],
  );

  const moveFavoriteToTop = useCallback(
    (locationId: string) => {
      const currentIndex = favorites.findIndex((f) => f.id === locationId);
      if (currentIndex <= 0) return;

      const nextFavorites = [...favorites];
      const [favorite] = nextFavorites.splice(currentIndex, 1);
      if (!favorite) return;
      nextFavorites.unshift(favorite);
      setFavorites(nextFavorites);
    },
    [favorites, setFavorites],
  );

  const clearFavorites = useCallback(() => {
    setFavorites([]);
    void showToast({
      style: Toast.Style.Success,
      title: "Favorites cleared",
    });
  }, [setFavorites]);

  const isFavorite = useCallback(
    (locationId: string) => {
      return favorites.some((f) => f.id === locationId);
    },
    [favorites],
  );

  return {
    favorites,
    addFavorite,
    removeFavorite,
    moveFavorite,
    moveFavoriteToTop,
    clearFavorites,
    isFavorite,
  };
}
