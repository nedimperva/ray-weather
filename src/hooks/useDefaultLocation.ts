import { useEffect, useRef, useState } from "react";
import type { Location } from "../types";
import { readDefaultLocation } from "../utils/defaultLocation";

export function useDefaultLocation() {
  const [location, setLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    void (async () => {
      setLocation(await readDefaultLocation());
      setIsLoading(false);
    })();
  }, []);

  return { location, isLoading };
}
