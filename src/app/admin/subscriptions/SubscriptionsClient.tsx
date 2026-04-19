"use client";
import type React from "react";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import {
  IconSearch,
  IconRefresh,
  IconFilter,
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconWarning,
} from "@/components/Icons";

interface Sub {
  id: string;
  merchantId: string;
  plan: string;
  status: string;
  startsAt: string;
  expiresAt: string;
  graceEndsAt: string | null;
  paidAmount: number | null;
  paidAt: string | null;
  paymentRef: string | null;
  notes: string | null;
  merchant: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    phone: string | null;
    currency: string;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const STATUS_OPTIONS = ["TRIAL", "ACTIVE", "PAST_DUE", "EXPIRED", "SUSPENDED"];
const PLAN_OPTIONS = ["FREE_TRIAL", "BASIC", "STANDARD", "PREMIUM"];

const statusVariant = (s: string) => {
  switch (s) {
    case "ACTIVE":
      return "success" as const;
    case "TRIAL":
      return "info" as const;
    case "PAST_DUE":
      return "warning" as const;
    default:
      return "danger" as const;
  }
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString();
const fmtCurrency = (n: number, c = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: c,
    maximumFractionDigits: 0,
  }).format(n);

export default function SubscriptionsClient() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    pages: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState<Sub | null>(null);
  const [editPlan, setEditPlan] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editExpires, setEditExpires] = useState("");
  const [editPaidAmount, setEditPaidAmount] = useState("");
  const [editPaymentRef, setEditPaymentRef] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const fetchSubs = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (statusFilter) params.set("status", statusFilter);
        if (planFilter) params.set("plan", planFilter);
        if (expiringOnly) params.set("expiring", "true");
        params.set("page", String(page));
        params.set("limit", "25");

        const res = await fetch(`/api/admin/subscriptions?${params}`);
        if (res.ok) {
          const data = await res.json();
          setSubs(data.subscriptions);
          setPagination(data.pagination);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter, planFilter, expiringOnly],
  );

  useEffect(() => {
    // Read URL params for initial filter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("expiring") === "true") {
      setExpiringOnly(true);
      setShowFilters(true);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchSubs(1), 300);
    return () => clearTimeout(t);
  }, [fetchSubs]);

  function openEdit(sub: Sub) {
    setEditTarget(sub);
    setEditPlan(sub.plan);
    setEditStatus(sub.status);
    setEditExpires(sub.expiresAt.slice(0, 10));
    setEditPaidAmount(String(sub.paidAmount ?? ""));
    setEditPaymentRef(sub.paymentRef || "");
    setEditNotes(sub.notes || "");
  }

  async function handleEdit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editTarget) return;
    setEditLoading(true);
    try {
      const res = await fetch("/api/admin/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantId: editTarget.merchantId,
          plan: editPlan || undefined,
          status: editStatus || undefined,
          expiresAt: editExpires
            ? new Date(editExpires).toISOString()
            : undefined,
          paidAmount: editPaidAmount ? Number(editPaidAmount) : undefined,
          paymentRef: editPaymentRef || undefined,
          notes: editNotes || undefined,
        }),
      });
      if (res.ok) {
        setEditTarget(null);
        fetchSubs(pagination.page);
      }
    } finally {
      setEditLoading(false);
    }
  }

  // Quick actions
  async function extendDays(sub: Sub, days: number) {
    try {
      const newExpiry = new Date(
        new Date(sub.expiresAt).getTime() + days * 24 * 60 * 60 * 1000,
      );
      const res = await fetch("/api/admin/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantId: sub.merchantId,
          expiresAt: newExpiry.toISOString(),
          status: "ACTIVE",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Failed to extend subscription.");
        return;
      }
      fetchSubs(pagination.page);
    } catch {
      alert("Network error. Please try again.");
    }
  }

  async function suspendSub(sub: Sub) {
    try {
      const res = await fetch("/api/admin/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantId: sub.merchantId,
          status: "SUSPENDED",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Failed to suspend subscription.");
        return;
      }
      fetchSubs(pagination.page);
    } catch {
      alert("Network error. Please try again.");
    }
  }

  const hasFilters = statusFilter || planFilter || expiringOnly;

  // Count expiring
  const expiringCount = subs.filter(
    (s) =>
      new Date(s.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 &&
      new Date(s.expiresAt).getTime() > Date.now(),
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
          <p className="text-gray-500 mt-1">
            {pagination.total} total subscriptions
          </p>
        </div>
      </div>

      {/* Expiring alert */}
      {expiringCount > 0 && !expiringOnly && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <IconWarning size={20} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{expiringCount}</strong> subscription
            {expiringCount > 1 ? "s" : ""} on this page expiring within 7 days.
          </p>
          <button
            onClick={() => {
              setExpiringOnly(true);
              setShowFilters(true);
            }}
            className="text-sm font-medium text-amber-700 underline cursor-pointer"
          >
            Show only expiring
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-60 max-w-md">
          <IconSearch
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search merchant name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
        <button
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
              {[statusFilter, planFilter, expiringOnly].filter(Boolean).length}
            </span>
          )}
        </button>
        <button
          onClick={() => fetchSubs(pagination.page)}
          className="p-2.5 text-gray-400 hover:text-gray-600 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <IconRefresh size={16} />
        </button>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="flex items-center gap-3 flex-wrap p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
            >
              <option value="">All</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">
              Plan
            </label>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
            >
              <option value="">All</option>
              {PLAN_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <input
              type="checkbox"
              id="expiring"
              checked={expiringOnly}
              onChange={(e) => setExpiringOnly(e.target.checked)}
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
              onClick={() => {
                setStatusFilter("");
                setPlanFilter("");
                setExpiringOnly(false);
              }}
              className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 mt-4 cursor-pointer"
            >
              <IconX size={14} /> Clear
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Merchant</th>
              <th className="px-5 py-3 text-left font-medium">Plan</th>
              <th className="px-5 py-3 text-left font-medium">Status</th>
              <th className="px-5 py-3 text-left font-medium">Started</th>
              <th className="px-5 py-3 text-left font-medium">Expires</th>
              <th className="px-5 py-3 text-left font-medium">Grace Ends</th>
              <th className="px-5 py-3 text-left font-medium">Paid</th>
              <th className="px-5 py-3 text-left font-medium">Notes</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-5 py-16 text-center">
                  <div className="animate-spin w-6 h-6 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto" />
                </td>
              </tr>
            ) : subs.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-5 py-16 text-center text-gray-400"
                >
                  {search || hasFilters
                    ? "No subscriptions match your filters"
                    : "No subscriptions yet"}
                </td>
              </tr>
            ) : (
              subs.map((sub) => {
                const expTime = new Date(sub.expiresAt).getTime();
                const isExpiring =
                  expTime - Date.now() < 7 * 24 * 60 * 60 * 1000 &&
                  expTime > Date.now();
                const isExpired = expTime < Date.now();
                const daysLeft = Math.ceil(
                  (expTime - Date.now()) / (24 * 60 * 60 * 1000),
                );

                return (
                  <tr
                    key={sub.id}
                    className={`hover:bg-gray-50 ${isExpiring ? "bg-amber-50/50" : ""} ${isExpired ? "bg-red-50/30" : ""}`}
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/merchants/${sub.merchant.id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        {sub.merchant.name}
                      </Link>
                      {!sub.merchant.isActive && (
                        <span className="ml-2 text-xs text-red-500">
                          (disabled)
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="info">{sub.plan.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={statusVariant(sub.status)}>
                        {sub.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {fmtDate(sub.startsAt)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`text-xs ${isExpired ? "text-red-600 font-medium" : isExpiring ? "text-amber-600 font-medium" : "text-gray-500"}`}
                      >
                        {fmtDate(sub.expiresAt)}
                        {isExpiring && ` (${daysLeft}d left)`}
                        {isExpired && " (expired)"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {sub.graceEndsAt ? fmtDate(sub.graceEndsAt) : "—"}
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {sub.paidAmount ? (
                        <div>
                          <span className="font-medium text-gray-900">
                            {fmtCurrency(sub.paidAmount, sub.merchant.currency)}
                          </span>
                          {sub.paymentRef && (
                            <p className="text-gray-400 truncate max-w-24">
                              {sub.paymentRef}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs max-w-32 truncate">
                      {sub.notes || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(sub)}
                        >
                          <IconEdit size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => extendDays(sub, 30)}
                          title="Extend 30 days"
                        >
                          +30d
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => extendDays(sub, 7)}
                          title="Extend 7 days"
                        >
                          +7d
                        </Button>
                        {sub.status !== "SUSPENDED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => suspendSub(sub)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            Suspend
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => fetchSubs(pagination.page - 1)}
            >
              <IconChevronLeft size={16} />
            </Button>
            {Array.from(
              { length: Math.min(pagination.pages, 7) },
              (_, i) => i + 1,
            ).map((p) => (
              <button
                key={p}
                onClick={() => fetchSubs(p)}
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  p === pagination.page
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {p}
              </button>
            ))}
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.pages}
              onClick={() => fetchSubs(pagination.page + 1)}
            >
              <IconChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Subscription Modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={`Edit Subscription — ${editTarget?.merchant.name}`}
        size="md"
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Plan
              </label>
              <select
                value={editPlan}
                onChange={(e) => setEditPlan(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm"
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Input
            label="Expires"
            type="date"
            value={editExpires}
            onChange={(e) => setEditExpires(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Paid Amount"
              type="number"
              value={editPaidAmount}
              onChange={(e) => setEditPaidAmount(e.target.value)}
              min="0"
              step="0.01"
            />
            <Input
              label="Payment Ref"
              value={editPaymentRef}
              onChange={(e) => setEditPaymentRef(e.target.value)}
              placeholder="Receipt #, transfer ID..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Notes
            </label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Internal notes about this subscription..."
            />
          </div>

          {/* Quick extend buttons */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-gray-500">Quick extend:</span>
            {[7, 14, 30, 60, 90, 365].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  const base = editExpires ? new Date(editExpires) : new Date();
                  const newDate = new Date(
                    base.getTime() + d * 24 * 60 * 60 * 1000,
                  );
                  setEditExpires(newDate.toISOString().slice(0, 10));
                  setEditStatus("ACTIVE");
                }}
                className="px-2 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                +{d}d
              </button>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditTarget(null)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" loading={editLoading} className="flex-1">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
