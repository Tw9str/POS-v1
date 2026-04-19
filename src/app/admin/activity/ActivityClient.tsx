"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { IconSearch, IconRefresh, IconCalendar } from "@/components/Icons";

interface ActivityLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  performedBy: string | null;
  merchantId: string | null;
  merchant: { id: string; name: string } | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface Filters {
  actions: string[];
  entities: string[];
}

const actionColor = (action: string) => {
  if (action.startsWith("CREATE") || action === "GENERATE_LICENSE")
    return "success" as const;
  if (action.startsWith("UPDATE") || action.startsWith("EDIT") || action === "EXTEND_SUBSCRIPTION")
    return "info" as const;
  if (action.startsWith("DELETE") || action === "REVOKE_LICENSE" || action === "DEACTIVATE" || action === "SUSPEND")
    return "danger" as const;
  if (action === "LOGIN" || action === "VERIFY")
    return "default" as const;
  return "warning" as const;
};

export default function ActivityClient() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });
  const [filters, setFilters] = useState<Filters>({
    actions: [],
    entities: [],
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (actionFilter) params.set("action", actionFilter);
      if (entityFilter) params.set("entity", entityFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      params.set("page", String(page));
      params.set("limit", "50");

      const res = await fetch(`/api/admin/activity?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setLogs(data.logs);
      setPagination(data.pagination);
      setFilters(data.filters);
    } catch (err) {
      console.error("Failed to fetch activity logs:", err);
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter, entityFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [search, actionFilter, entityFilter, dateFrom, dateTo]);

  const clearFilters = () => {
    setSearch("");
    setActionFilter("");
    setEntityFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasFilters = search || actionFilter || entityFilter || dateFrom || dateTo;

  const formatDateTime = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return formatDateTime(d);
  };

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
                ({pagination.total.toLocaleString()} total)
              </span>
            )}
          </p>
        </div>
        <Button variant="secondary" onClick={fetchLogs} disabled={loading}>
          <IconRefresh size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <IconSearch
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <Input
              placeholder="Search actions, entities, details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Action filter */}
          <Select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            options={[
              { value: "", label: "All Actions" },
              ...filters.actions.map((a) => ({
                value: a,
                label: a.replace(/_/g, " "),
              })),
            ]}
          />

          {/* Entity filter */}
          <Select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            options={[
              { value: "", label: "All Entities" },
              ...filters.entities.map((e) => ({
                value: e,
                label: e.replace(/_/g, " "),
              })),
            ]}
          />

          {/* Clear filters */}
          <div className="flex items-center">
            {hasFilters ? (
              <Button variant="ghost" onClick={clearFilters} className="text-sm">
                Clear filters
              </Button>
            ) : (
              <span className="text-sm text-gray-400">No filters active</span>
            )}
          </div>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-3 mt-3">
          <IconCalendar size={16} className="text-gray-400" />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700"
            />
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {loading ? (
          <div className="px-6 py-12 text-center text-gray-400">
            Loading activity...
          </div>
        ) : logs.length === 0 ? (
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
                {/* Dot */}
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

                {/* Content */}
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
                    {log.performedBy && (
                      <span className="text-xs text-gray-400">
                        by {log.performedBy}
                      </span>
                    )}
                  </div>

                  {log.details && (
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                      {log.details}
                    </p>
                  )}
                </div>

                {/* Timestamp */}
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

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              {/* Page numbers */}
              {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                let pageNum: number;
                if (pagination.pages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= pagination.pages - 2) {
                  pageNum = pagination.pages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === page ? "primary" : "ghost"}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
