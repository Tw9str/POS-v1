"use client";

import { useMemo } from "react";
import {
  useLocalProducts,
  useLocalCustomers,
  useLocalOrders,
} from "@/hooks/use-local-data";
import type { LocalOrder } from "@/lib/offline-db";
import { StatCard } from "@/components/ui/card";
import {
  IconMoney,
  IconOrders,
  IconCustomers,
  IconProducts,
} from "@/components/icons";
import { PageHeader } from "@/components/layout/page-header";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  type DateFormat,
  type NumberFormat,
} from "@/lib/utils";

type MetricSnapshot = {
  grossSales: number;
  refundedRevenue: number;
  netRevenue: number;
  netCogs: number;
  grossProfit: number;
  margin: number;
  orderCount: number;
  avgOrder: number;
};

function getRefundAmount(
  order: Pick<LocalOrder, "status" | "total" | "notes">,
): number {
  if (order.status !== "REFUNDED" && order.status !== "PARTIALLY_REFUNDED") {
    return 0;
  }

  const match = (order.notes || "").match(/Partial refund amount:\s*([\d.]+)/i);
  const amount = match ? Number(match[1]) : order.total;
  return Number.isFinite(amount) ? Math.min(amount, order.total) : order.total;
}

function getOrderCost(order: Pick<LocalOrder, "items">): number {
  return order.items.reduce(
    (sum, item) => sum + item.costPrice * item.quantity,
    0,
  );
}

function getBaseProductName(name: string): string {
  return name.split(" — ")[0]?.trim() || name;
}

function buildSnapshot(list: LocalOrder[]): MetricSnapshot {
  const grossSales = list.reduce((sum, order) => sum + order.total, 0);
  const refundedRevenue = list.reduce(
    (sum, order) => sum + getRefundAmount(order),
    0,
  );
  const grossCogs = list.reduce((sum, order) => sum + getOrderCost(order), 0);
  const refundedCogs = list.reduce((sum, order) => {
    const refundAmount = getRefundAmount(order);
    if (!refundAmount || order.total <= 0) return sum;

    return sum + getOrderCost(order) * Math.min(1, refundAmount / order.total);
  }, 0);

  const netRevenue = grossSales - refundedRevenue;
  const netCogs = grossCogs - refundedCogs;
  const grossProfit = netRevenue - netCogs;
  const margin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

  return {
    grossSales,
    refundedRevenue,
    netRevenue,
    netCogs,
    grossProfit,
    margin,
    orderCount: list.length,
    avgOrder: list.length > 0 ? netRevenue / list.length : 0,
  };
}

