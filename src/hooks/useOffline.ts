"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fullSync,
  startBackgroundSync,
  stopBackgroundSync,
  onSyncResult,
  getPendingOrderCount,
  getLastSyncTime,
  hasLocalData,
  type SyncResult,
} from "@/lib/offline-sync";
import { getPendingMutationCount } from "@/lib/offline-fetch";

interface OfflineState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  lastSyncedAt: number | null;
  usingCachedData: boolean;
  triggerSync: () => Promise<void>;
}

export function useOffline(merchantId: string): OfflineState {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const merchantIdRef = useRef(merchantId);
  merchantIdRef.current = merchantId;

  // Set real online status after hydration
  useEffect(() => {
    setIsOnline(navigator.onLine);
  }, []);

  // Online/offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Refresh pending count + sync time
  const refreshPending = useCallback(async () => {
    const orders = await getPendingOrderCount(merchantIdRef.current);
    const mutations = await getPendingMutationCount(merchantIdRef.current);
    setPendingCount(orders + mutations);
    const syncTime = await getLastSyncTime(merchantIdRef.current);
    setLastSyncedAt(syncTime);
  }, []);

  // Detect if using cached data (offline with local data available)
  useEffect(() => {
    if (!isOnline) {
      hasLocalData(merchantIdRef.current).then(setUsingCachedData);
    } else {
      setUsingCachedData(false);
    }
  }, [isOnline]);

  // Poll pending count every 5s
  useEffect(() => {
    refreshPending();
    const interval = setInterval(refreshPending, 5_000);
    return () => clearInterval(interval);
  }, [refreshPending]);

  // Background sync
  useEffect(() => {
    startBackgroundSync(merchantId);

    const unsubscribe = onSyncResult((result) => {
      setLastSyncResult(result);
      refreshPending();
    });

    // Listen for SW-triggered sync requests (Background Sync API)
    const handleSwSync = () => {
      if (!navigator.onLine) return;
      fullSync(merchantIdRef.current).then((result) => {
        setLastSyncResult(result);
        refreshPending();
      });
    };
    window.addEventListener("sw-sync-requested", handleSwSync);

    // Re-register background sync tag when coming online
    const handleOnlineSync = () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          if ("sync" in reg) {
            (
              reg as unknown as {
                sync: { register: (tag: string) => Promise<void> };
              }
            ).sync
              .register("shampay-sync")
              .catch(() => {});
          }
        });
      }
    };
    window.addEventListener("online", handleOnlineSync);

    return () => {
      stopBackgroundSync();
      unsubscribe();
      window.removeEventListener("sw-sync-requested", handleSwSync);
      window.removeEventListener("online", handleOnlineSync);
    };
  }, [merchantId, refreshPending]);

  // Manual sync trigger
  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    try {
      const result = await fullSync(merchantIdRef.current);
      setLastSyncResult(result);
      await refreshPending();
    } finally {
      setIsSyncing(false);
    }
  }, [refreshPending]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncResult,
    lastSyncedAt,
    usingCachedData,
    triggerSync,
  };
}
