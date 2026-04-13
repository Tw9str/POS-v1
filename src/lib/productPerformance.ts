import type { LocalOrder, LocalProduct } from "@/lib/offlineDb";

export type ProductMovement = "fast" | "steady" | "slow" | "dead";
export type InventoryAction = "reorder" | "watch" | "dead" | "healthy";

export interface ProductPerformanceMetric {
  soldToday: number;
  sold7d: number;
  sold30d: number;
  grossRevenue: number;
  netRevenue: number;
  grossProfit: number;
  lastSoldAt: number | null;
  refundCount: number;
  orderCount: number;
  movement: ProductMovement;
  stockCoverageDays: number | null;
}

export interface InventoryInsight {
  productId: string;
  action: InventoryAction;
  priority: number;
  reason: string;
  threshold: number;
  recommendedQty: number;
  coverageDays: number | null;
}

export function getRefundAmount(
  order: Pick<LocalOrder, "status" | "total" | "notes">,
): number {
  if (order.status !== "REFUNDED" && order.status !== "PARTIALLY_REFUNDED") {
    return 0;
  }

  const match = (order.notes || "").match(/Partial refund amount:\s*([\d.]+)/i);
  const amount = match ? Number(match[1]) : order.total;
  return Number.isFinite(amount) ? Math.min(amount, order.total) : order.total;
}

export function buildProductPerformance(
  orders: LocalOrder[],
  products: LocalProduct[],
): Map<string, ProductPerformanceMetric> {
  const now = Date.now();
  const todayStart = new Date(new Date(now).setHours(0, 0, 0, 0)).getTime();
  const last7d = now - 7 * 24 * 60 * 60 * 1000;
  const last30d = now - 30 * 24 * 60 * 60 * 1000;

  const metrics = new Map<string, ProductPerformanceMetric>();

  for (const product of products) {
    metrics.set(product.id, {
      soldToday: 0,
      sold7d: 0,
      sold30d: 0,
      grossRevenue: 0,
      netRevenue: 0,
      grossProfit: 0,
      lastSoldAt: null,
      refundCount: 0,
      orderCount: 0,
      movement: "dead",
      stockCoverageDays: null,
    });
  }

  for (const order of orders) {
    if (order.status === "VOIDED") continue;

    const refundAmount = getRefundAmount(order);
    const refundRatio =
      order.total > 0 ? Math.min(1, refundAmount / order.total) : 0;
    const isFullyRefunded = order.status === "REFUNDED";
    const isRefunded = refundAmount > 0;

    for (const item of order.items) {
      const metric = metrics.get(item.productId);
      if (!metric) continue;

      const grossRevenue = item.price * item.quantity - item.discount;
      const netRevenue = grossRevenue * (1 - refundRatio);
      const netCost = item.costPrice * item.quantity * (1 - refundRatio);
      const effectiveQuantity = isFullyRefunded ? 0 : item.quantity;

      metric.grossRevenue += grossRevenue;
      metric.netRevenue += netRevenue;
      metric.grossProfit += netRevenue - netCost;
      metric.orderCount += 1;
      if (isRefunded) metric.refundCount += 1;

      if (order.createdAt >= todayStart) metric.soldToday += effectiveQuantity;
      if (order.createdAt >= last7d) metric.sold7d += effectiveQuantity;
      if (order.createdAt >= last30d) metric.sold30d += effectiveQuantity;

      if (effectiveQuantity > 0) {
        metric.lastSoldAt = Math.max(metric.lastSoldAt ?? 0, order.createdAt);
      }
    }
  }

  for (const product of products) {
    const metric = metrics.get(product.id);
    if (!metric) continue;

    if (metric.sold30d >= 20) metric.movement = "fast";
    else if (metric.sold30d >= 6) metric.movement = "steady";
    else if (metric.sold30d > 0) metric.movement = "slow";
    else metric.movement = "dead";

    if (product.trackStock && metric.sold30d > 0) {
      const dailyVelocity = metric.sold30d / 30;
      metric.stockCoverageDays =
        dailyVelocity > 0 ? product.stock / dailyVelocity : null;
    }
  }

  return metrics;
}

export function buildInventoryInsights(
  products: LocalProduct[],
  performance: Map<string, ProductPerformanceMetric>,
): InventoryInsight[] {
  return products
    .filter((product) => product.trackStock)
    .map((product) => {
      const metric = performance.get(product.id);
      const threshold = Math.max(1, product.lowStockAt || 5);
      const coverageDays = metric?.stockCoverageDays ?? null;
      const dailyVelocity = (metric?.sold30d ?? 0) / 30;
      const targetDays =
        metric?.movement === "fast"
          ? 21
          : metric?.movement === "steady"
            ? 14
            : 10;
      const targetStock =
        dailyVelocity > 0
          ? Math.max(threshold * 2, Math.ceil(dailyVelocity * targetDays))
          : threshold;
      const recommendedQty = Math.max(
        0,
        Math.ceil(targetStock - product.stock),
      );

      if ((metric?.sold30d ?? 0) === 0 && product.stock > threshold) {
        return {
          productId: product.id,
          action: "dead" as const,
          priority: Math.min(100, 40 + product.stock),
          reason: `No sales in the last 30 days with ${product.stock} ${product.unit} still on hand.`,
          threshold,
          recommendedQty: 0,
          coverageDays,
        };
      }

      if (product.stock <= 0) {
        return {
          productId: product.id,
          action: dailyVelocity > 0 ? ("reorder" as const) : ("watch" as const),
          priority: dailyVelocity > 0 ? 100 : 65,
          reason:
            dailyVelocity > 0
              ? "Out of stock while demand is still active."
              : "Out of stock, but recent demand has been quiet.",
          threshold,
          recommendedQty: Math.max(recommendedQty, threshold),
          coverageDays: 0,
        };
      }

      if (
        product.stock <= threshold ||
        (coverageDays !== null && coverageDays <= 7)
      ) {
        return {
          productId: product.id,
          action: "reorder" as const,
          priority: Math.min(99, 75 + Math.round(metric?.sold7d ?? 0)),
          reason:
            coverageDays !== null && coverageDays <= 7
              ? `Only about ${coverageDays.toFixed(1)} days of stock remain at the current pace.`
              : "Stock is already at or below the low-alert threshold.",
          threshold,
          recommendedQty: Math.max(recommendedQty, threshold),
          coverageDays,
        };
      }

      if (
        (coverageDays !== null && coverageDays <= 14) ||
        ((metric?.movement === "slow" || metric?.movement === "dead") &&
          product.stock > threshold * 2)
      ) {
        return {
          productId: product.id,
          action: "watch" as const,
          priority: 45 + Math.round(metric?.sold30d ?? 0),
          reason:
            coverageDays !== null && coverageDays <= 14
              ? "Demand is healthy, but stock coverage is getting tighter."
              : "Sales have slowed while stock remains relatively high.",
          threshold,
          recommendedQty,
          coverageDays,
        };
      }

      return {
        productId: product.id,
        action: "healthy" as const,
        priority: 0,
        reason: "Stock level and sales pace are currently balanced.",
        threshold,
        recommendedQty,
        coverageDays,
      };
    })
    .sort((a, b) => b.priority - a.priority);
}