export function ReportsContent({
  merchantId,
  currency,
  numberFormat = "western",
  dateFormat = "long",
}: {
  merchantId: string;
  currency: string;
  numberFormat?: NumberFormat;
  dateFormat?: DateFormat;
}) {
  const products = useLocalProducts(merchantId);
  const customers = useLocalCustomers(merchantId);
  const orders = useLocalOrders(merchantId, 500);

  const now = useMemo(() => {
    const d = new Date();
    return {
      todayStart: new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
      ).getTime(),
      weekStart: new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate() - 7,
      ).getTime(),
      monthStart: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
    };
  }, []);

  const stats = useMemo(() => {
    const saleOrders = orders.filter((order) => order.status !== "VOIDED");
    const refundedOrders = orders.filter(
      (order) =>
        order.status === "REFUNDED" || order.status === "PARTIALLY_REFUNDED",
    );
    const voidedOrders = orders.filter((order) => order.status === "VOIDED");

    const todayOrders = saleOrders.filter(
      (order) => order.createdAt >= now.todayStart,
    );
    const weekOrders = saleOrders.filter(
      (order) => order.createdAt >= now.weekStart,
    );
    const monthOrders = saleOrders.filter(
      (order) => order.createdAt >= now.monthStart,
    );

    const dailyBuckets = new Map<string, LocalOrder[]>();
    for (const order of weekOrders) {
      const date = new Date(order.createdAt).toISOString().split("T")[0];
      const list = dailyBuckets.get(date) ?? [];
      list.push(order);
      dailyBuckets.set(date, list);
    }

    const dailyPerformance = Array.from(dailyBuckets.entries())
      .map(([date, dayOrders]) => ({ date, ...buildSnapshot(dayOrders) }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const familySales = new Map<
      string,
      {
        name: string;
        quantity: number;
        netRevenue: number;
        grossProfit: number;
      }
    >();
    const variantSales = new Map<
      string,
      {
        name: string;
        quantity: number;
        netRevenue: number;
        grossProfit: number;
      }
    >();

    for (const order of saleOrders) {
      const refundAmount = getRefundAmount(order);
      const refundRatio =
        order.total > 0 ? Math.min(1, refundAmount / order.total) : 0;

      for (const item of order.items) {
        const itemGrossRevenue = item.price * item.quantity - item.discount;
        const itemNetRevenue = itemGrossRevenue * (1 - refundRatio);
        const itemNetCost = item.costPrice * item.quantity * (1 - refundRatio);
        const itemProfit = itemNetRevenue - itemNetCost;
        const familyName = getBaseProductName(item.name);

        const familyEntry = familySales.get(familyName) ?? {
          name: familyName,
          quantity: 0,
          netRevenue: 0,
          grossProfit: 0,
        };
        familyEntry.quantity += item.quantity;
        familyEntry.netRevenue += itemNetRevenue;
        familyEntry.grossProfit += itemProfit;
        familySales.set(familyName, familyEntry);

        const variantEntry = variantSales.get(item.name) ?? {
          name: item.name,
          quantity: 0,
          netRevenue: 0,
          grossProfit: 0,
        };
        variantEntry.quantity += item.quantity;
        variantEntry.netRevenue += itemNetRevenue;
        variantEntry.grossProfit += itemProfit;
        variantSales.set(item.name, variantEntry);
      }
    }

    const productFamilies = new Set(
      products
        .map((product) => product.name.trim().toLowerCase())
        .filter(Boolean),
    );

    return {
      today: buildSnapshot(todayOrders),
      week: buildSnapshot(weekOrders),
      month: buildSnapshot(monthOrders),
      allTime: buildSnapshot(saleOrders),
      refundedOrders,
      voidedOrders,
      dailyPerformance,
      topFamilies: Array.from(familySales.values())
        .sort((a, b) => b.netRevenue - a.netRevenue)
        .slice(0, 8),
      topVariants: Array.from(variantSales.values())
        .sort((a, b) => b.netRevenue - a.netRevenue)
        .slice(0, 8),
      familyCount: productFamilies.size,
      variantCount: products.length,
      lowStockCount: products.filter(
        (product) =>
          product.trackStock &&
          product.stock > 0 &&
          product.stock <= Math.max(1, product.lowStockAt || 5),
      ).length,
      outOfStockCount: products.filter(
        (product) => product.trackStock && product.stock <= 0,
      ).length,
      avgDailyOrders:
        dailyPerformance.length > 0
          ? Math.round(
              dailyPerformance.reduce((sum, day) => sum + day.orderCount, 0) /
                dailyPerformance.length,
            )
          : 0,
      refundRate:
        saleOrders.length > 0
          ? (refundedOrders.length / saleOrders.length) * 100
          : 0,
    };
  }, [orders, products, now]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        subtitle="Gross sales, refunds, net revenue, and profit analytics"
      />

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard
          title="Gross Sales"
          value={formatCurrency(
            stats.allTime.grossSales,
            currency,
            numberFormat,
          )}
          subtitle={`${formatNumber(stats.allTime.orderCount, numberFormat)} non-voided orders`}
          icon={<IconMoney size={24} />}
        />
        <StatCard
          title="Refunded Revenue"
          value={formatCurrency(
            stats.allTime.refundedRevenue,
            currency,
            numberFormat,
          )}
          subtitle={`${formatNumber(stats.refundedOrders.length, numberFormat)} refunded orders`}
          icon={<IconOrders size={24} />}
        />
        <StatCard
          title="Net Revenue"
          value={formatCurrency(
            stats.allTime.netRevenue,
            currency,
            numberFormat,
          )}
          subtitle={`${formatCurrency(stats.allTime.avgOrder, currency, numberFormat)} avg order value`}
          icon={<IconCustomers size={24} />}
        />
        <StatCard
          title="Net COGS"
          value={formatCurrency(stats.allTime.netCogs, currency, numberFormat)}
          subtitle="Estimated cost of sold goods after returns"
          icon={<IconProducts size={24} />}
        />
        <StatCard
          title="Gross Profit"
          value={formatCurrency(
            stats.allTime.grossProfit,
            currency,
            numberFormat,
          )}
          subtitle={`${stats.allTime.margin.toFixed(1)}% margin`}
          icon={<IconMoney size={24} />}
        />
        <StatCard
          title="Refund Rate"
          value={`${stats.refundRate.toFixed(1)}%`}
          subtitle={`${formatNumber(stats.voidedOrders.length, numberFormat)} voided orders`}
          icon={<IconOrders size={24} />}
        />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Today Net"
          value={formatCurrency(stats.today.netRevenue, currency, numberFormat)}
          subtitle={`${formatCurrency(stats.today.grossProfit, currency, numberFormat)} profit`}
          icon={<IconMoney size={22} />}
        />
        <StatCard
          title="This Week Net"
          value={formatCurrency(stats.week.netRevenue, currency, numberFormat)}
          subtitle={`${formatCurrency(stats.week.grossProfit, currency, numberFormat)} profit`}
          icon={<IconOrders size={22} />}
        />
        <StatCard
          title="This Month Net"
          value={formatCurrency(stats.month.netRevenue, currency, numberFormat)}
          subtitle={`${formatCurrency(stats.month.grossProfit, currency, numberFormat)} profit`}
          icon={<IconCustomers size={22} />}
        />
        <StatCard
          title="Avg Daily Orders"
          value={formatNumber(stats.avgDailyOrders, numberFormat)}
          subtitle={`${formatNumber(stats.today.orderCount, numberFormat)} orders today`}
          icon={<IconProducts size={22} />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Daily Performance (Last 7 Days)
            </h2>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.dailyPerformance.length === 0 ? (
              <div className="px-6 py-10 text-center text-slate-400 text-sm">
                No sales data yet
              </div>
            ) : (
              stats.dailyPerformance.map((day) => (
                <div
                  key={day.date}
                  className="px-6 py-3.5 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {formatDate(day.date, dateFormat, numberFormat)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatNumber(day.orderCount, numberFormat)} orders ·{" "}
                      {formatCurrency(
                        day.refundedRevenue,
                        currency,
                        numberFormat,
                      )}{" "}
                      refunds
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900 tabular-nums">
                      {formatCurrency(day.netRevenue, currency, numberFormat)}
                    </p>
                    <p className="text-xs text-emerald-700 font-semibold">
                      Profit{" "}
                      {formatCurrency(day.grossProfit, currency, numberFormat)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Top Product Families
            </h2>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.topFamilies.length === 0 ? (
              <div className="px-6 py-10 text-center text-slate-400 text-sm">
                No product-family data yet
              </div>
            ) : (
              stats.topFamilies.map((family, index) => (
                <div
                  key={family.name}
                  className="px-6 py-3.5 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center">
                      {formatNumber(index + 1, numberFormat)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 capitalize">
                        {family.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatNumber(family.quantity, numberFormat)} units ·{" "}
                        {formatCurrency(
                          family.grossProfit,
                          currency,
                          numberFormat,
                        )}{" "}
                        profit
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    {formatCurrency(family.netRevenue, currency, numberFormat)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Top Selling Variants
            </h2>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.topVariants.length === 0 ? (
              <div className="px-6 py-10 text-center text-slate-400 text-sm">
                No variant data yet
              </div>
            ) : (
              stats.topVariants.map((variant, index) => (
                <div
                  key={variant.name}
                  className="px-6 py-3.5 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center justify-center">
                      {formatNumber(index + 1, numberFormat)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 capitalize">
                        {variant.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatNumber(variant.quantity, numberFormat)} units ·{" "}
                        {formatCurrency(
                          variant.grossProfit,
                          currency,
                          numberFormat,
                        )}{" "}
                        profit
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    {formatCurrency(variant.netRevenue, currency, numberFormat)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-5">
            Store Overview
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-slate-500">Product Families</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                {formatNumber(stats.familyCount, numberFormat)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Sellable Variants</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                {formatNumber(stats.variantCount, numberFormat)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Customers</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                {formatNumber(customers.length, numberFormat)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Avg Order Value</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                {formatCurrency(stats.allTime.avgOrder, currency, numberFormat)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Low / Out Stock</p>
              <p className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">
                {formatNumber(stats.lowStockCount, numberFormat)} /{" "}
                {formatNumber(stats.outOfStockCount, numberFormat)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Refund / Void</p>
              <p className="text-2xl font-bold text-rose-700 mt-1 tabular-nums">
                {formatNumber(stats.refundedOrders.length, numberFormat)} /{" "}
                {formatNumber(stats.voidedOrders.length, numberFormat)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
