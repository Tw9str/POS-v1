import { Badge } from "@/components/ui/Badge";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { getActivityLogs } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/utils";
import { ActivityFilters, ActivityPagination } from "./ActivityFilters";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Activity Log" };

const actionColor = (action: string) => {
  if (action.startsWith("CREATE") || action === "GENERATE_LICENSE")
    return "success" as const;
  if (
    action.startsWith("UPDATE") ||
    action.startsWith("EDIT") ||
    action === "EXTEND_SUBSCRIPTION"
  )
    return "info" as const;
  if (
    action.startsWith("DELETE") ||
    action === "REVOKE_LICENSE" ||
    action === "DEACTIVATE" ||
    action === "SUSPEND"
  )
    return "danger" as const;
  if (action === "LOGIN" || action === "VERIFY") return "default" as const;
  return "warning" as const;
};

function timeAgo(d: string | Date) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDateTime(d);
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getActivityLogs({
    search: params.search,
    action: params.action,
    entity: params.entity,
    from: params.from,
    to: params.to,
    page: params.page ? Number(params.page) : 1,
  });

  if (!data) {
    return (
      <div className="text-center py-20 text-gray-400">
        Could not load activity logs.
      </div>
    );
  }

  const { logs, pagination, filters } = data;
  const hasFilters =
    params.search || params.action || params.entity || params.from || params.to;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-gray-500 mt-1">
            Audit trail of all system activity
            {pagination.total > 0 && (
              <span className="ml-2 text-gray-400">
                ({pagination.total.toLocaleString("en-US")} total)
              </span>
            )}
          </p>
        </div>
        <RefreshButton />
      </div>

      {/* Filters */}
      <ActivityFilters
        availableActions={filters.actions}
        availableEntities={filters.entities}
      />

      {/* Activity Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {logs.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400">
            {hasFilters
              ? "No activity matches your filters"
              : "No activity recorded yet"}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map((log) => (
              <div
                key={log.id}
                className="px-6 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors"
              >
                <div className="mt-1.5 shrink-0">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      actionColor(log.action) === "success"
                        ? "bg-green-400"
                        : actionColor(log.action) === "danger"
                          ? "bg-red-400"
                          : actionColor(log.action) === "info"
                            ? "bg-blue-400"
                            : "bg-gray-400"
                    }`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={actionColor(log.action)}>
                      {log.action.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-sm text-gray-400">on</span>
                    <span className="text-sm font-medium text-gray-700">
                      {log.entity.replace(/_/g, " ")}
                    </span>
                    {log.entityId && (
                      <span className="text-xs text-gray-400 font-mono">
                        {log.entityId.slice(0, 8)}...
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1">
                    {log.merchant && (
                      <span className="text-sm text-gray-500">
                        {log.merchant.name}
                      </span>
                    )}
                  </div>

                  {log.details && (
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                      {log.details}
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs text-gray-500 block">
                    {timeAgo(log.createdAt)}
                  </span>
                  <span className="text-xs text-gray-400 block mt-0.5">
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <ActivityPagination
          page={pagination.page}
          pages={pagination.pages}
          total={pagination.total}
          limit={pagination.limit}
        />
      </div>
    </div>
  );
}
