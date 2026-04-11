"use client";

import { useCallback, useEffect, useRef } from "react";
import { pullData } from "@/lib/offline-sync";
import { useOffline } from "@/hooks/use-offline";
import { OfflineIndicator } from "@/components/offline-indicator";

/**
 * Mounts in the dashboard layout.
 * - Hydrates IndexedDB with all entity data (products, categories, customers, staff, suppliers)
 * - Starts background sync (via useOffline)
 * - Renders the offline indicator bar at the top of the dashboard
 */
export function DashboardHydrator({ merchantId }: { merchantId: string }) {
  const hydrated = useRef(false);
  const offline = useOffline(merchantId);

  const syncLatestData = useCallback(() => {
    if (!navigator.onLine) return;
    pullData(merchantId).catch(() => {});
  }, [merchantId]);

  // Pull all data into IndexedDB on first mount (when online)
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    syncLatestData();
  }, [syncLatestData]);

  // Refresh cached dashboard data when the tab becomes active again.
  useEffect(() => {
    const handleFocus = () => syncLatestData();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncLatestData();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [syncLatestData]);

  return (
    <div className="mb-4">
      <OfflineIndicator
        isOnline={offline.isOnline}
        pendingCount={offline.pendingCount}
        isSyncing={offline.isSyncing}
        lastSyncedAt={offline.lastSyncedAt}
        usingCachedData={offline.usingCachedData}
        onSync={offline.triggerSync}
      />
    </div>
  );
}
