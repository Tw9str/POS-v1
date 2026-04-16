"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { LocalProduct } from "@/lib/offlineDb";
import type {
  InventoryInsight,
  ProductPerformanceMetric,
} from "@/lib/productPerformance";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  getProductDisplayName,
  type NumberFormat,
} from "@/lib/utils";
import {
  t,
  translateInsightReason,
  translateUnit,
  type Locale,
  type TranslationKeys,
} from "@/lib/i18n";

interface ProductInsightModalProps {
  open: boolean;
  onClose: () => void;
  product: LocalProduct | null;
  metric?: ProductPerformanceMetric;
  insight?: InventoryInsight;
  currency: string;
  currencyFormat?: "symbol" | "code" | "none";
  numberFormat?: NumberFormat;
  language?: string;
  onEdit?: (product: LocalProduct) => void;
  onAddVariant?: (product: LocalProduct) => void;
  onDelete?: (product: LocalProduct) => void;
  deleting?: boolean;
}

function getActionLabel(
  action: InventoryInsight["action"] | undefined,
  pi: TranslationKeys["productInsight"],
) {
  switch (action) {
    case "reorder":
      return { text: pi.reorderNow, variant: "warning" as const };
    case "dead":
      return { text: pi.deadStock, variant: "default" as const };
    case "watch":
      return { text: pi.watchClosely, variant: "info" as const };
    default:
      return { text: pi.healthy, variant: "success" as const };
  }
}

export function ProductInsightModal({
  open,
  onClose,
  product,
  metric,
  insight,
  currency,
  currencyFormat = "symbol",
  numberFormat = "western",
  language = "en",
  onEdit,
  onAddVariant,
  onDelete,
  deleting,
}: ProductInsightModalProps) {
  const i = t(language as Locale);
  if (!product) return null;

  const title = getProductDisplayName(product.name, product.variantName);
  const action = getActionLabel(insight?.action, i.productInsight);
  const margin = metric?.netRevenue
    ? (metric.grossProfit / metric.netRevenue) * 100
    : 0;
  const stockState = !product.trackStock
    ? { text: i.productInsight.stockNotTracked, variant: "info" as const }
    : product.stock <= 0
      ? { text: i.productInsight.outOfStock, variant: "danger" as const }
      : product.stock <= Math.max(1, product.lowStockAt || 5)
        ? { text: i.productInsight.lowStock, variant: "warning" as const }
        : { text: i.productInsight.inStock, variant: "success" as const };

  return (
    <Modal open={open} onClose={onClose} title={title} size="xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={action.variant}>{action.text}</Badge>
          <Badge variant={stockState.variant}>{stockState.text}</Badge>
          <Badge variant="info">
            {product.categoryName === "Other"
              ? i.products.categoryOther
              : product.categoryName || i.productInsight.uncategorized}
          </Badge>
          {product.sku && (
            <Badge variant="default">
              {i.productInsight.sku} {product.sku}
            </Badge>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {i.productInsight.soldToday}
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
              {formatNumber(metric?.soldToday ?? 0, numberFormat)}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              {i.productInsight.sold7d}
            </p>
            <p className="mt-2 text-2xl font-bold text-emerald-900 tabular-nums">
              {formatNumber(metric?.sold7d ?? 0, numberFormat)}
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
              {i.productInsight.sold30d}
            </p>
            <p className="mt-2 text-2xl font-bold text-cyan-900 tabular-nums">
              {formatNumber(metric?.sold30d ?? 0, numberFormat)}
            </p>
          </div>
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
              {i.productInsight.netRevenue}
            </p>
            <p className="mt-2 text-xl font-bold text-indigo-900 tabular-nums">
              {formatCurrency(
                metric?.netRevenue ?? 0,
                currency,
                numberFormat,
                currencyFormat,
              )}
            </p>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
              {i.productInsight.grossProfit}
            </p>
            <p className="mt-2 text-xl font-bold text-violet-900 tabular-nums">
              {formatCurrency(
                metric?.grossProfit ?? 0,
                currency,
                numberFormat,
                currencyFormat,
              )}
            </p>
            <p className="mt-1 text-xs font-medium text-violet-700">
              {formatNumber(margin.toFixed(1), numberFormat)}%{" "}
              {i.productInsight.margin.toLowerCase()}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              {i.productInsight.ordersRefunds}
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
                {i.productInsight.performanceSummary}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {metric?.lastSoldAt
                  ? `${i.productInsight.lastSold} ${formatDateTime(new Date(metric.lastSoldAt), "numeric", numberFormat)}.`
                  : i.productInsight.notSoldYet}
              </p>
            </div>
            <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              <p>
                {i.productInsight.currentStock}{" "}
                <span className="font-semibold text-slate-900">
                  {product.trackStock
                    ? `${formatNumber(product.stock, numberFormat)} ${translateUnit(product.unit, language as Locale)}`
                    : i.productInsight.notTracked}
                </span>
              </p>
              <p>
                {i.productInsight.lowAlert}{" "}
                <span className="font-semibold text-slate-900">
                  {formatNumber(
                    Math.max(1, product.lowStockAt || 5),
                    numberFormat,
                  )}{" "}
                  {translateUnit(product.unit, language as Locale)}
                </span>
              </p>
              <p>
                {i.productInsight.sellingPrice}{" "}
                <span className="font-semibold text-slate-900">
                  {formatCurrency(
                    product.price,
                    currency,
                    numberFormat,
                    currencyFormat,
                  )}
                </span>
              </p>
              <p>
                {i.productInsight.costPrice}{" "}
                <span className="font-semibold text-slate-900">
                  {formatCurrency(
                    product.costPrice,
                    currency,
                    numberFormat,
                    currencyFormat,
                  )}
                </span>
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {i.productInsight.recommendedAction}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {insight
                  ? translateInsightReason(
                      insight.reasonKey,
                      language as Locale,
                      insight.reasonParams,
                    )
                  : i.productInsight.noUrgentAction}
              </p>
            </div>

            <div className="space-y-2 text-sm text-slate-600">
              <p>
                {i.productInsight.coverage}{" "}
                <span className="font-semibold text-slate-900">
                  {insight?.coverageDays != null
                    ? `${formatNumber(insight.coverageDays.toFixed(1), numberFormat)} ${i.productInsight.days}`
                    : i.productInsight.notEnoughHistory}
                </span>
              </p>
              <p>
                {i.productInsight.suggestedReorder}{" "}
                <span className="font-semibold text-slate-900">
                  {insight?.recommendedQty
                    ? `${formatNumber(insight.recommendedQty, numberFormat)} ${translateUnit(product.unit, language as Locale)}`
                    : i.productInsight.noReorderQty}
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
              {i.productInsight.addVariant}
            </Button>
          )}
          {onEdit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onEdit(product)}
            >
              {i.productInsight.editProduct}
            </Button>
          )}
          {onDelete && (
            <Button
              variant="danger"
              size="sm"
              disabled={deleting}
              onClick={() => onDelete(product)}
            >
              {deleting
                ? i.productInsight.deleting
                : i.productInsight.deleteProduct}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            {i.productInsight.close}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
