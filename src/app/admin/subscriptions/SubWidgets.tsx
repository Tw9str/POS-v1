"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useTransition,
  useCallback,
  useState,
  useActionState,
  useEffect,
} from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { IconSearch, IconFilter, IconX, IconEdit } from "@/components/Icons";
import {
  PLANS,
  SUBSCRIPTION_STATUSES,
  formatPlan,
  formatStatus,
  statusVariant,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { manageMerchantPlan } from "@/app/actions/admin";

// ─── Filters ───
export function SubFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const plan = searchParams.get("plan") || "";
  const expiring = searchParams.get("expiring") === "true";
  const [showFilters, setShowFilters] = useState(
    !!status || !!plan || expiring,
  );

  const update = useCallback(
    (updates: Record<string, string>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
      if (!("page" in updates)) p.delete("page");
      startTransition(() => router.push(`?${p.toString()}`));
    },
    [router, searchParams],
  );

  const hasFilters = status || plan || expiring;

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-60 max-w-md">
          <IconSearch
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search merchant name..."
            defaultValue={search}
            onChange={(e) => update({ search: e.target.value })}
            className="w-full pl-9 pr-4 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 rounded-xl transition-colors cursor-pointer ${
            hasFilters
              ? "border-indigo-500 text-indigo-600 bg-indigo-50"
              : "border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          <IconFilter size={16} />
          Filters
          {hasFilters && (
            <span className="w-5 h-5 bg-indigo-600 text-white rounded-full text-xs flex items-center justify-center">
              {[status, plan, expiring].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="flex items-center gap-3 flex-wrap p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => update({ status: e.target.value })}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
            >
              <option value="">All</option>
              {SUBSCRIPTION_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">
              Plan
            </label>
            <select
              value={plan}
              onChange={(e) => update({ plan: e.target.value })}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
            >
              <option value="">All</option>
              {PLANS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <input
              type="checkbox"
              id="expiring"
              checked={expiring}
              onChange={(e) =>
                update({ expiring: e.target.checked ? "true" : "" })
              }
              className="rounded"
            />
            <label
              htmlFor="expiring"
              className="text-sm text-gray-600 cursor-pointer"
            >
              Expiring within 7 days
            </label>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => update({ status: "", plan: "", expiring: "" })}
              className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 mt-4 cursor-pointer"
            >
              <IconX size={14} /> Clear
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ─── Pagination ───
export function SubPagination({
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
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-500">
        Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of{" "}
        {total}
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
        {Array.from({ length: Math.min(7, pages) }, (_, i) => i + 1).map(
          (p) => (
            <button
              key={p}
              onClick={() => goToPage(p)}
              disabled={isPending}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                p === page
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {p}
            </button>
          ),
        )}
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

// ─── Expiring Alert with filter button ───
export function ExpiringAlert({ count }: { count: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  if (count <= 0 || searchParams.get("expiring") === "true") return null;

  return (
    <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
      <span className="text-amber-600 shrink-0">⚠</span>
      <p className="text-sm text-amber-800">
        <strong>{count}</strong> subscription{count > 1 ? "s" : ""} expiring
        within 7 days.
      </p>
      <button
        onClick={() => {
          const p = new URLSearchParams(searchParams.toString());
          p.set("expiring", "true");
          startTransition(() => router.push(`?${p.toString()}`));
        }}
        className="text-sm font-medium text-amber-700 underline cursor-pointer"
      >
        Show only expiring
      </button>
    </div>
  );
}

// ─── Manage Plan Button (inline in table) ───
export function SubManagePlanButton({
  merchantId,
  merchantName,
  sub,
  gracePeriodDays,
}: {
  merchantId: string;
  merchantName: string;
  sub: {
    plan: string;
    status: string;
    expiresAt: string;
    paidAmount: number | null;
    paymentRef: string | null;
    notes: string | null;
  };
  gracePeriodDays: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(manageMerchantPlan, {});
  const [durationType, setDurationType] = useState<"days" | "date">("days");
  const [expiresDate, setExpiresDate] = useState(
    sub.expiresAt ? new Date(sub.expiresAt).toISOString().slice(0, 10) : "",
  );

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        title="Manage Plan"
      >
        <IconEdit size={14} />
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Manage Plan — ${merchantName}`}
        size="md"
      >
        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl text-sm">
          <span className="text-gray-500">Current:</span>
          <Badge variant="info">{formatPlan(sub.plan)}</Badge>
          <Badge variant={statusVariant(sub.status)}>
            {formatStatus(sub.status)}
          </Badge>
          <span className="text-gray-500 text-xs">
            expires {formatDateTime(sub.expiresAt)}
          </span>
        </div>

        {state.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {state.error}
          </div>
        )}

        <form action={action} className="space-y-4">
          <input type="hidden" name="merchantId" value={merchantId} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Plan
              </label>
              <select
                name="plan"
                defaultValue={sub.plan}
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm"
              >
                {PLANS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Status
              </label>
              <select
                name="status"
                defaultValue={sub.status}
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm"
              >
                {SUBSCRIPTION_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Duration
            </label>
            <div className="flex items-center gap-3 mb-2">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={durationType === "days"}
                  onChange={() => setDurationType("days")}
                  className="accent-indigo-600"
                />
                Days from now
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={durationType === "date"}
                  onChange={() => setDurationType("date")}
                  className="accent-indigo-600"
                />
                Specific date
              </label>
            </div>
            {durationType === "days" ? (
              <Input
                key="duration-days"
                type="number"
                name="durationDays"
                defaultValue="30"
                min="1"
                max="3650"
              />
            ) : (
              <Input
                key="duration-date"
                type="date"
                name="expiresAt"
                value={expiresDate}
                onChange={(e) => setExpiresDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            )}
          </div>

          {/* Quick extend */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Quick extend:</span>
            {[7, 14, 30, 60, 90, 365].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  const base = new Date(
                    Math.max(new Date(sub.expiresAt).getTime(), Date.now()),
                  );
                  const newDate = new Date(
                    base.getTime() + d * 24 * 60 * 60 * 1000,
                  );
                  setDurationType("date");
                  setExpiresDate(newDate.toISOString().slice(0, 10));
                }}
                className="px-2 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                +{d}d
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Paid Amount"
              name="paidAmount"
              type="number"
              defaultValue={
                sub.paidAmount != null ? String(sub.paidAmount) : ""
              }
              min="0"
              step="0.01"
            />
            <Input
              label="Payment Ref"
              name="paymentRef"
              defaultValue={sub.paymentRef || ""}
              placeholder="Receipt #..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Notes
            </label>
            <textarea
              name="notes"
              defaultValue={sub.notes || ""}
              rows={2}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm resize-none"
            />
          </div>

          <div className="text-xs text-gray-400">
            Grace period: {gracePeriodDays} days
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending ? "Applying..." : "Apply Plan"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
