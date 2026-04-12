"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useLocalProducts,
  useLocalCategories,
  useLocalOrders,
} from "@/hooks/use-local-data";
import { ProductActions } from "./product-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { offlineFetch } from "@/lib/offline-fetch";
import type { LocalProduct } from "@/lib/offline-db";
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
import { PageHeader } from "@/components/layout/page-header";
import { ProductInsightModal } from "@/components/product-insight-modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { IconCamera } from "@/components/icons";

const PAGE_SIZE = 10;

export function ProductsContent({
  merchantId,
  currency,
  numberFormat = "western",
}: {
  merchantId: string;
  currency: string;
  numberFormat?: NumberFormat;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);
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
    const families = new Set(
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
      familyCount: families.size,
      variantCount: products.length,
      lowStock,
      outOfStock,
      totalSold7d,
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
    const sorted = [...products].sort((a, b) => {
      const nameCompare = a.name.localeCompare(b.name);
      if (nameCompare !== 0) return nameCompare;
      return (a.variantName || "").localeCompare(b.variantName || "");
    });

    if (!query) return sorted;

    return sorted.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.variantName?.toLowerCase().includes(query) ||
        p.categoryName?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query) ||
        p.barcode?.toLowerCase().includes(query),
    );
  }, [products, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PAGE_SIZE),
  );
  const currentPage = Math.min(page, totalPages);
  const pagedProducts = filteredProducts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
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
        text: result.error || "Failed to delete product",
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
        failures.push(result.error || "Delete failed");
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
        title="Products"
        subtitle={`${formatNumber(productSummary.familyCount, numberFormat)} families · ${formatNumber(productSummary.variantCount, numberFormat)} sellable variants`}
      >
        <div className="flex flex-wrap gap-2">
          <ProductActions
            categories={categories}
            currency={currency}
            merchantId={merchantId}
          />
          <Button variant="secondary" onClick={() => setScannerOpen(true)}>
            <IconCamera size={18} />
            Scan
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Product families
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {formatNumber(productSummary.familyCount, numberFormat)}
          </p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
            Sellable variants
          </p>
          <p className="mt-2 text-2xl font-bold text-indigo-900 tabular-nums">
            {formatNumber(productSummary.variantCount, numberFormat)}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Units sold 7d
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-900 tabular-nums">
            {formatNumber(productSummary.totalSold7d, numberFormat)}
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
            Fast-moving variants
          </p>
          <p className="mt-2 text-2xl font-bold text-cyan-900 tabular-nums">
            {formatNumber(productSummary.fastMoving, numberFormat)}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Low-stock variants
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-900 tabular-nums">
            {formatNumber(productSummary.lowStock, numberFormat)}
          </p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
            Top seller 30d
          </p>
          <p className="mt-2 text-sm font-bold text-red-900 line-clamp-2">
            {productSummary.topSellerName}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Input
            id="product-search"
            label="Search products"
            placeholder="Name, variant, SKU, barcode, category..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="absolute right-2 bottom-1.5 p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
            title="Scan barcode"
          >
            <IconCamera size={20} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={editMode ? "primary" : "outline"}
            size="sm"
            onClick={() => {
              setEditMode((prev) => !prev);
              if (editMode) setSelectedIds([]);
            }}
          >
            {editMode ? "Done" : "Edit"}
          </Button>
          {editMode && selectedIds.length > 0 && (
            <Button
              variant="danger"
              size="sm"
              disabled={bulkDeleting}
              onClick={() => setConfirmBulkDelete(true)}
            >
              {bulkDeleting
                ? "Deleting..."
                : `Delete Selected (${formatNumber(selectedIds.length, numberFormat)})`}
            </Button>
          )}
        </div>
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
              {editMode && (
                <th className="px-4 py-3.5 text-left">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectPage}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
              )}
              <th className="px-5 py-3.5 text-left font-semibold">
                Product / Variant
              </th>
              <th className="px-5 py-3.5 text-left font-semibold">Category</th>
              <th className="px-5 py-3.5 text-left font-semibold">SKU</th>
              <th className="px-5 py-3.5 text-left font-semibold">Price</th>
              <th className="px-5 py-3.5 text-left font-semibold">Cost</th>
              <th className="px-5 py-3.5 text-left font-semibold">Stock</th>
              <th className="px-5 py-3.5 text-left font-semibold">Sold 7d</th>
              <th className="px-5 py-3.5 text-left font-semibold">
                Net Revenue
              </th>
              <th className="px-5 py-3.5 text-left font-semibold">Movement</th>
              <th className="px-5 py-3.5 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredProducts.length === 0 ? (
              <tr>
                <td
                  colSpan={editMode ? 12 : 11}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  {products.length === 0
                    ? "No products yet"
                    : "No products match your search"}
                </td>
              </tr>
            ) : (
              pagedProducts.map((p) => {
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
                    {editMode && (
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(p.id)}
                          onChange={() => toggleSelected(p.id)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                    )}
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
                      {p.categoryName || "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-500 font-mono text-xs">
                      {p.sku || "—"}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900 tabular-nums">
                      {formatCurrency(p.price, currency, numberFormat)}
                    </td>
                    <td className="px-5 py-4 text-slate-500 tabular-nums">
                      {formatCurrency(p.costPrice, currency, numberFormat)}
                    </td>
                    <td className="px-5 py-4 tabular-nums">
                      {p.trackStock ? formatNumber(p.stock, numberFormat) : "∞"}
                    </td>
                    <td className="px-5 py-4 tabular-nums text-slate-600">
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
                      <Badge variant={p.stock > 0 ? "success" : "danger"}>
                        {p.stock > 0 ? "In stock" : "Out"}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {filteredProducts.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Showing{" "}
            {formatNumber((currentPage - 1) * PAGE_SIZE + 1, numberFormat)}-
            {formatNumber(
              Math.min(currentPage * PAGE_SIZE, filteredProducts.length),
              numberFormat,
            )}{" "}
            of {formatNumber(filteredProducts.length, numberFormat)}
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
        title="Delete product"
        message={`Are you sure you want to delete "${confirmDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={Boolean(deletingId)}
      />

      <ConfirmModal
        open={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={() => {
          setConfirmBulkDelete(false);
          handleBulkDelete();
        }}
        title="Delete selected products"
        message={`Are you sure you want to delete ${formatNumber(selectedIds.length, numberFormat)} selected products? This action cannot be undone.`}
        confirmLabel="Delete all"
      />

      {scannerOpen && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {scannedBarcode && (
        <ProductActions
          categories={categories}
          currency={currency}
          merchantId={merchantId}
          initialBarcode={scannedBarcode}
          externalOpen
          onExternalClose={() => setScannedBarcode(null)}
        />
      )}
    </div>
  );
}
