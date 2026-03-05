import { showToast, Toast } from "@raycast/api";
import { useCallback } from "react";
import type { Location } from "../types";
import { SEARCH_HISTORY_KEY, MAX_HISTORY_ITEMS } from "../constants";
import { useLocalStorage } from "./useLocalStorage";

export function useSearchHistory() {
  const [history, setHistory] = useLocalStorage<Location[]>(
    SEARCH_HISTORY_KEY,
    [],
  );

  const addToHistory = useCallback(
    (location: Location) => {
      const filtered = history.filter((h) => h.id !== location.id);
      const newHistory = [location, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      setHistory(newHistory);
    },
    [history, setHistory],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    void showToast({
      style: Toast.Style.Success,
      title: "Search history cleared",
    });
  }, [setHistory]);

  return { history, addToHistory, clearHistory };
}
