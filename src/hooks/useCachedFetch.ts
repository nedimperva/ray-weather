import { LocalStorage } from "@raycast/api";
import { useFetch } from "@raycast/utils";
import { useEffect, useMemo, useState } from "react";
import { APP_USER_AGENT } from "../constants";

interface FetchOptions {
  headers?: Record<string, string>;
}

type CachedPayload<T> = {
  data: T;
  updatedAt: string;
};

function cacheKeyForUrl(url: string): string {
  return `cached-fetch:${encodeURIComponent(url)}`;
}

export function useCachedFetch<T>(url: string, options?: FetchOptions) {
  const cacheKey = useMemo(() => cacheKeyForUrl(url), [url]);
  const [cachedPayload, setCachedPayload] = useState<CachedPayload<T>>();
  const result = useFetch<T>(url, {
    keepPreviousData: true,
    headers: {
      "User-Agent": APP_USER_AGENT,
      ...options?.headers,
    },
    parseResponse: async (response) => {
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      return response.json() as Promise<T>;
    },
  });

  useEffect(() => {
    let isMounted = true;
    setCachedPayload(undefined);

    void (async () => {
      const stored = await LocalStorage.getItem<string>(cacheKey);
      if (!stored || !isMounted) return;

      try {
        setCachedPayload(JSON.parse(stored) as CachedPayload<T>);
      } catch {
        // Ignore corrupted cache entries and let the network result win.
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [cacheKey]);

  useEffect(() => {
    if (result.data === undefined) return;

    const payload: CachedPayload<T> = {
      data: result.data,
      updatedAt: new Date().toISOString(),
    };
    setCachedPayload(payload);
    void LocalStorage.setItem(cacheKey, JSON.stringify(payload));
  }, [cacheKey, result.data]);

  const shouldUseFallback =
    result.data === undefined && cachedPayload !== undefined;

  return {
    ...result,
    data: result.data ?? cachedPayload?.data,
    cacheUpdatedAt: cachedPayload?.updatedAt,
    isUsingFallback: shouldUseFallback,
  };
}
