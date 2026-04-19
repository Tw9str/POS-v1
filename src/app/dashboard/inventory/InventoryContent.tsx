"use client";
import type React from "react";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProductInsightModal } from "@/components/ProductInsightModal";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { IconCamera } from "@/components/Icons";
import { RowActions } from "@/components/ui/RowActions";
import { SearchInput } from "@/components/ui/SearchInput";
import {
  SortableTh,
  useSortToggle,
  type SortDirection,
} from "@/components/ui/SortableTh";
import type { Product, Order } from "@/types/pos";
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
} from "@/lib/productPerformance";
import {
  t,
  translateAdjustType,
  translateInsightReason,
  translateUnit,
  type Locale,
} from "@/lib/i18n";

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
  currencyFormat = "symbol",
  numberFormat = "western",
  language = "en",
  products,
  orders,
}: {
  merchantId: string;
  currency: string;
  currencyFormat: "symbol" | "code" | "none";
  numberFormat?: NumberFormat;
  language?: string;
  products: Product[];
  orders: Order[];
}) {
  const i = t(language as Locale);
  const [localProducts, setLocalProducts] = useState(products);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLocalProducts(products);
  }, [products]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [movementFilter, setMovementFilter] = useState("all");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const toggleSort = useSortToggle();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedInsightProduct, setSelectedInsightProduct] =
    useState<Product | null>(null);
  const [isAdjusting, startAdjustTransition] = useTransition();
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
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [inventoryTab, setInventoryTab] = useState<"stock" | "adjustments">(
    "stock",
  );

  const tracked = useMemo(
    () =>
      localProducts
        .filter((p) => p.trackStock)
        .sort((a, b) => a.stock - b.stock),
    [localProducts],
  );

  const performance = useMemo(
    () => buildProductPerformance(orders, localProducts),
    [orders, localProducts],
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

  function openAdjustModal(product: Product) {
    setSelectedProduct(product);
    setAdjustmentForm({
      type: product.stock <= 0 ? "PURCHASE" : "CORRECTION",
      quantity: product.stock <= 0 ? "1" : "0",
      reason: "",
    });
  }

  async function handleAdjustStock(e: React.SubmitEvent<HTMLFormElement>) {
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
        text: i.inventory.enterWholeNumber,
      });
      return;
    }

    setFeedback(null);

    startAdjustTransition(async () => {
      try {
        const res = await fetch("/api/merchant/inventory/adjustments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: selectedProduct.id,
            type: adjustmentForm.type,
            quantity,
            reason: adjustmentForm.reason || null,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setFeedback({
            type: "error",
            text: err.error || i.inventory.failedToAdjust,
          });
        } else {
          const data = (await res.json()) as {
            productId: string;
            stock: number;
          };
          setFeedback({
            type: "success",
            text: `${i.inventory.stockUpdated} "${getProductDisplayName(selectedProduct.name, selectedProduct.variantName)}".`,
          });
          setLocalProducts((prev) =>
            prev.map((product) =>
              product.id === data.productId
                ? { ...product, stock: data.stock }
                : product,
            ),
          );
          setSelectedProduct(null);
          await loadHistory();
        }
      } catch {
        setFeedback({ type: "error", text: i.inventory.failedToAdjust });
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title={i.inventory.title} subtitle={i.inventory.subtitle} />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {i.inventory.trackedItems}
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {formatNumber(summary.tracked, numberFormat)}
          </p>
          <div className="mt-1 flex items-center gap-3 text-xs">
            {summary.lowStock > 0 && (
              <span className="text-amber-700">
                {formatNumber(summary.lowStock, numberFormat)}{" "}
                {i.inventory.lowStock}
              </span>
            )}
            {summary.outOfStock > 0 && (
              <span className="text-red-700">
                {formatNumber(summary.outOfStock, numberFormat)}{" "}
                {i.inventory.outOfStock}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {i.inventory.unitsSold7d}
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-900 tabular-nums">
            {formatNumber(summary.sold7d, numberFormat)}
          </p>
          <p className="mt-1 text-xs text-emerald-600">
            {formatNumber(summary.fastMoving, numberFormat)}{" "}
            {i.inventory.fastMovers}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            {i.inventory.deadStock}
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {formatNumber(summary.deadStock, numberFormat)}
          </p>
        </div>
      </div>

      {(urgentReorders.length > 0 || deadStockItems.length > 0) && (
        <div>
          <button
            type="button"
            onClick={() => setInsightsOpen((prev) => !prev)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${insightsOpen ? "rotate-90" : ""}`}
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
            {i.inventory.urgentReorderList} / {i.inventory.deadStockWatch}
          </button>
          {insightsOpen && (
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      {i.inventory.urgentReorderList}
                    </p>
                    <p className="mt-1 text-sm text-amber-900">
                      {i.inventory.urgentReorderDesc}
                    </p>
                  </div>
                  <Badge variant="warning">
                    {formatNumber(urgentReorders.length, numberFormat)}{" "}
                    {i.pos.items.toLowerCase()}
                  </Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {urgentReorders.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      {i.inventory.noUrgentReorder}
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
                          className="w-full rounded-xl bg-white/80 px-3 py-2 text-start hover:bg-white transition-colors"
                        >
                          <p className="text-sm font-semibold text-slate-900">
                            {getProductDisplayName(
                              product.name,
                              product.variantName,
                            )}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {translateInsightReason(
                              item.reasonKey,
                              language as Locale,
                              item.reasonParams,
                            )}
                          </p>
                          <p className="text-xs font-semibold text-amber-700 mt-1">
                            {i.inventory.suggestedReorder} +
                            {formatNumber(item.recommendedQty, numberFormat)}{" "}
                            {translateUnit(product.unit, language as Locale)}
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
                      {i.inventory.deadStockWatch}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {i.inventory.deadStockDesc}
                    </p>
                  </div>
                  <Badge variant="default">
                    {formatNumber(deadStockItems.length, numberFormat)}{" "}
                    {i.pos.items.toLowerCase()}
                  </Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {deadStockItems.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      {i.inventory.noDeadStock}
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
                          className="w-full rounded-xl bg-slate-50 px-3 py-2 text-start hover:bg-slate-100 transition-colors"
                        >
                          <p className="text-sm font-semibold text-slate-900">
                            {getProductDisplayName(
                              product.name,
                              product.variantName,
                            )}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {translateInsightReason(
                              item.reasonKey,
                              language as Locale,
                              item.reasonParams,
                            )}
                          </p>
                          <p className="text-xs font-semibold text-slate-700 mt-1">
                            {i.inventory.onHand}{" "}
                            {formatNumber(product.stock, numberFormat)}{" "}
                            {translateUnit(product.unit, language as Locale)}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-4">
        <SearchInput
          id="inventory-search"
          label={i.common.search}
          placeholder={i.inventory.searchPlaceholder}
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          resultCount={filtered.length}
          totalCount={tracked.length}
          numberFormat={numberFormat}
          onScan={() => setScannerOpen(true)}
          language={language}
        />
        <Select
          id="inventory-status-filter"
          label={i.inventory.stockStatus}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "all", label: i.products.allStock },
            { value: "in", label: i.inventory.inStock },
            { value: "low", label: i.inventory.lowStock },
            { value: "out", label: i.inventory.outOfStock },
          ]}
        />
        <Select
          id="inventory-movement-filter"
          label={i.inventory.movement}
          value={movementFilter}
          onChange={(e) => {
            setMovementFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "all", label: i.inventory.allMovement },
            { value: "fast", label: i.inventory.fastMovers },
            { value: "steady", label: i.inventory.steady },
            { value: "slow", label: i.inventory.slowMovers },
            { value: "dead", label: i.inventory.deadStock },
          ]}
        />
        <Select
          id="inventory-page-size"
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

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setInventoryTab("stock")}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                inventoryTab === "stock"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {i.inventory.stockLevels}
            </button>
            <button
              type="button"
              onClick={() => setInventoryTab("adjustments")}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                inventoryTab === "adjustments"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {i.inventory.recentAdjustments}
              {history.length > 0 && (
                <span className="ms-1.5 text-[10px] bg-slate-200 text-slate-600 rounded-full px-1.5 py-0.5">
                  {formatNumber(history.length, numberFormat)}
                </span>
              )}
            </button>
          </div>
        </div>

        {inventoryTab === "stock" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <SortableTh
                    label={i.inventory.product}
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
                    label={i.inventory.category}
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
                    label={i.inventory.stockCol}
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
                    label={i.inventory.sold7d}
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
                  <th className="px-5 py-3.5 text-start font-semibold">
                    {i.inventory.statusCol}
                  </th>
                  <th className="px-4 py-3.5 text-end font-semibold">
                    {i.common.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-slate-400"
                    >
                      {tracked.length === 0
                        ? i.inventory.noTrackedProducts
                        : i.inventory.noInventoryMatch}
                    </td>
                  </tr>
                ) : (
                  pagedItems.map((p) => {
                    const threshold = Math.max(1, p.lowStockAt || 5);
                    const isOut = p.stock <= 0;
                    const isLow = !isOut && p.stock <= threshold;
                    const metric = performance.get(p.id);

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-5 py-4 text-slate-800">
                          <button
                            type="button"
                            className="text-start group/name cursor-pointer"
                            onClick={() => setSelectedInsightProduct(p)}
                          >
                            <p className="font-semibold capitalize text-indigo-600 underline decoration-indigo-300/0 group-hover/name:decoration-indigo-300 transition-all">
                              {p.name}
                            </p>
                            <p className="text-xs font-medium text-slate-500">
                              {p.variantName || i.inventory.singleDefaultItem}
                            </p>
                            {p.sku && (
                              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                {p.sku}
                              </p>
                            )}
                          </button>
                        </td>
                        <td className="px-5 py-4 text-slate-500 capitalize">
                          {p.categoryName === "Other"
                            ? i.products.categoryOther
                            : p.categoryName || "·"}
                        </td>
                        <td className="px-5 py-4 font-bold text-slate-900 tabular-nums">
                          {formatNumber(p.stock, numberFormat)}{" "}
                          <span className="text-xs font-normal text-slate-400">
                            {translateUnit(p.unit, language as Locale)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-600 tabular-nums">
                          {formatNumber(metric?.sold7d ?? 0, numberFormat)}
                        </td>
                        <td className="px-5 py-4">
                          <Badge
                            variant={
                              isOut ? "danger" : isLow ? "warning" : "success"
                            }
                          >
                            {isOut
                              ? i.inventory.outOfStock
                              : isLow
                                ? i.inventory.lowStock
                                : i.inventory.inStock}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <RowActions
                            actions={[
                              {
                                icon: "edit",
                                label: i.inventory.adjustStock,
                                onClick: () => openAdjustModal(p),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : /* Recent Adjustments tab */
        history.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-400">
            {historyLoading ? i.common.loading : i.inventory.noAdjustments}
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
                    {entry.reason ||
                      translateAdjustType(entry.type, language as Locale)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant={entry.quantity > 0 ? "success" : "warning"}>
                    {translateAdjustType(entry.type, language as Locale)}
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
                    {translateUnit(entry.product.unit, language as Locale)}
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

      {filtered.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            {i.common.showing}{" "}
            {formatNumber((currentPage - 1) * pageSize + 1, numberFormat)}-
            {formatNumber(
              Math.min(currentPage * pageSize, filtered.length),
              numberFormat,
            )}{" "}
            {i.common.of} {formatNumber(filtered.length, numberFormat)}
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

      <ProductInsightModal
        open={Boolean(selectedInsightProduct)}
        onClose={() => setSelectedInsightProduct(null)}
        product={selectedInsightProduct}
        language={language}
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
        currencyFormat={currencyFormat}
        numberFormat={numberFormat}
        onEdit={(p) => {
          setSelectedInsightProduct(null);
          openAdjustModal(p as Product);
        }}
      />

      <Modal
        open={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        title={
          selectedProduct
            ? `${i.inventory.adjustStock} ${getProductDisplayName(selectedProduct.name, selectedProduct.variantName)}`
            : i.inventory.adjustStock
        }
      >
        {selectedProduct && (
          <form onSubmit={handleAdjustStock} className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              {i.inventory.currentStock}{" "}
              <span className="font-semibold text-slate-900">
                {formatNumber(selectedProduct.stock, numberFormat)}{" "}
                {translateUnit(selectedProduct.unit, language as Locale)}
              </span>
            </div>

            <Select
              id="adjustment-type"
              label={i.inventory.adjustmentType}
              value={adjustmentForm.type}
              onChange={(e) =>
                setAdjustmentForm((prev) => ({ ...prev, type: e.target.value }))
              }
              options={[
                { value: "PURCHASE", label: i.inventory.purchase },
                { value: "RETURN", label: i.inventory.returnType },
                { value: "DAMAGE", label: i.inventory.damage },
                { value: "CORRECTION", label: i.inventory.correction },
              ]}
            />

            <Input
              id="adjustment-quantity"
              label={i.inventory.quantity}
              type="number"
              placeholder={i.inventory.adjustQuantityPlaceholder}
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
              label={i.inventory.reasonOptional}
              placeholder={i.inventory.adjustReasonPlaceholder}
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
                {i.common.cancel}
              </Button>
              <Button type="submit" loading={isAdjusting}>
                {i.inventory.adjustStock}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {scannerOpen && (
        <BarcodeScanner
          language={language}
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
