"use client";
import type React from "react";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  IconSearch,
  IconRefresh,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconX,
} from "@/components/Icons";
import { formatDate, formatDateTime } from "@/lib/utils";

interface Merchant {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  subscription?: {
    plan: string;
    status: string;
    startsAt: string;
    expiresAt: string;
    graceEndsAt: string | null;
    paidAmount: number | null;
    paidAt: string | null;
  } | null;
  _count: {
    orders: number;
    staff: number;
    products: number;
    customers: number;
    licenseKeys: number;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const STATUS_OPTIONS = [
  "",
  "TRIAL",
  "ACTIVE",
  "PAST_DUE",
  "EXPIRED",
  "SUSPENDED",
];
const PLAN_OPTIONS = ["", "FREE_TRIAL", "BASIC", "STANDARD", "PREMIUM"];
const ACTIVE_OPTIONS = ["", "true", "false"];

const statusVariant = (s: string | undefined) => {
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

export default function MerchantsClient() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
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
  const [activeFilter, setActiveFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Create merchant modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createResult, setCreateResult] = useState<{
    name: string;
    accessCode: string;
  } | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newCurrency, setNewCurrency] = useState("USD");

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Merchant | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchMerchants = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (statusFilter) params.set("status", statusFilter);
        if (planFilter) params.set("plan", planFilter);
        if (activeFilter) params.set("active", activeFilter);
        params.set("page", String(page));
        params.set("limit", "25");

        const res = await fetch(`/api/admin/merchants?${params}`);
        if (res.ok) {
          const data = await res.json();
          setMerchants(data.merchants);
          setPagination(data.pagination);
        }
      } catch {
        // Network error — list stays stale
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter, planFilter, activeFilter],
  );

  useEffect(() => {
    const t = setTimeout(() => fetchMerchants(1), 300);
    return () => clearTimeout(t);
  }, [fetchMerchants]);

  async function handleCreate(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError("");
    setCreateLoading(true);
    try {
      const res = await fetch("/api/admin/merchants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          phone: newPhone,
          address: newAddress,
          currency: newCurrency,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Failed");
        return;
      }
      setCreateResult({
        name: data.merchant.name,
        accessCode: data.merchant.accessCode,
      });
    } catch {
      setCreateError("Network error");
    } finally {
      setCreateLoading(false);
    }
  }

  function closeCreate() {
    setCreateOpen(false);
    setCreateResult(null);
    setNewName("");
    setNewPhone("");
    setNewAddress("");
    setNewCurrency("USD");
    setCreateError("");
    fetchMerchants(1);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await fetch(`/api/admin/merchants/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      fetchMerchants(pagination.page);
    } catch {
      alert("Failed to delete merchant. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function toggleActive(m: Merchant) {
    try {
      await fetch(`/api/admin/merchants/${m.id}/toggle`, { method: "POST" });
      fetchMerchants(pagination.page);
    } catch {
      alert("Failed to update merchant status.");
    }
  }

  const hasFilters = statusFilter || planFilter || activeFilter;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Merchants</h1>
          <p className="text-gray-500 mt-1">
            {pagination.total} total merchants
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ New Merchant</Button>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-60 max-w-md">
          <IconSearch
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search name, slug, code, phone..."
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
              {[statusFilter, planFilter, activeFilter].filter(Boolean).length}
            </span>
          )}
        </button>
        <button
          onClick={() => fetchMerchants(pagination.page)}
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
              {STATUS_OPTIONS.filter(Boolean).map((s) => (
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
              {PLAN_OPTIONS.filter(Boolean).map((p) => (
                <option key={p} value={p}>
                  {p.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">
              Active
            </label>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
            >
              {ACTIVE_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a === "" ? "All" : a === "true" ? "Active" : "Inactive"}
                </option>
              ))}
            </select>
          </div>
          {hasFilters && (
            <button
              onClick={() => {
                setStatusFilter("");
                setPlanFilter("");
                setActiveFilter("");
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
              <th className="px-5 py-3 text-center font-medium">Products</th>
              <th className="px-5 py-3 text-center font-medium">Orders</th>
              <th className="px-5 py-3 text-center font-medium">Staff</th>
              <th className="px-5 py-3 text-left font-medium">Expires</th>
              <th className="px-5 py-3 text-left font-medium">Created</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-5 py-16 text-center">
                  <div className="animate-spin w-6 h-6 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto" />
                </td>
              </tr>
            ) : merchants.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-5 py-16 text-center text-gray-400"
                >
                  {search || hasFilters
                    ? "No merchants match your filters"
                    : "No merchants yet"}
                </td>
              </tr>
            ) : (
              merchants.map((m) => {
                const isExpiring =
                  m.subscription?.expiresAt &&
                  new Date(m.subscription.expiresAt).getTime() - Date.now() <
                    7 * 24 * 60 * 60 * 1000 &&
                  new Date(m.subscription.expiresAt).getTime() > Date.now();
                return (
                  <tr
                    key={m.id}
                    className={`hover:bg-gray-50 ${isExpiring ? "bg-amber-50/50" : ""} ${!m.isActive ? "opacity-60" : ""}`}
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/merchants/${m.id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        {m.name}
                      </Link>
                      <p className="text-xs text-gray-400">{m.slug}</p>
                    </td>

                    <td className="px-5 py-4">
                      <Badge variant="info">
                        {m.subscription?.plan || "NONE"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={statusVariant(m.subscription?.status)}>
                          {m.subscription?.status || "NONE"}
                        </Badge>
                        {!m.isActive && (
                          <Badge variant="danger">Disabled</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center text-gray-500">
                      {m._count.products}
                    </td>
                    <td className="px-5 py-4 text-center text-gray-500">
                      {m._count.orders}
                    </td>
                    <td className="px-5 py-4 text-center text-gray-500">
                      {m._count.staff}
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {m.subscription?.expiresAt
                        ? formatDate(m.subscription.expiresAt)
                        : "·"}
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {formatDateTime(m.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/admin/merchants/${m.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                        <Button
                          variant={m.isActive ? "ghost" : "primary"}
                          size="sm"
                          onClick={() => toggleActive(m)}
                        >
                          {m.isActive ? "Suspend" : "Activate"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(m)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Deactivate
                        </Button>
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
              onClick={() => fetchMerchants(pagination.page - 1)}
            >
              <IconChevronLeft size={16} />
            </Button>
            {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => fetchMerchants(p)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    p === pagination.page
                      ? "bg-indigo-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.pages}
              onClick={() => fetchMerchants(pagination.page + 1)}
            >
              <IconChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Create Merchant Modal */}
      <Modal
        open={createOpen && !createResult}
        onClose={closeCreate}
        title="Create New Merchant"
        size="md"
      >
        {createError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {createError}
          </div>
        )}
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Store Name *"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="My Store"
            required
            minLength={2}
          />
          <Input
            label="Phone"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="+963..."
          />
          <Input
            label="Address"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="Damascus, Syria"
          />
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Currency
            </label>
            <select
              value={newCurrency}
              onChange={(e) => setNewCurrency(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm"
            >
              <option value="SYP">SYP - Syrian Pound</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="TRY">TRY - Turkish Lira</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={closeCreate}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createLoading || !newName.trim()}
              loading={createLoading}
              className="flex-1"
            >
              Create
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Success Modal */}
      <Modal
        open={!!createResult}
        onClose={closeCreate}
        title="Merchant Created!"
        size="sm"
      >
        {createResult && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-gray-500">
              Share this access code with <strong>{createResult.name}</strong>
            </p>
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                Access Code
              </p>
              <p className="text-3xl font-mono font-bold text-indigo-600 tracking-widest">
                {createResult.accessCode}
              </p>
            </div>
            <p className="text-xs text-gray-400">
              The merchant uses this code to log in at /store
            </p>
            <Button onClick={closeCreate} className="w-full">
              Done
            </Button>
          </div>
        )}
      </Modal>

      {/* Deactivate Confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Deactivate Merchant"
        message={`This will suspend "${deleteTarget?.name}", revoke all their licenses, and mark their subscription as SUSPENDED. The merchant will lose access immediately.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}
