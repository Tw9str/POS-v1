"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { RowActions } from "@/components/ui/RowActions";
import { FloatingActionBar } from "@/components/ui/FloatingActionBar";
import { StatusToggle } from "@/components/ui/StatusToggle";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import {
  SortableTh,
  useSortToggle,
  type SortDirection,
} from "@/components/ui/SortableTh";
import { IconPlus } from "@/components/Icons";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  type NumberFormat,
} from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";

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
  currencyFormat: "symbol" | "code" | "none";
  numberFormat?: NumberFormat;
  language?: string;
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
  currencyFormat = "symbol",
  numberFormat = "western",
  language = "en",
}: PromosContentProps) {
  const i = t(language as Locale);
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
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
        setError(data.error || i.promos.failedToSave);
        return;
      }

      setModalOpen(false);
      fetchPromos();
    } catch {
      setError(i.common.somethingWentWrong);
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

  async function handleToggleActive(p: Promotion) {
    // Optimistic update
    setPromos((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, isActive: !p.isActive } : x)),
    );
    try {
      const res = await fetch("/api/merchant/promotions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, isActive: !p.isActive }),
      });
      if (!res.ok) {
        // Revert on failure
        setPromos((prev) =>
          prev.map((x) => (x.id === p.id ? { ...x, isActive: p.isActive } : x)),
        );
      }
    } catch {
      // Revert on failure
      setPromos((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, isActive: p.isActive } : x)),
      );
    }
  }

  function getStatusInfo(p: Promotion): {
    label: string;
    variant: "default" | "success" | "warning" | "danger";
  } {
    if (!p.isActive) return { label: i.promos.inactive, variant: "default" };
    const now = new Date();
    if (p.startsAt && now < new Date(p.startsAt))
      return { label: i.promos.scheduled, variant: "warning" };
    if (p.endsAt && now > new Date(p.endsAt))
      return { label: i.promos.expired, variant: "danger" };
    if (p.maxUses && p.usedCount >= p.maxUses)
      return { label: i.promos.exhausted, variant: "danger" };
    return { label: i.promos.active, variant: "success" };
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
      : formatCurrency(
          p.value,
          currency,
          numberFormat,
          currencyFormat,
          language,
        );
  }

  function formatScope(p: Promotion) {
    switch (p.scope) {
      case "ORDER":
        return i.promos.wholeOrder;
      case "PRODUCT":
        return i.promos.specificProduct;
      case "CATEGORY":
        return i.promos.categoryScope;
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
  const pageIds = pagedPromos.map((p) => p.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleSelectPage() {
    setSelectedIds((prev) =>
      allPageSelected
        ? prev.filter((id) => !pageIds.includes(id))
        : Array.from(new Set([...prev, ...pageIds])),
    );
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    setBulkDeleting(true);
    setFeedback(null);
    const failures: string[] = [];

    for (const id of selectedIds) {
      try {
        const res = await fetch("/api/merchant/promotions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) failures.push(id);
      } catch {
        failures.push(id);
      }
    }

    if (failures.length > 0) {
      setFeedback({ type: "error", text: i.common.somethingWentWrong });
    } else {
      setFeedback({
        type: "success",
        text: i.common.deletedCount.replace(
          "{count}",
          String(selectedIds.length),
        ),
      });
      setSelectedIds([]);
    }
    fetchPromos();
    setBulkDeleting(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={i.promos.title}
        subtitle={`${formatNumber(promos.length, numberFormat)} ${i.promos.promoCodes}`}
      >
        <Button onClick={openCreate}>
          <IconPlus size={18} />
          {i.promos.addPromo}
        </Button>
      </PageHeader>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {i.promos.activeCount}
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-900 tabular-nums">
            {formatNumber(promoSummary.active, numberFormat)}
          </p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
            {i.promos.expiredExhausted}
          </p>
          <p className="mt-2 text-2xl font-bold text-red-900 tabular-nums">
            {formatNumber(promoSummary.expired, numberFormat)}
          </p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            {i.promos.totalUses}
          </p>
          <p className="mt-2 text-2xl font-bold text-violet-900 tabular-nums">
            {formatNumber(promoSummary.totalUses, numberFormat)}
          </p>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <SearchInput
          id="promo-search"
          label={i.common.search}
          placeholder={i.promos.searchPlaceholder}
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          resultCount={filteredPromos.length}
          totalCount={promos.length}
          numberFormat={numberFormat}
          language={language}
        />
        <Select
          id="promo-status-filter"
          label={i.common.status}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "all", label: i.promos.allStatuses },
            { value: "active", label: i.promos.active },
            { value: "inactive", label: i.promos.inactive },
            { value: "expired", label: i.promos.expired },
            { value: "exhausted", label: i.promos.exhausted },
            { value: "scheduled", label: i.promos.scheduled },
          ]}
        />
        <Select
          id="promo-page-size"
          label={i.common.perPage}
          value={String(pageSize)}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          options={PAGE_SIZES.map((s) => ({
            value: String(s),
            label: `${s} ${i.common.rows}`,
          }))}
        />
      </div>

      {feedback && (
        <p
          className={`rounded-xl px-3 py-2 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {feedback.text}
        </p>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400">
          {i.common.loading}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5 text-start w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectPage}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <SortableTh
                  label={i.promos.code}
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
                  label={i.promos.discountCol}
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
                  label={i.promos.scope}
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
                <th className="px-5 py-3.5 text-start font-semibold">
                  {i.common.status}
                </th>
                <SortableTh
                  label={i.promos.usage}
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
                  label={i.promos.createdCol}
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
                <th className="px-5 py-3.5 text-end font-semibold">
                  {i.common.actions}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPromos.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-slate-400"
                  >
                    {promos.length === 0
                      ? i.promos.noPromosYet
                      : i.promos.noPromosMatch}
                  </td>
                </tr>
              ) : (
                pagedPromos.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p.id)}
                        onChange={() => toggleSelected(p.id)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
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
                    <td className="px-5 py-4">
                      {(() => {
                        const status = getStatusInfo(p);
                        return (
                          <StatusToggle
                            isActive={p.isActive}
                            badgeContent={status.label}
                            badgeVariant={status.variant}
                            onToggle={() => handleToggleActive(p)}
                          />
                        );
                      })()}
                    </td>
                    <td className="px-5 py-4 text-slate-500 tabular-nums">
                      {formatNumber(p.usedCount, numberFormat)}
                      {p.maxUses
                        ? ` / ${formatNumber(p.maxUses, numberFormat)}`
                        : ""}
                    </td>
                    <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                      {formatDate(p.createdAt, "long", numberFormat)}
                    </td>
                    <td className="px-4 py-4">
                      <RowActions
                        actions={[
                          {
                            icon: "edit",
                            label: i.common.edit,
                            onClick: () => openEdit(p),
                          },
                          {
                            icon: "delete",
                            label: i.common.delete,
                            variant: "danger",
                            onClick: () =>
                              setDeleteConfirm({ id: p.id, code: p.code }),
                          },
                        ]}
                      />
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
            {i.common.showing}{" "}
            {formatNumber((currentPage - 1) * pageSize + 1, numberFormat)}-
            {formatNumber(
              Math.min(currentPage * pageSize, filteredPromos.length),
              numberFormat,
            )}{" "}
            {i.common.of} {formatNumber(filteredPromos.length, numberFormat)}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              {i.common.previous}
            </Button>
            <span className="text-sm text-slate-500">
              {i.common.page} {formatNumber(currentPage, numberFormat)} /{" "}
              {formatNumber(totalPages, numberFormat)}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              {i.common.next}
            </Button>
          </div>
        </div>
      )}

      <FloatingActionBar
        selectedCount={selectedIds.length}
        onDelete={() => setConfirmBulkDelete(true)}
        onCancel={() => setSelectedIds([])}
        deleting={bulkDeleting}
        numberFormat={numberFormat}
        language={language}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? i.promos.editPromotion : i.promos.createPromotion}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              id="code"
              label={i.promos.promoCodeLabel}
              placeholder={i.promos.promoCodePlaceholder}
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
              label={i.promos.discountType}
              value={form.type}
              onChange={(e) =>
                setForm({
                  ...form,
                  type: e.target.value as "PERCENT" | "FIXED",
                })
              }
              options={[
                { value: "PERCENT", label: i.promos.percentage },
                {
                  value: "FIXED",
                  label: `${i.promos.fixedAmount} (${currency})`,
                },
              ]}
            />
            <Input
              id="value"
              label={
                form.type === "PERCENT"
                  ? `${i.promos.discountLabel} (%)`
                  : `${i.promos.discountLabel} (${currency})`
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
              label={i.promos.appliesTo}
              value={form.scope}
              onChange={(e) =>
                setForm({
                  ...form,
                  scope: e.target.value as "ORDER" | "PRODUCT" | "CATEGORY",
                })
              }
              options={[
                { value: "ORDER", label: i.promos.wholeOrder },
                { value: "PRODUCT", label: i.promos.specificProduct },
                { value: "CATEGORY", label: i.promos.categoryScope },
              ]}
            />
            {form.scope !== "ORDER" && (
              <Input
                id="scopeTargetId"
                label={
                  form.scope === "PRODUCT"
                    ? i.promos.productId
                    : i.promos.categoryId
                }
                placeholder={i.promos.pasteId}
                value={form.scopeTargetId}
                onChange={(e) =>
                  setForm({ ...form, scopeTargetId: e.target.value })
                }
              />
            )}
            <Input
              id="minSubtotal"
              label={`${i.promos.minSubtotal} (${currency})`}
              type="number"
              min="0"
              step="0.01"
              placeholder={i.promos.noMinimum}
              value={form.minSubtotal}
              onChange={(e) =>
                setForm({ ...form, minSubtotal: e.target.value })
              }
            />
            <Input
              id="maxDiscount"
              label={`${i.promos.maxDiscountCap} (${currency})`}
              type="number"
              min="0"
              step="0.01"
              placeholder={i.promos.noCap}
              value={form.maxDiscount}
              onChange={(e) =>
                setForm({ ...form, maxDiscount: e.target.value })
              }
            />
            <Input
              id="maxUses"
              label={i.promos.totalUsageLimit}
              type="number"
              min="1"
              placeholder={i.promos.unlimited}
              value={form.maxUses}
              onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
            />
            <Input
              id="maxUsesPerCustomer"
              label={i.promos.perCustomerLimit}
              type="number"
              min="1"
              placeholder={i.promos.unlimited}
              value={form.maxUsesPerCustomer}
              onChange={(e) =>
                setForm({ ...form, maxUsesPerCustomer: e.target.value })
              }
            />
            <Input
              id="startsAt"
              label={i.promos.startsAt}
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
            <Input
              id="endsAt"
              label={i.promos.endsAt}
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
                {i.promos.stackable}
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
                {i.promos.activeCheckbox}
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
              {i.common.cancel}
            </Button>
            <Button type="submit" loading={saving}>
              {editingId ? i.promos.saveChanges : i.promos.createPromo}
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
        title={i.promos.deletePromotion}
        message={i.promos.deletePromoConfirm.replace(
          "{code}",
          deleteConfirm?.code ?? "",
        )}
        confirmLabel={i.common.delete}
      />

      <ConfirmModal
        open={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={() => {
          setConfirmBulkDelete(false);
          handleBulkDelete();
        }}
        title={i.promos.deleteSelectedPromos}
        message={i.promos.deleteSelectedConfirm.replace(
          "{count}",
          formatNumber(selectedIds.length, numberFormat),
        )}
        confirmLabel={i.common.delete}
      />
    </div>
  );
}
