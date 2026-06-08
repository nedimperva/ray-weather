import { LocalStorage } from "@raycast/api";
import { useFetch } from "@raycast/utils";
import { useEffect, useMemo, useState } from "react";
import {
  APP_USER_AGENT,
  CACHE_KEY_PREFIX,
  CACHE_MAX_AGE_MS,
  CACHE_STALE_AFTER_MS,
  MAX_CACHE_ENTRIES,
} from "../constants";

interface FetchOptions {
  headers?: Record<string, string>;
  execute?: boolean;
}

type CachedPayload<T> = {
  data: T;
  updatedAt: string;
};

function cacheKeyForUrl(url: string): string {
  return `${CACHE_KEY_PREFIX}${encodeURIComponent(url)}`;
}

// Throttle pruning so it runs at most once every few minutes rather than on
// every successful fetch.
let lastPruneAt = 0;
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;

async function pruneCache(): Promise<void> {
  const now = Date.now();
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;

  try {
    const all = await LocalStorage.allItems();
    const entries: Array<{ key: string; time: number }> = [];

    for (const [key, value] of Object.entries(all)) {
      if (!key.startsWith(CACHE_KEY_PREFIX)) continue;
      let time = 0;
      try {
        time = new Date(
          (JSON.parse(value as string) as CachedPayload<unknown>).updatedAt,
        ).getTime();
      } catch {
        // Treat unparseable entries as ancient so they get evicted first.
      }
      entries.push({ key, time: Number.isNaN(time) ? 0 : time });
    }

    const expired = entries.filter(
      (entry) => now - entry.time > CACHE_MAX_AGE_MS,
    );
    const fresh = entries.filter(
      (entry) => now - entry.time <= CACHE_MAX_AGE_MS,
    );
    const overflow = fresh
      .sort((a, b) => a.time - b.time)
      .slice(0, Math.max(0, fresh.length - MAX_CACHE_ENTRIES));

    await Promise.all(
      [...expired, ...overflow].map((entry) =>
        LocalStorage.removeItem(entry.key),
      ),
    );
  } catch {
    // Pruning is best-effort; ignore storage errors.
  }
}

export function useCachedFetch<T>(url: string, options?: FetchOptions) {
  const cacheKey = useMemo(() => cacheKeyForUrl(url), [url]);
  const [cachedPayload, setCachedPayload] = useState<CachedPayload<T>>();
  const shouldExecute = options?.execute ?? true;
  const result = useFetch<T>(url, {
    execute: shouldExecute,
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
    if (!shouldExecute) {
      setCachedPayload(undefined);
      return;
    }

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
  }, [cacheKey, shouldExecute]);

  useEffect(() => {
    if (!shouldExecute) return;
    if (result.data === undefined) return;

    const payload: CachedPayload<T> = {
      data: result.data,
      updatedAt: new Date().toISOString(),
    };
    setCachedPayload(payload);
    void LocalStorage.setItem(cacheKey, JSON.stringify(payload));
    void pruneCache();
  }, [cacheKey, result.data, shouldExecute]);

  const shouldUseFallback =
    result.data === undefined && cachedPayload !== undefined;
  const cacheAgeMs = cachedPayload
    ? Date.now() - new Date(cachedPayload.updatedAt).getTime()
    : undefined;

  return {
    ...result,
    data: result.data ?? cachedPayload?.data,
    cacheUpdatedAt: cachedPayload?.updatedAt,
    isUsingFallback: shouldUseFallback,
    isStale:
      shouldUseFallback &&
      cacheAgeMs !== undefined &&
      cacheAgeMs > CACHE_STALE_AFTER_MS,
  };
}
