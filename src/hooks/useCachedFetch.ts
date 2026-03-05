import { useFetch } from "@raycast/utils";
import { APP_USER_AGENT } from "../constants";

interface FetchOptions {
  headers?: Record<string, string>;
}

export function useCachedFetch<T>(url: string, options?: FetchOptions) {
  return useFetch<T>(url, {
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
}
