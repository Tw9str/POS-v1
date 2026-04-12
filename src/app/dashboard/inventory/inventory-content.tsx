"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalOrders, useLocalProducts } from "@/hooks/use-local-data";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { ProductInsightModal } from "@/components/product-insight-modal";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { IconCamera } from "@/components/icons";
import { SearchInput } from "@/components/ui/search-input";
import {
  SortableTh,
  useSortToggle,
  type SortDirection,
} from "@/components/ui/sortable-th";
import type { LocalProduct } from "@/lib/offline-db";
import { offlineFetch } from "@/lib/offline-fetch";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  getProductDisplayName,
  type NumberFormat,
} from "@/lib/utils";
import {
  buildInventoryInsights,
  buildProductPerformance,
} from "@/lib/product-performance";

const PAGE_SIZES = [10, 25, 50, 100];

type InventoryAdjustmentEntry = {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    variantName: string | null;
    sku: string | null;
    unit: string;
  };
};

export function InventoryContent({
  merchantId,
  currency,
  numberFormat = "western",
}: {
  merchantId: string;
  currency: string;
  numberFormat?: NumberFormat;
}) {
  const router = useRouter();
  const products = useLocalProducts(merchantId);
  const orders = useLocalOrders(merchantId, 500);
  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [movementFilter, setMovementFilter] = useState("all");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const toggleSort = useSortToggle();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [selectedProduct, setSelectedProduct] = useState<LocalProduct | null>(
    null,
  );
  const [selectedInsightProduct, setSelectedInsightProduct] =
    useState<LocalProduct | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [history, setHistory] = useState<InventoryAdjustmentEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [adjustmentForm, setAdjustmentForm] = useState({
    type: "CORRECTION",
    quantity: "0",
    reason: "",
  });

  const tracked = useMemo(
    () =>
      products.filter((p) => p.trackStock).sort((a, b) => a.stock - b.stock),
    [products],
  );

  const performance = useMemo(
    () => buildProductPerformance(orders, products),
    [orders, products],
  );
  const inventoryInsights = useMemo(
    () => buildInventoryInsights(tracked, performance),
    [tracked, performance],
  );
  const insightMap = useMemo(
    () => new Map(inventoryInsights.map((item) => [item.productId, item])),
    [inventoryInsights],
  );
  const urgentReorders = useMemo(
    () =>
      inventoryInsights.filter((item) => item.action === "reorder").slice(0, 4),
    [inventoryInsights],
  );
  const deadStockItems = useMemo(
    () =>
      inventoryInsights.filter((item) => item.action === "dead").slice(0, 4),
    [inventoryInsights],
  );

  const summary = useMemo(() => {
    const outOfStock = tracked.filter((p) => p.stock <= 0).length;
    const lowStock = tracked.filter(
      (p) => p.stock > 0 && p.stock <= Math.max(1, p.lowStockAt || 5),
    ).length;
    const sold7d = Array.from(performance.values()).reduce(
      (sum, metric) => sum + metric.sold7d,
      0,
    );
    const fastMoving = Array.from(performance.values()).filter(
      (metric) => metric.movement === "fast",
    ).length;
    const deadStock = Array.from(performance.values()).filter(
      (metric) => metric.movement === "dead",
    ).length;

    return {
      tracked: tracked.length,
      outOfStock,
      lowStock,
      sold7d,
      fastMoving,
      deadStock,
    };
  }, [tracked, performance]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = tracked.filter((product) => {
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.variantName?.toLowerCase().includes(query) ||
        product.sku?.toLowerCase().includes(query) ||
        product.barcode?.toLowerCase().includes(query) ||
        product.categoryName?.toLowerCase().includes(query);

      const threshold = Math.max(1, product.lowStockAt || 5);
      const stockState =
        product.stock <= 0 ? "out" : product.stock <= threshold ? "low" : "in";

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "out" && stockState === "out") ||
        (statusFilter === "low" && stockState === "low") ||
        (statusFilter === "in" && stockState === "in");

      const metric = performance.get(product.id);
      const movement = metric?.movement || "dead";
      const matchesMovement =
        movementFilter === "all" || movement === movementFilter;

      return matchesSearch && matchesStatus && matchesMovement;
    });

    return result.sort((a, b) => {
      if (!sortKey || !sortDir) return a.stock - b.stock;

      const metricA = performance.get(a.id);
      const metricB = performance.get(b.id);
      let cmp = 0;

      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "category":
          cmp = (a.categoryName || "").localeCompare(b.categoryName || "");
          break;
        case "sku":
          cmp = (a.sku || "").localeCompare(b.sku || "");
          break;
        case "stock":
          cmp = a.stock - b.stock;
          break;
        case "lowAlert":
          cmp = (a.lowStockAt || 5) - (b.lowStockAt || 5);
          break;
        case "sold7d":
          cmp = (metricA?.sold7d ?? 0) - (metricB?.sold7d ?? 0);
          break;
        case "net30d":
          cmp = (metricA?.netRevenue ?? 0) - (metricB?.netRevenue ?? 0);
          break;
      }

      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [
    tracked,
    search,
    statusFilter,
    movementFilter,
    sortKey,
    sortDir,
    performance,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/merchant/inventory/adjustments");
      if (res.ok) {
        const data = (await res.json()) as InventoryAdjustmentEntry[];
        setHistory(data);
      }
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, [merchantId]);

  function openAdjustModal(product: LocalProduct) {
    setSelectedProduct(product);
    setAdjustmentForm({
      type: product.stock <= 0 ? "PURCHASE" : "CORRECTION",
      quantity: product.stock <= 0 ? "1" : "0",
      reason: "",
    });
  }

  async function handleAdjustStock(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedProduct) return;

    const quantity = Number(adjustmentForm.quantity);
    if (
      !Number.isFinite(quantity) ||
      !Number.isInteger(quantity) ||
      quantity === 0
    ) {
      setFeedback({
        type: "error",
        text: "Enter a whole number above or below zero.",
      });
      return;
    }

    setAdjusting(true);
    setFeedback(null);

    const result = await offlineFetch({
      url: "/api/merchant/inventory/adjustments",
      method: "POST",
      body: {
        productId: selectedProduct.id,
        type: adjustmentForm.type,
        quantity,
        reason: adjustmentForm.reason || null,
      },
      entity: "inventory",
      merchantId,
    });

    if (!result.ok) {
      setFeedback({
        type: "error",
        text: result.error || "Failed to adjust stock",
      });
    } else {
      setFeedback({
        type: "success",
        text: result.offline
          ? `Stock update for "${getProductDisplayName(selectedProduct.name, selectedProduct.variantName)}" was saved offline and will sync automatically.`
          : `Stock updated for "${getProductDisplayName(selectedProduct.name, selectedProduct.variantName)}".`,
      });
      setSelectedProduct(null);
      await loadHistory();
      router.refresh();
    }

    setAdjusting(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        subtitle="Track stock levels, low-stock alerts, and availability"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tracked items
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {formatNumber(summary.tracked, numberFormat)}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Low stock
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-900 tabular-nums">
            {formatNumber(summary.lowStock, numberFormat)}
          </p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
            Out of stock
          </p>
          <p className="mt-2 text-2xl font-bold text-red-900 tabular-nums">
            {formatNumber(summary.outOfStock, numberFormat)}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Units sold 7d
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-900 tabular-nums">
            {formatNumber(summary.sold7d, numberFormat)}
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
            Fast movers
          </p>
          <p className="mt-2 text-2xl font-bold text-cyan-900 tabular-nums">
            {formatNumber(summary.fastMoving, numberFormat)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Dead stock
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {formatNumber(summary.deadStock, numberFormat)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Urgent reorder list
              </p>
              <p className="mt-1 text-sm text-amber-900">
                Variants with low coverage or active demand.
              </p>
            </div>
            <Badge variant="warning">
              {formatNumber(urgentReorders.length, numberFormat)} items
            </Badge>
          </div>
          <div className="mt-3 space-y-2">
            {urgentReorders.length === 0 ? (
              <p className="text-sm text-slate-500">
                No urgent reorder alerts right now.
              </p>
            ) : (
              urgentReorders.map((item) => {
                const product = tracked.find(
                  (entry) => entry.id === item.productId,
                );
                if (!product) return null;

                return (
                  <button
                    key={item.productId}
                    type="button"
                    onClick={() => setSelectedInsightProduct(product)}
                    className="w-full rounded-xl bg-white/80 px-3 py-2 text-left hover:bg-white transition-colors"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {getProductDisplayName(product.name, product.variantName)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.reason}
                    </p>
                    <p className="text-xs font-semibold text-amber-700 mt-1">
                      Suggested reorder: +
                      {formatNumber(item.recommendedQty, numberFormat)}{" "}
                      {product.unit}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                Dead-stock watch
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Items with stock left but no recent movement.
              </p>
            </div>
            <Badge variant="default">
              {formatNumber(deadStockItems.length, numberFormat)} items
            </Badge>
          </div>
          <div className="mt-3 space-y-2">
            {deadStockItems.length === 0 ? (
              <p className="text-sm text-slate-500">
                No dead stock is being flagged.
              </p>
            ) : (
              deadStockItems.map((item) => {
                const product = tracked.find(
                  (entry) => entry.id === item.productId,
                );
                if (!product) return null;

                return (
                  <button
                    key={item.productId}
                    type="button"
                    onClick={() => setSelectedInsightProduct(product)}
                    className="w-full rounded-xl bg-slate-50 px-3 py-2 text-left hover:bg-slate-100 transition-colors"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {getProductDisplayName(product.name, product.variantName)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.reason}
                    </p>
                    <p className="text-xs font-semibold text-slate-700 mt-1">
                      On hand: {formatNumber(product.stock, numberFormat)}{" "}
                      {product.unit}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <SearchInput
          id="inventory-search"
          label="Search inventory"
          placeholder="Product, SKU, barcode, category..."
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          resultCount={filtered.length}
          totalCount={tracked.length}
          numberFormat={numberFormat}
          onScan={() => setScannerOpen(true)}
        />
        <Select
          id="inventory-status-filter"
          label="Stock status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All stock" },
            { value: "in", label: "In stock" },
            { value: "low", label: "Low stock" },
            { value: "out", label: "Out of stock" },
          ]}
        />
        <Select
          id="inventory-movement-filter"
          label="Movement"
          value={movementFilter}
          onChange={(e) => {
            setMovementFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All movement" },
            { value: "fast", label: "Fast movers" },
            { value: "steady", label: "Steady" },
            { value: "slow", label: "Slow movers" },
            { value: "dead", label: "Dead stock" },
          ]}
        />
        <Select
          id="inventory-page-size"
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

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
            Stock Levels
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <SortableTh
                label="Product"
                sortKey="name"
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
                label="Category"
                sortKey="category"
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
                label="SKU"
                sortKey="sku"
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
                label="Stock"
                sortKey="stock"
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
                label="Low alert"
                sortKey="lowAlert"
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
                label="Sold 7d"
                sortKey="sold7d"
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
                label="Net 30d"
                sortKey="net30d"
                currentSort={sortKey}
                currentDirection={sortDir}
                onSort={(k) => {
                  const r = toggleSort(k, sortKey, sortDir);
                  setSortKey(r.sort);
                  setSortDir(r.direction);
                  setPage(1);
                }}
              />
              <th className="px-5 py-3.5 text-left font-semibold">Movement</th>
              <th className="px-5 py-3.5 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  {tracked.length === 0
                    ? "No tracked products"
                    : "No inventory items match your search or filter"}
                </td>
              </tr>
            ) : (
              pagedItems.map((p) => {
                const threshold = Math.max(1, p.lowStockAt || 5);
                const isOut = p.stock <= 0;
                const isLow = !isOut && p.stock <= threshold;
                const metric = performance.get(p.id);
                const movementVariant =
                  metric?.movement === "fast"
                    ? "success"
                    : metric?.movement === "steady"
                      ? "info"
                      : metric?.movement === "slow"
                        ? "warning"
                        : "default";

                return (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-5 py-4 text-slate-800">
                      <button
                        type="button"
                        className="text-left group cursor-pointer"
                        onClick={() => setSelectedInsightProduct(p)}
                      >
                        <p className="font-semibold capitalize text-indigo-600 underline decoration-indigo-300/0 group-hover:decoration-indigo-300 transition-all">
                          {p.name}
                        </p>
                        <p className="text-xs font-medium text-slate-500">
                          {p.variantName || "Single/default item"}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {metric?.lastSoldAt
                            ? `Last sold ${formatDateTime(new Date(metric.lastSoldAt), "numeric", numberFormat)}`
                            : "No sales yet"}
                        </p>
                      </button>
                    </td>
                    <td className="px-5 py-4 text-slate-500 capitalize">
                      {p.categoryName || "·"}
                    </td>
                    <td className="px-5 py-4 text-slate-500 font-mono text-xs">
                      {p.sku || "·"}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900 tabular-nums">
                      {formatNumber(p.stock, numberFormat)} {p.unit}
                    </td>
                    <td className="px-5 py-4 text-slate-500 tabular-nums">
                      {formatNumber(threshold, numberFormat)} {p.unit}
                    </td>
                    <td className="px-5 py-4 text-slate-600 tabular-nums">
                      {formatNumber(metric?.sold7d ?? 0, numberFormat)}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(
                        metric?.netRevenue ?? 0,
                        currency,
                        numberFormat,
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={movementVariant}>
                        {metric?.movement === "fast"
                          ? "Fast"
                          : metric?.movement === "steady"
                            ? "Steady"
                            : metric?.movement === "slow"
                              ? "Slow"
                              : "No movement"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        variant={
                          isOut ? "danger" : isLow ? "warning" : "success"
                        }
                      >
                        {isOut
                          ? "Out of stock"
                          : isLow
                            ? "Low stock"
                            : "In stock"}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Showing{" "}
            {formatNumber((currentPage - 1) * pageSize + 1, numberFormat)}-
            {formatNumber(
              Math.min(currentPage * pageSize, filtered.length),
              numberFormat,
            )}{" "}
            of {formatNumber(filtered.length, numberFormat)}
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

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
            Recent Adjustments
          </h2>
          <p className="text-sm text-slate-500">
            {historyLoading
              ? "Loading..."
              : `${formatNumber(history.length, numberFormat)} recent entries`}
          </p>
        </div>
        {history.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-400">
            No inventory adjustments yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {getProductDisplayName(
                      entry.product.name,
                      entry.product.variantName,
                    )}
                  </p>
                  <p className="text-sm text-slate-500">
                    {entry.reason || entry.type.replaceAll("_", " ")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant={entry.quantity > 0 ? "success" : "warning"}>
                    {entry.type.replaceAll("_", " ")}
                  </Badge>
                  <span
                    className={
                      entry.quantity > 0
                        ? "font-semibold text-emerald-700"
                        : "font-semibold text-amber-700"
                    }
                  >
                    {entry.quantity > 0 ? "+" : ""}
                    {formatNumber(entry.quantity, numberFormat)}{" "}
                    {entry.product.unit}
                  </span>
                  <span className="text-slate-500">
                    {formatDateTime(
                      new Date(entry.createdAt),
                      "numeric",
                      numberFormat,
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ProductInsightModal
        open={Boolean(selectedInsightProduct)}
        onClose={() => setSelectedInsightProduct(null)}
        product={selectedInsightProduct}
        metric={
          selectedInsightProduct
            ? performance.get(selectedInsightProduct.id)
            : undefined
        }
        insight={
          selectedInsightProduct
            ? insightMap.get(selectedInsightProduct.id)
            : undefined
        }
        currency={currency}
        numberFormat={numberFormat}
        onEdit={(p) => {
          setSelectedInsightProduct(null);
          openAdjustModal(p as LocalProduct);
        }}
      />

      <Modal
        open={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        title={
          selectedProduct
            ? `Adjust ${getProductDisplayName(selectedProduct.name, selectedProduct.variantName)}`
            : "Adjust stock"
        }
      >
        {selectedProduct && (
          <form onSubmit={handleAdjustStock} className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              Current stock:{" "}
              <span className="font-semibold text-slate-900">
                {formatNumber(selectedProduct.stock, numberFormat)}{" "}
                {selectedProduct.unit}
              </span>
            </div>

            <Select
              id="adjustment-type"
              label="Adjustment type"
              value={adjustmentForm.type}
              onChange={(e) =>
                setAdjustmentForm((prev) => ({ ...prev, type: e.target.value }))
              }
              options={[
                { value: "PURCHASE", label: "Receive stock" },
                { value: "RETURN", label: "Customer return" },
                { value: "DAMAGE", label: "Damage / loss" },
                { value: "CORRECTION", label: "Manual correction" },
                { value: "TRANSFER", label: "Transfer" },
              ]}
            />

            <Input
              id="adjustment-quantity"
              label="Quantity change"
              type="number"
              placeholder="Use + to add, - to remove"
              value={adjustmentForm.quantity}
              onChange={(e) =>
                setAdjustmentForm((prev) => ({
                  ...prev,
                  quantity: e.target.value,
                }))
              }
              required
            />

            <Input
              id="adjustment-reason"
              label="Reason (optional)"
              placeholder="Why is stock changing?"
              value={adjustmentForm.reason}
              onChange={(e) =>
                setAdjustmentForm((prev) => ({
                  ...prev,
                  reason: e.target.value,
                }))
              }
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setSelectedProduct(null)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={adjusting}>
                Save Adjustment
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {scannerOpen && (
        <BarcodeScanner
          onScan={(barcode) => {
            setScannerOpen(false);
            const found = products.find(
              (p) => p.barcode?.toLowerCase() === barcode.toLowerCase(),
            );
            if (found) {
              setSelectedInsightProduct(found);
            } else {
              setSearch(barcode);
              setPage(1);
            }
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
