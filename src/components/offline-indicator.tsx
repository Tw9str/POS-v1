"use client";

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface OfflineIndicatorProps {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  usingCachedData: boolean;
  onSync: () => void;
}

export function OfflineIndicator({
  isOnline,
  pendingCount,
  isSyncing,
  lastSyncedAt,
  usingCachedData,
  onSync,
}: OfflineIndicatorProps) {
  const showBar = !isOnline || pendingCount > 0 || usingCachedData;
  if (!showBar) return null;

  return (
    <div
      className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
        isOnline
          ? "bg-amber-50 text-amber-700 border-2 border-amber-200/80"
          : "bg-red-50 text-red-700 border-2 border-red-200/80"
      }`}
    >
      {/* Status dot */}
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          isOnline
            ? isSyncing
              ? "bg-amber-400 animate-pulse"
              : "bg-emerald-500"
            : "bg-red-500"
        }`}
      />

      {!isOnline && (
        <span>
          Offline
          {usingCachedData && " · using cached data"}
        </span>
      )}

      {pendingCount > 0 && (
        <span>
          {pendingCount} change{pendingCount !== 1 ? "s" : ""} pending
        </span>
      )}

      {isOnline && !isSyncing && pendingCount > 0 && (
        <button
          onClick={onSync}
          className="underline hover:no-underline active:scale-95 transition-transform"
        >
          Sync now
        </button>
      )}

      {isSyncing && <span>Syncing...</span>}

      {lastSyncedAt && (
        <span className="ml-auto text-slate-400 font-normal">
          Synced {formatTimeAgo(lastSyncedAt)}
        </span>
      )}
    </div>
  );
}
