/**
 * Custom hook to refetch data when window regains focus
 * Helps keep data fresh when user returns to the app after switching tabs
 */

import { useEffect, useRef, useCallback } from 'react';

interface UseRefetchOnFocusOptions {
  /** Function to call when refetch is needed */
  onRefetch: () => void | Promise<void>;
  /** Time in milliseconds after which data is considered stale */
  staleTime: number;
  /** Whether the hook is enabled */
  enabled?: boolean;
}

/**
 * Hook that refetches data when window is focused if data is stale
 * 
 * @param onRefetch - Function to call when refetch is needed
 * @param staleTime - Time in ms after which data is considered stale (default: 60000ms = 1 minute)
 * @param enabled - Whether the hook is active (default: true)
 * 
 * @example
 * ```typescript
 * const { forceRefresh } = useRefetchOnFocus({
 *   onRefetch: () => inventoryStore.initialize(),
 *   staleTime: 60000, // 60 seconds
 * });
 * ```
 */
export function useRefetchOnFocus({
  onRefetch,
  staleTime,
  enabled = true,
}: UseRefetchOnFocusOptions): {
  /** Force a refetch regardless of staleness */
  forceRefresh: () => void;
} {
  const lastFetchTime = useRef<number>(0);
  const isFetching = useRef<boolean>(false);

  const handleRefetch = useCallback(() => {
    if (!enabled || isFetching.current) return;
    
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime.current;
    
    // Only refetch if enough time has passed
    if (timeSinceLastFetch >= staleTime) {
      isFetching.current = true;
      
      console.log(`[FocusRefetch] 🔄 Refetching data (stale after ${Math.round(staleTime / 1000)}s, last fetch ${Math.round(timeSinceLastFetch / 1000)}s ago)`);
      
      Promise.resolve(onRefetch()).finally(() => {
        lastFetchTime.current = Date.now();
        isFetching.current = false;
      });
    } else {
      console.log(`[FocusRefetch] ⏳ Skipping refetch - data still fresh (${Math.round(timeSinceLastFetch / 1000)}s ago, stale at ${Math.round(staleTime / 1000)}s)`);
    }
  }, [onRefetch, staleTime, enabled]);

  useEffect(() => {
    if (!enabled) return;

    // Set initial fetch time
    lastFetchTime.current = Date.now();

    const handleFocus = () => {
      console.log('[FocusRefetch] 🎯 Window gained focus');
      handleRefetch();
    };

    // Add event listener for focus
    window.addEventListener('focus', handleFocus);

    // Cleanup
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [handleRefetch, enabled]);

  // Force refresh function - can be called manually
  const forceRefresh = useCallback(() => {
    console.log('[FocusRefetch] 🔥 Manual refresh triggered');
    lastFetchTime.current = 0; // Reset to force immediate refetch
    handleRefetch();
  }, [handleRefetch]);

  return { forceRefresh };
}

export default useRefetchOnFocus;
