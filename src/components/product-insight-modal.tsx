"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { LocalProduct } from "@/lib/offline-db";
import type {
  InventoryInsight,
  ProductPerformanceMetric,
} from "@/lib/product-performance";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  getProductDisplayName,
  type NumberFormat,
} from "@/lib/utils";

interface ProductInsightModalProps {
  open: boolean;
  onClose: () => void;
  product: LocalProduct | null;
  metric?: ProductPerformanceMetric;
  insight?: InventoryInsight;
  currency: string;
  numberFormat?: NumberFormat;
  onEdit?: (product: LocalProduct) => void;
  onAddVariant?: (product: LocalProduct) => void;
  onDelete?: (product: LocalProduct) => void;
  deleting?: boolean;
}

function getActionLabel(action?: InventoryInsight["action"]) {
  switch (action) {
    case "reorder":
      return { text: "Reorder now", variant: "warning" as const };
    case "dead":
      return { text: "Dead stock", variant: "default" as const };
    case "watch":
      return { text: "Watch closely", variant: "info" as const };
    default:
      return { text: "Healthy", variant: "success" as const };
  }
}

export function ProductInsightModal({
  open,
  onClose,
  product,
  metric,
  insight,
  currency,
  numberFormat = "western",
  onEdit,
  onAddVariant,
  onDelete,
  deleting,
}: ProductInsightModalProps) {
  if (!product) return null;

  const title = getProductDisplayName(product.name, product.variantName);
  const action = getActionLabel(insight?.action);
  const margin = metric?.netRevenue
    ? (metric.grossProfit / metric.netRevenue) * 100
    : 0;
  const stockState = !product.trackStock
    ? { text: "Stock not tracked", variant: "info" as const }
    : product.stock <= 0
      ? { text: "Out of stock", variant: "danger" as const }
      : product.stock <= Math.max(1, product.lowStockAt || 5)
        ? { text: "Low stock", variant: "warning" as const }
        : { text: "In stock", variant: "success" as const };

  return (
    <Modal open={open} onClose={onClose} title={title} size="xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={action.variant}>{action.text}</Badge>
          <Badge variant={stockState.variant}>{stockState.text}</Badge>
          <Badge variant="info">
            {product.categoryName || "Uncategorized"}
          </Badge>
          {product.sku && <Badge variant="default">SKU {product.sku}</Badge>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sold today
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
              {formatNumber(metric?.soldToday ?? 0, numberFormat)}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Sold 7d
            </p>
            <p className="mt-2 text-2xl font-bold text-emerald-900 tabular-nums">
              {formatNumber(metric?.sold7d ?? 0, numberFormat)}
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
              Sold 30d
            </p>
            <p className="mt-2 text-2xl font-bold text-cyan-900 tabular-nums">
              {formatNumber(metric?.sold30d ?? 0, numberFormat)}
            </p>
          </div>
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
              Net revenue
            </p>
            <p className="mt-2 text-xl font-bold text-indigo-900 tabular-nums">
              {formatCurrency(metric?.netRevenue ?? 0, currency, numberFormat)}
            </p>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
              Gross profit
            </p>
            <p className="mt-2 text-xl font-bold text-violet-900 tabular-nums">
              {formatCurrency(metric?.grossProfit ?? 0, currency, numberFormat)}
            </p>
            <p className="mt-1 text-xs font-medium text-violet-700">
              {formatNumber(margin.toFixed(1), numberFormat)}% margin
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Orders / refunds
            </p>
            <p className="mt-2 text-xl font-bold text-amber-900 tabular-nums">
              {formatNumber(metric?.orderCount ?? 0, numberFormat)} /{" "}
              {formatNumber(metric?.refundCount ?? 0, numberFormat)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Performance summary
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {metric?.lastSoldAt
                  ? `Last sold ${formatDateTime(new Date(metric.lastSoldAt), "numeric", numberFormat)}.`
                  : "This item has not been sold yet."}
              </p>
            </div>
            <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              <p>
                Current stock:{" "}
                <span className="font-semibold text-slate-900">
                  {product.trackStock
                    ? `${formatNumber(product.stock, numberFormat)} ${product.unit}`
                    : "Not tracked"}
                </span>
              </p>
              <p>
                Low alert:{" "}
                <span className="font-semibold text-slate-900">
                  {formatNumber(
                    Math.max(1, product.lowStockAt || 5),
                    numberFormat,
                  )}{" "}
                  {product.unit}
                </span>
              </p>
              <p>
                Selling price:{" "}
                <span className="font-semibold text-slate-900">
                  {formatCurrency(product.price, currency, numberFormat)}
                </span>
              </p>
              <p>
                Cost price:{" "}
                <span className="font-semibold text-slate-900">
                  {formatCurrency(product.costPrice, currency, numberFormat)}
                </span>
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Recommended action
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {insight?.reason || "No urgent action is needed right now."}
              </p>
            </div>

            <div className="space-y-2 text-sm text-slate-600">
              <p>
                Coverage:{" "}
                <span className="font-semibold text-slate-900">
                  {insight?.coverageDays != null
                    ? `${formatNumber(insight.coverageDays.toFixed(1), numberFormat)} days`
                    : "Not enough sales history"}
                </span>
              </p>
              <p>
                Suggested reorder:{" "}
                <span className="font-semibold text-slate-900">
                  {insight?.recommendedQty
                    ? `${formatNumber(insight.recommendedQty, numberFormat)} ${product.unit}`
                    : "No reorder quantity suggested"}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          {onAddVariant && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddVariant(product)}
            >
              + Variant
            </Button>
          )}
          {onEdit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onEdit(product)}
            >
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="danger"
              size="sm"
              disabled={deleting}
              onClick={() => onDelete(product)}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
