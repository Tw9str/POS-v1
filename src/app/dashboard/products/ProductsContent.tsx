"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useLocalProducts,
  useLocalCategories,
  useLocalOrders,
} from "@/hooks/useLocalData";
import { ProductActions } from "./ProductActions";
import { Button } from "@/components/ui/Button";
import { offlineFetch } from "@/lib/offline-fetch";
import type { LocalProduct } from "@/lib/offlineDb";
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
import { PageHeader } from "@/components/layout/PageHeader";
import { ProductInsightModal } from "@/components/ProductInsightModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { IconCamera } from "@/components/Icons";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import {
  SortableTh,
  useSortToggle,
  type SortDirection,
} from "@/components/ui/SortableTh";
import { t, type Locale } from "@/lib/i18n";

const PAGE_SIZES = [10, 25, 50, 100];

export function ProductsContent({
  merchantId,
  currency,
  currencyFormat = "symbol",
  numberFormat = "western",
  language = "en",
}: {
  merchantId: string;
  currency: string;
  currencyFormat: "symbol" | "code" | "none";
  numberFormat?: NumberFormat;
  language?: string;
}) {
  const router = useRouter();
  const i = t(language as Locale);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [selectedInsightProduct, setSelectedInsightProduct] =
    useState<LocalProduct | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [editProduct, setEditProduct] = useState<LocalProduct | null>(null);
  const [addVariantProduct, setAddVariantProduct] =
    useState<LocalProduct | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const toggleSort = useSortToggle();
  const products = useLocalProducts(merchantId);
  const categories = useLocalCategories(merchantId);
  const orders = useLocalOrders(merchantId, 500);

  const performance = useMemo(
    () => buildProductPerformance(orders, products),
    [orders, products],
  );
  const inventoryInsights = useMemo(
    () => buildInventoryInsights(products, performance),
    [products, performance],
  );
  const insightMap = useMemo(
    () => new Map(inventoryInsights.map((item) => [item.productId, item])),
    [inventoryInsights],
  );

  const productSummary = useMemo(() => {
    const uniqueProducts = new Set(
      products.map((p) => p.name.trim().toLowerCase()).filter(Boolean),
    );
    const lowStock = products.filter(
      (p) =>
        p.trackStock &&
        p.stock > 0 &&
        p.stock <= Math.max(1, p.lowStockAt || 5),
    ).length;
    const outOfStock = products.filter(
      (p) => p.trackStock && p.stock <= 0,
    ).length;
    const totalSold7d = Array.from(performance.values()).reduce(
      (sum, metric) => sum + metric.sold7d,
      0,
    );
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTs = todayStart.getTime();
    const unitsSoldToday = orders
      .filter((o) => o.createdAt >= todayTs && o.status !== "VOIDED")
      .reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);
    const fastMoving = Array.from(performance.values()).filter(
      (metric) => metric.movement === "fast",
    ).length;
    const topSeller = [...products]
      .map((product) => ({ product, metric: performance.get(product.id) }))
      .sort(
        (a, b) =>
          (b.metric?.sold30d ?? 0) - (a.metric?.sold30d ?? 0) ||
          (b.metric?.netRevenue ?? 0) - (a.metric?.netRevenue ?? 0),
      )[0];

    return {
      productCount: uniqueProducts.size,
      variantCount: products.length,
      lowStock,
      outOfStock,
      totalSold7d,
      unitsSoldToday,
      fastMoving,
      topSellerName:
        topSeller && (topSeller.metric?.sold30d ?? 0) > 0
          ? getProductDisplayName(
              topSeller.product.name,
              topSeller.product.variantName,
            )
          : "No sales yet",
    };
  }, [products, performance]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = products.filter((p) => {
      const matchesSearch =
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.variantName?.toLowerCase().includes(query) ||
        p.categoryName?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query) ||
        p.barcode?.toLowerCase().includes(query);

      const matchesCategory =
        categoryFilter === "all" || p.categoryId === categoryFilter;

      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "in" && (!p.trackStock || p.stock > 0)) ||
        (stockFilter === "low" &&
          p.trackStock &&
          p.stock > 0 &&
          p.stock <= Math.max(1, p.lowStockAt || 5)) ||
        (stockFilter === "out" && p.trackStock && p.stock <= 0);

      return matchesSearch && matchesCategory && matchesStock;
    });

    return filtered.sort((a, b) => {
      if (!sortKey || !sortDir) {
        const nameCompare = a.name.localeCompare(b.name);
        if (nameCompare !== 0) return nameCompare;
        return (a.variantName || "").localeCompare(b.variantName || "");
      }

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
        case "price":
          cmp = a.price - b.price;
          break;
        case "cost":
          cmp = a.costPrice - b.costPrice;
          break;
        case "sold7d":
          cmp = (metricA?.sold7d ?? 0) - (metricB?.sold7d ?? 0);
          break;
        case "created":
          cmp = a.createdAt - b.createdAt;
          break;
      }

      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [
    products,
    search,
    categoryFilter,
    stockFilter,
    sortKey,
    sortDir,
    performance,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const pageIds = pagedProducts.map((p) => p.id);
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

  async function handleDeleteProduct(id: string, name: string) {
    setDeletingId(id);
    setFeedback(null);
    const result = await offlineFetch({
      url: "/api/merchant/products",
      method: "DELETE",
      body: { id },
      entity: "product",
      merchantId,
    });

    if (!result.ok) {
      setFeedback({
        type: "error",
        text: result.error || i.products.failedToDelete,
      });
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      setFeedback({ type: "success", text: `Deleted "${name}".` });
      router.refresh();
    }
    setDeletingId(null);
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;

    setBulkDeleting(true);
    setFeedback(null);
    const failures: string[] = [];

    for (const id of selectedIds) {
      const result = await offlineFetch({
        url: "/api/merchant/products",
        method: "DELETE",
        body: { id },
        entity: "product",
        merchantId,
      });

      if (!result.ok) {
        failures.push(result.error || i.common.deleteFailed);
      }
    }

    if (failures.length > 0) {
      setFeedback({ type: "error", text: failures[0] });
    } else {
      setFeedback({
        type: "success",
        text: `Deleted ${selectedIds.length} products.`,
      });
      setSelectedIds([]);
      router.refresh();
    }

    setBulkDeleting(false);
  }

  function handleBarcodeScan(barcode: string) {
    setScannerOpen(false);
    const existing = products.find(
      (p) => p.barcode?.toLowerCase() === barcode.toLowerCase(),
    );
    if (existing) {
      setSelectedInsightProduct(existing);
    } else {
      setScannedBarcode(barcode);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={i.products.title}
        subtitle={`${formatNumber(productSummary.productCount, numberFormat)} ${i.products.products} · ${formatNumber(productSummary.variantCount, numberFormat)} ${i.products.variants}`}
      >
        <div className="flex flex-wrap gap-2">
          <ProductActions
            categories={categories}
            currency={currency}
            merchantId={merchantId}
            language={language}
          />
          <Button variant="secondary" onClick={() => setScannerOpen(true)}>
            <IconCamera size={18} />
            {i.common.scan}
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
            {i.products.title}
          </p>
          <p className="mt-2 text-2xl font-bold text-indigo-900 tabular-nums">
            {formatNumber(productSummary.productCount, numberFormat)}
            <span className="text-sm font-medium text-indigo-600 ms-1.5">
              / {formatNumber(productSummary.variantCount, numberFormat)}{" "}
              {i.products.variants}
            </span>
          </p>
          <div className="mt-1 flex items-center gap-3 text-xs text-indigo-600">
            {productSummary.lowStock > 0 && (
              <span className="text-amber-700">
                {formatNumber(productSummary.lowStock, numberFormat)}{" "}
                {i.products.lowStock}
              </span>
            )}
            {productSummary.outOfStock > 0 && (
              <span className="text-red-700">
                {formatNumber(productSummary.outOfStock, numberFormat)}{" "}
                {i.products.outOfStock}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {i.products.unitsSold7d}
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-900 tabular-nums">
            {formatNumber(productSummary.totalSold7d, numberFormat)}
          </p>
          <p className="mt-1 text-xs text-emerald-600">
            {i.products.soldToday}:{" "}
            {formatNumber(productSummary.unitsSoldToday, numberFormat)}
            {productSummary.fastMoving > 0 && (
              <>
                {" "}
                · {formatNumber(productSummary.fastMoving, numberFormat)}{" "}
                {i.products.fastMovers}
              </>
            )}
          </p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            {i.products.topSeller30d}
          </p>
          <p className="mt-2 text-base font-bold text-violet-900 line-clamp-2">
            {productSummary.topSellerName}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-end">
        <SearchInput
          id="product-search"
          label={i.common.search}
          placeholder={i.products.searchPlaceholder}
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          resultCount={filteredProducts.length}
          totalCount={products.length}
          numberFormat={numberFormat}
          onScan={() => setScannerOpen(true)}
          language={language}
          className="w-full md:max-w-sm"
        />
        <Select
          id="product-category-filter"
          label={i.products.category}
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "all", label: i.products.allCategories },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <Select
          id="product-stock-filter"
          label={i.products.stock}
          value={stockFilter}
          onChange={(e) => {
            setStockFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "all", label: i.products.allStock },
            { value: "in", label: i.products.inStock },
            { value: "low", label: i.products.lowStock },
            { value: "out", label: i.products.outOfStock },
          ]}
        />
        <Select
          id="product-page-size"
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
                label={i.products.product}
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
                label={i.products.category}
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
                label={i.products.price}
                sortKey="price"
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
                label={i.products.sold7d}
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
                label={i.products.created}
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
              <th className="px-4 py-3.5 text-end">{i.common.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredProducts.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  {products.length === 0
                    ? i.products.noProductsYet
                    : i.products.noProductsMatch}
                </td>
              </tr>
            ) : (
              pagedProducts.map((p) => {
                const metric = performance.get(p.id);

                return (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p.id)}
                        onChange={() => toggleSelected(p.id)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-5 py-4 text-slate-800">
                      <button
                        type="button"
                        className="text-start group/name cursor-pointer"
                        onClick={() => setSelectedInsightProduct(p)}
                      >
                        <p className="font-semibold capitalize text-indigo-600 underline decoration-indigo-300/0 group-hover/name:decoration-indigo-300 transition-all">
                          {getProductDisplayName(p.name, p.variantName)}
                        </p>
                        {p.sku && (
                          <p className="text-xs text-slate-400 font-mono mt-0.5">
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
                      {formatCurrency(
                        p.price,
                        currency,
                        numberFormat,
                        currencyFormat,
                        language,
                      )}
                    </td>
                    <td className="px-5 py-4 tabular-nums text-slate-600">
                      {formatNumber(metric?.sold7d ?? 0, numberFormat)}
                    </td>
                    <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                      {formatDateTime(
                        new Date(p.createdAt),
                        "long",
                        numberFormat,
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          title={i.common.edit}
                          onClick={() => setEditProduct(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title={i.common.delete}
                          onClick={() =>
                            setConfirmDelete({
                              id: p.id,
                              name: getProductDisplayName(
                                p.name,
                                p.variantName,
                              ),
                            })
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Floating action bar */}
      {selectedIds.length > 0 && (
        <div className="sticky bottom-4 z-20 mx-auto w-fit">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-lg">
            <span className="text-sm font-medium text-slate-700">
              {formatNumber(selectedIds.length, numberFormat)}{" "}
              {i.common.selected}
            </span>
            <div className="w-px h-5 bg-slate-200" />
            <Button
              variant="danger"
              size="sm"
              disabled={bulkDeleting}
              onClick={() => setConfirmBulkDelete(true)}
            >
              {bulkDeleting ? i.common.deleting : i.common.deleteSelected}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedIds([])}
            >
              {i.common.cancel}
            </Button>
          </div>
        </div>
      )}

      {filteredProducts.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            {i.common.showing}{" "}
            {formatNumber((currentPage - 1) * pageSize + 1, numberFormat)}-
            {formatNumber(
              Math.min(currentPage * pageSize, filteredProducts.length),
              numberFormat,
            )}{" "}
            {i.common.of} {formatNumber(filteredProducts.length, numberFormat)}
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
          setEditProduct(p);
        }}
        onAddVariant={(p) => {
          setSelectedInsightProduct(null);
          setAddVariantProduct(p);
        }}
        onDelete={(p) => {
          setSelectedInsightProduct(null);
          setConfirmDelete({
            id: p.id,
            name: getProductDisplayName(p.name, p.variantName),
          });
        }}
        deleting={
          selectedInsightProduct
            ? deletingId === selectedInsightProduct.id
            : false
        }
      />

      {editProduct && (
        <ProductActions
          categories={categories}
          currency={currency}
          merchantId={merchantId}
          language={language}
          product={editProduct}
          externalOpen
          onExternalClose={() => setEditProduct(null)}
        />
      )}

      {addVariantProduct && (
        <ProductActions
          categories={categories}
          currency={currency}
          merchantId={merchantId}
          language={language}
          prefillProduct={{
            name: addVariantProduct.name,
            categoryId: addVariantProduct.categoryId,
            price: addVariantProduct.price,
            costPrice: addVariantProduct.costPrice,
            lowStockAt: addVariantProduct.lowStockAt,
            unit: addVariantProduct.unit,
            trackStock: addVariantProduct.trackStock,
          }}
          externalOpen
          onExternalClose={() => setAddVariantProduct(null)}
        />
      )}

      <ConfirmModal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            handleDeleteProduct(confirmDelete.id, confirmDelete.name);
            setConfirmDelete(null);
          }
        }}
        title={i.products.deleteProduct}
        message={i.products.deleteProductConfirm.replace(
          "{name}",
          confirmDelete?.name || "",
        )}
        confirmLabel={i.common.delete}
        loading={Boolean(deletingId)}
      />

      <ConfirmModal
        open={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={() => {
          setConfirmBulkDelete(false);
          handleBulkDelete();
        }}
        title={i.products.deleteSelectedProducts}
        message={i.products.deleteSelectedConfirm.replace(
          "{count}",
          formatNumber(selectedIds.length, numberFormat),
        )}
        confirmLabel={i.products.deleteAll}
      />

      {scannerOpen && (
        <BarcodeScanner
          language={language}
          onScan={handleBarcodeScan}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {scannedBarcode && (
        <ProductActions
          categories={categories}
          currency={currency}
          merchantId={merchantId}
          language={language}
          initialBarcode={scannedBarcode}
          externalOpen
          onExternalClose={() => setScannedBarcode(null)}
        />
      )}
    </div>
  );
}
