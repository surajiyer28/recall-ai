import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

interface UseApiOptions {
  /** Re-fetch on this interval (ms) in the background. */
  pollingIntervalMs?: number;
}

export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options?: UseApiOptions
) {
  const { pollingIntervalMs } = options ?? {};

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);   // true only on initial load
  const [refreshing, setRefreshing] = useState(false); // true on background refresh
  const [error, setError] = useState<string | null>(null);

  // Stable fetch function — background=true means silent refresh (no loading spinner)
  const doFetch = useCallback(
    async (background: boolean) => {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setError(null);
      }
      try {
        setData(await fetcher());
      } catch (e: unknown) {
        if (!background) {
          setError(e instanceof Error ? e.message : "Unknown error");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  );

  // Initial load
  useEffect(() => {
    doFetch(false);
  }, [doFetch]);

  // Refresh on screen focus — skip the very first focus (initial load already covers it)
  const isFirstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      doFetch(true);
    }, [doFetch])
  );

  // Background polling
  useEffect(() => {
    if (!pollingIntervalMs) return;
    const id = setInterval(() => doFetch(true), pollingIntervalMs);
    return () => clearInterval(id);
  }, [doFetch, pollingIntervalMs]);

  // Explicit refetch (e.g. after a mutation) — shows loading spinner
  const refetch = useCallback(() => doFetch(false), [doFetch]);

  return { data, loading, refreshing, error, refetch };
}
