import { LocalStorage } from "@raycast/api";
import { useEffect, useState, useCallback, useRef } from "react";

export function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    void (async () => {
      const saved = await LocalStorage.getItem<string>(key);
      if (saved) {
        try {
          setValue(JSON.parse(saved));
        } catch {
          // keep default value
        }
      }
    })();
  }, [key]);

  const updateValue = useCallback(
    (newValue: T) => {
      setValue(newValue);
      void LocalStorage.setItem(key, JSON.stringify(newValue));
    },
    [key],
  );

  return [value, updateValue] as const;
}
