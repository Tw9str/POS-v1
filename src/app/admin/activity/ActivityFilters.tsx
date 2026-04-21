"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { IconSearch, IconRefresh, IconCalendar } from "@/components/Icons";

export function ActivityFilters({
  availableActions,
  availableEntities,
}: {
  availableActions: string[];
  availableEntities: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const search = searchParams.get("search") || "";
  const action = searchParams.get("action") || "";
  const entity = searchParams.get("entity") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      // Reset page when filters change
      if (!("page" in updates)) params.delete("page");
      startTransition(() => router.push(`?${params.toString()}`));
    },
    [router, searchParams],
  );

  const clearFilters = () => {
    startTransition(() => router.push("?"));
  };

  const hasFilters = search || action || entity || from || to;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <IconSearch
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <Input
            placeholder="Search actions, entities, details..."
            defaultValue={search}
            onChange={(e) => updateParams({ search: e.target.value })}
            className="pl-9"
          />
        </div>

        <Select
          value={action}
          onChange={(e) => updateParams({ action: e.target.value })}
          options={[
            { value: "", label: "All Actions" },
            ...availableActions.map((a) => ({
              value: a,
              label: a.replace(/_/g, " "),
            })),
          ]}
        />

        <Select
          value={entity}
          onChange={(e) => updateParams({ entity: e.target.value })}
          options={[
            { value: "", label: "All Entities" },
            ...availableEntities.map((e) => ({
              value: e,
              label: e.replace(/_/g, " "),
            })),
          ]}
        />

        <div className="flex items-center">
          {hasFilters ? (
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="text-sm"
              disabled={isPending}
            >
              Clear filters
            </Button>
          ) : (
            <span className="text-sm text-gray-400">No filters active</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3">
        <IconCalendar size={16} className="text-gray-400" />
        <div className="flex items-center gap-2">
          <input
            type="date"
            defaultValue={from}
            onChange={(e) => updateParams({ from: e.target.value })}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            defaultValue={to}
            onChange={(e) => updateParams({ to: e.target.value })}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700"
          />
        </div>
      </div>
    </div>
  );
}

export function ActivityPagination({
  page,
  pages,
  total,
  limit,
}: {
  page: number;
  pages: number;
  total: number;
  limit: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    startTransition(() => router.push(`?${params.toString()}`));
  };

  if (pages <= 1) return null;

  return (
    <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between">
      <p className="text-sm text-gray-500">
        Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of{" "}
        {total.toLocaleString("en-US")}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1 || isPending}
          onClick={() => goToPage(page - 1)}
        >
          Previous
        </Button>
        {Array.from({ length: Math.min(5, pages) }, (_, i) => {
          let pageNum: number;
          if (pages <= 5) {
            pageNum = i + 1;
          } else if (page <= 3) {
            pageNum = i + 1;
          } else if (page >= pages - 2) {
            pageNum = pages - 4 + i;
          } else {
            pageNum = page - 2 + i;
          }
          return (
            <Button
              key={pageNum}
              variant={pageNum === page ? "primary" : "ghost"}
              size="sm"
              onClick={() => goToPage(pageNum)}
              disabled={isPending}
            >
              {pageNum}
            </Button>
          );
        })}
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pages || isPending}
          onClick={() => goToPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
