"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { PageHeader } from "@/components/layout/page-header";
import { SearchInput } from "@/components/ui/search-input";
import {
  SortableTh,
  useSortToggle,
  type SortDirection,
} from "@/components/ui/sortable-th";
import { IconPlus } from "@/components/icons";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  type NumberFormat,
} from "@/lib/utils";

const PAGE_SIZES = [10, 25, 50, 100];

interface Promotion {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  scope: "ORDER" | "PRODUCT" | "CATEGORY";
  scopeTargetId: string | null;
  minSubtotal: number;
  maxDiscount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  maxUses: number | null;
  usedCount: number;
  maxUsesPerCustomer: number | null;
  stackable: boolean;
  isActive: boolean;
  createdAt: string;
}

interface PromosContentProps {
  merchantId: string;
  currency: string;
  numberFormat?: NumberFormat;
}

const emptyForm = {
  code: "",
  type: "PERCENT" as "PERCENT" | "FIXED",
  value: "",
  scope: "ORDER" as "ORDER" | "PRODUCT" | "CATEGORY",
  scopeTargetId: "",
  minSubtotal: "",
  maxDiscount: "",
  startsAt: "",
  endsAt: "",
  maxUses: "",
  maxUsesPerCustomer: "",
  stackable: false,
  isActive: true,
};

export function PromosContent({
  merchantId,
  currency,
  numberFormat = "western",
}: PromosContentProps) {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    code: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const toggleSort = useSortToggle();

  const fetchPromos = useCallback(async () => {
    try {
      const res = await fetch("/api/merchant/promotions");
      if (res.ok) setPromos(await res.json());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(p: Promotion) {
    setEditingId(p.id);
    setForm({
      code: p.code,
      type: p.type,
      value: String(p.value),
      scope: p.scope,
      scopeTargetId: p.scopeTargetId ?? "",
      minSubtotal: p.minSubtotal ? String(p.minSubtotal) : "",
      maxDiscount: p.maxDiscount ? String(p.maxDiscount) : "",
      startsAt: p.startsAt ? p.startsAt.slice(0, 16) : "",
      endsAt: p.endsAt ? p.endsAt.slice(0, 16) : "",
      maxUses: p.maxUses ? String(p.maxUses) : "",
      maxUsesPerCustomer: p.maxUsesPerCustomer
        ? String(p.maxUsesPerCustomer)
        : "",
      stackable: p.stackable,
      isActive: p.isActive,
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const body = {
        ...(editingId ? { id: editingId } : {}),
        code: form.code,
        type: form.type,
        value: parseFloat(form.value || "0"),
        scope: form.scope,
        scopeTargetId: form.scopeTargetId || null,
        minSubtotal: parseFloat(form.minSubtotal || "0"),
        maxDiscount: form.maxDiscount ? parseFloat(form.maxDiscount) : null,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
        maxUsesPerCustomer: form.maxUsesPerCustomer
          ? parseInt(form.maxUsesPerCustomer)
          : null,
        stackable: form.stackable,
        isActive: form.isActive,
      };

      const res = await fetch("/api/merchant/promotions", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }

      setModalOpen(false);
      fetchPromos();
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch("/api/merchant/promotions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchPromos();
    } catch {
      // silently fail
    }
  }

  function getStatusBadge(p: Promotion) {
    if (!p.isActive) return <Badge variant="default">Inactive</Badge>;
    const now = new Date();
    if (p.startsAt && now < new Date(p.startsAt))
      return <Badge variant="warning">Scheduled</Badge>;
    if (p.endsAt && now > new Date(p.endsAt))
      return <Badge variant="danger">Expired</Badge>;
    if (p.maxUses && p.usedCount >= p.maxUses)
      return <Badge variant="danger">Exhausted</Badge>;
    return <Badge variant="success">Active</Badge>;
  }

  function getStatusKey(p: Promotion): string {
    if (!p.isActive) return "inactive";
    const now = new Date();
    if (p.startsAt && now < new Date(p.startsAt)) return "scheduled";
    if (p.endsAt && now > new Date(p.endsAt)) return "expired";
    if (p.maxUses && p.usedCount >= p.maxUses) return "exhausted";
    return "active";
  }

  function formatValue(p: Promotion) {
    return p.type === "PERCENT"
      ? `${formatNumber(p.value, numberFormat)}%`
      : formatCurrency(p.value, currency, numberFormat);
  }

  function formatScope(p: Promotion) {
    switch (p.scope) {
      case "ORDER":
        return "Whole order";
      case "PRODUCT":
        return "Specific product";
      case "CATEGORY":
        return "Category";
      default:
        return p.scope;
    }
  }

  const promoSummary = useMemo(() => {
    const active = promos.filter((p) => getStatusKey(p) === "active").length;
    const expired = promos.filter(
      (p) => getStatusKey(p) === "expired" || getStatusKey(p) === "exhausted",
    ).length;
    const totalUses = promos.reduce((sum, p) => sum + p.usedCount, 0);
    return { active, expired, totalUses };
  }, [promos]);

  const filteredPromos = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = promos.filter((p) => {
      const matchesSearch =
        !query ||
        p.code.toLowerCase().includes(query) ||
        formatScope(p).toLowerCase().includes(query);

      const status = getStatusKey(p);
      const matchesStatus = statusFilter === "all" || status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    return filtered.sort((a, b) => {
      if (!sortKey || !sortDir)
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      let cmp = 0;
      switch (sortKey) {
        case "code":
          cmp = a.code.localeCompare(b.code);
          break;
        case "value":
          cmp = a.value - b.value;
          break;
        case "scope":
          cmp = a.scope.localeCompare(b.scope);
          break;
        case "usage":
          cmp = a.usedCount - b.usedCount;
          break;
        case "created":
          cmp =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }

      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [promos, search, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredPromos.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedPromos = filteredPromos.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotions"
        subtitle={`${formatNumber(promos.length, numberFormat)} promo codes`}
      >
        <Button onClick={openCreate}>
          <IconPlus size={18} />
          Add Promo
        </Button>
      </PageHeader>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Active
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-900 tabular-nums">
            {formatNumber(promoSummary.active, numberFormat)}
          </p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
            Expired / Exhausted
          </p>
          <p className="mt-2 text-2xl font-bold text-red-900 tabular-nums">
            {formatNumber(promoSummary.expired, numberFormat)}
          </p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            Total uses
          </p>
          <p className="mt-2 text-2xl font-bold text-violet-900 tabular-nums">
            {formatNumber(promoSummary.totalUses, numberFormat)}
          </p>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <SearchInput
          id="promo-search"
          label="Search promos"
          placeholder="Code, scope..."
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          resultCount={filteredPromos.length}
          totalCount={promos.length}
          numberFormat={numberFormat}
        />
        <Select
          id="promo-status-filter"
          label="Status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All statuses" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
            { value: "expired", label: "Expired" },
            { value: "exhausted", label: "Exhausted" },
            { value: "scheduled", label: "Scheduled" },
          ]}
        />
        <Select
          id="promo-page-size"
          label="Per page"
          value={String(pageSize)}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          options={PAGE_SIZES.map((s) => ({
            value: String(s),
            label: `${s} rows`,
          }))}
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <SortableTh
                  label="Code"
                  sortKey="code"
                  currentSort={sortKey}
                  currentDirection={sortDir}
                  onSort={(k) => {
                    const r = toggleSort(k, sortKey, sortDir);
                    setSortKey(r.sort);
                    setSortDir(r.direction);
                    setPage(1);
                  }}
                />
                <SortableTh
                  label="Discount"
                  sortKey="value"
                  currentSort={sortKey}
                  currentDirection={sortDir}
                  onSort={(k) => {
                    const r = toggleSort(k, sortKey, sortDir);
                    setSortKey(r.sort);
                    setSortDir(r.direction);
                    setPage(1);
                  }}
                />
                <SortableTh
                  label="Scope"
                  sortKey="scope"
                  currentSort={sortKey}
                  currentDirection={sortDir}
                  onSort={(k) => {
                    const r = toggleSort(k, sortKey, sortDir);
                    setSortKey(r.sort);
                    setSortDir(r.direction);
                    setPage(1);
                  }}
                />
                <th className="px-5 py-3.5 text-left font-semibold">Status</th>
                <SortableTh
                  label="Usage"
                  sortKey="usage"
                  currentSort={sortKey}
                  currentDirection={sortDir}
                  onSort={(k) => {
                    const r = toggleSort(k, sortKey, sortDir);
                    setSortKey(r.sort);
                    setSortDir(r.direction);
                    setPage(1);
                  }}
                />
                <SortableTh
                  label="Created"
                  sortKey="created"
                  currentSort={sortKey}
                  currentDirection={sortDir}
                  onSort={(k) => {
                    const r = toggleSort(k, sortKey, sortDir);
                    setSortKey(r.sort);
                    setSortDir(r.direction);
                    setPage(1);
                  }}
                />
                <th className="px-5 py-3.5 text-right font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPromos.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-slate-400"
                  >
                    {promos.length === 0
                      ? "No promotions yet"
                      : "No promos match your search"}
                  </td>
                </tr>
              ) : (
                pagedPromos.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        className="cursor-pointer"
                        onClick={() => openEdit(p)}
                      >
                        <span className="font-mono font-bold text-indigo-600 tracking-wider underline decoration-indigo-300/0 hover:decoration-indigo-300 transition-all">
                          {p.code}
                        </span>
                      </button>
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900 tabular-nums">
                      {formatValue(p)}
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {formatScope(p)}
                    </td>
                    <td className="px-5 py-4">{getStatusBadge(p)}</td>
                    <td className="px-5 py-4 text-slate-500 tabular-nums">
                      {formatNumber(p.usedCount, numberFormat)}
                      {p.maxUses
                        ? ` / ${formatNumber(p.maxUses, numberFormat)}`
                        : ""}
                    </td>
                    <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                      {formatDate(p.createdAt, "long", numberFormat)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:bg-red-50"
                        onClick={() =>
                          setDeleteConfirm({ id: p.id, code: p.code })
                        }
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {filteredPromos.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Showing{" "}
            {formatNumber((currentPage - 1) * pageSize + 1, numberFormat)}-
            {formatNumber(
              Math.min(currentPage * pageSize, filteredPromos.length),
              numberFormat,
            )}{" "}
            of {formatNumber(filteredPromos.length, numberFormat)}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-slate-500">
              Page {formatNumber(currentPage, numberFormat)} /{" "}
              {formatNumber(totalPages, numberFormat)}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Promotion" : "Create Promotion"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              id="code"
              label="Promo code"
              placeholder="e.g. SUMMER20"
              value={form.code}
              onChange={(e) =>
                setForm({
                  ...form,
                  code: e.target.value.toUpperCase().replace(/\s/g, ""),
                })
              }
              required
            />
            <Select
              id="type"
              label="Discount type"
              value={form.type}
              onChange={(e) =>
                setForm({
                  ...form,
                  type: e.target.value as "PERCENT" | "FIXED",
                })
              }
              options={[
                { value: "PERCENT", label: "Percentage (%)" },
                { value: "FIXED", label: `Fixed amount (${currency})` },
              ]}
            />
            <Input
              id="value"
              label={
                form.type === "PERCENT"
                  ? "Discount (%)"
                  : `Discount (${currency})`
              }
              type="number"
              min="0"
              max={form.type === "PERCENT" ? "100" : undefined}
              step={form.type === "PERCENT" ? "1" : "0.01"}
              placeholder="0"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              required
            />
            <Select
              id="scope"
              label="Applies to"
              value={form.scope}
              onChange={(e) =>
                setForm({
                  ...form,
                  scope: e.target.value as "ORDER" | "PRODUCT" | "CATEGORY",
                })
              }
              options={[
                { value: "ORDER", label: "Whole order" },
                { value: "PRODUCT", label: "Specific product" },
                { value: "CATEGORY", label: "Category" },
              ]}
            />
            {form.scope !== "ORDER" && (
              <Input
                id="scopeTargetId"
                label={form.scope === "PRODUCT" ? "Product ID" : "Category ID"}
                placeholder="Paste ID"
                value={form.scopeTargetId}
                onChange={(e) =>
                  setForm({ ...form, scopeTargetId: e.target.value })
                }
              />
            )}
            <Input
              id="minSubtotal"
              label={`Minimum subtotal (${currency})`}
              type="number"
              min="0"
              step="0.01"
              placeholder="0 = no minimum"
              value={form.minSubtotal}
              onChange={(e) =>
                setForm({ ...form, minSubtotal: e.target.value })
              }
            />
            <Input
              id="maxDiscount"
              label={`Max discount cap (${currency})`}
              type="number"
              min="0"
              step="0.01"
              placeholder="No cap"
              value={form.maxDiscount}
              onChange={(e) =>
                setForm({ ...form, maxDiscount: e.target.value })
              }
            />
            <Input
              id="maxUses"
              label="Total usage limit"
              type="number"
              min="1"
              placeholder="Unlimited"
              value={form.maxUses}
              onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
            />
            <Input
              id="maxUsesPerCustomer"
              label="Per customer limit"
              type="number"
              min="1"
              placeholder="Unlimited"
              value={form.maxUsesPerCustomer}
              onChange={(e) =>
                setForm({ ...form, maxUsesPerCustomer: e.target.value })
              }
            />
            <Input
              id="startsAt"
              label="Starts at"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
            <Input
              id="endsAt"
              label="Ends at"
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="stackable"
                checked={form.stackable}
                onChange={(e) =>
                  setForm({ ...form, stackable: e.target.checked })
                }
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label
                htmlFor="stackable"
                className="text-sm text-slate-700 font-medium"
              >
                Stackable with other codes
              </label>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label
                htmlFor="isActive"
                className="text-sm text-slate-700 font-medium"
              >
                Active
              </label>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingId ? "Save Changes" : "Create Promo"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteConfirm)}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) {
            handleDelete(deleteConfirm.id);
            setDeleteConfirm(null);
          }
        }}
        title="Delete promotion"
        message={`Delete promo code "${deleteConfirm?.code}"? This cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
