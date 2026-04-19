"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Order, Product, Customer } from "@/types/pos";
import { StatCard } from "@/components/ui/Card";
import {
  IconMoney,
  IconOrders,
  IconCustomers,
  IconProducts,
} from "@/components/Icons";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  type DateFormat,
  type NumberFormat,
} from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";

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
  order: Pick<Order, "status" | "total" | "notes">,
): number {
  if (order.status !== "REFUNDED" && order.status !== "PARTIALLY_REFUNDED") {
    return 0;
  }

  const match = (order.notes || "").match(/Partial refund amount:\s*([\d.]+)/i);
  const amount = match ? Number(match[1]) : order.total;
  return Number.isFinite(amount) ? Math.min(amount, order.total) : order.total;
}

function getOrderCost(order: Pick<Order, "items">): number {
  return order.items.reduce(
    (sum, item) => sum + item.costPrice * item.quantity,
    0,
  );
}

function getBaseProductName(name: string): string {
  return name.split(" · ")[0]?.trim() || name;
}

function buildSnapshot(list: Order[]): MetricSnapshot {
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
  currencyFormat = "symbol",
  numberFormat = "western",
  dateFormat = "long",
  language = "en",
  products,
  customers,
  orders,
}: {
  merchantId: string;
  currency: string;
  currencyFormat: "symbol" | "code" | "none";
  numberFormat?: NumberFormat;
  dateFormat?: DateFormat;
  language?: string;
  products: Product[];
  customers: Customer[];
  orders: Order[];
}) {
  const i = t(language as Locale);

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

    const dailyBuckets = new Map<string, Order[]>();
    for (const order of weekOrders) {
      const date = new Date(order.createdAt).toISOString().split("T")[0];
      const list = dailyBuckets.get(date) ?? [];
      list.push(order);
      dailyBuckets.set(date, list);
    }

    const dailyPerformance = Array.from(dailyBuckets.entries())
      .map(([date, dayOrders]) => ({ date, ...buildSnapshot(dayOrders) }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const productSales = new Map<
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
        const productName = getBaseProductName(item.name);

        const productEntry = productSales.get(productName) ?? {
          name: productName,
          quantity: 0,
          netRevenue: 0,
          grossProfit: 0,
        };
        productEntry.quantity += item.quantity;
        productEntry.netRevenue += itemNetRevenue;
        productEntry.grossProfit += itemProfit;
        productSales.set(productName, productEntry);

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

    const uniqueProducts = new Set(
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
      topProducts: Array.from(productSales.values())
        .sort((a, b) => b.netRevenue - a.netRevenue)
        .slice(0, 8),
      topVariants: Array.from(variantSales.values())
        .sort((a, b) => b.netRevenue - a.netRevenue)
        .slice(0, 8),
      productCount: uniqueProducts.size,
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
      // Credit / Receivables
      totalOutstanding: customers.reduce((sum, c) => sum + (c.balance || 0), 0),
      debtors: customers.filter((c) => (c.balance || 0) > 0),
      creditOrders: saleOrders.filter(
        (o) =>
          o.paymentStatus === "credit" || o.paymentStatus === "partial_credit",
      ),
      // Oldest credit order per customer
      oldestDebtByCustomer: (() => {
        const map = new Map<string, number>();
        for (const o of saleOrders) {
          if (
            (o.paymentStatus === "credit" ||
              o.paymentStatus === "partial_credit") &&
            o.customerId
          ) {
            const existing = map.get(o.customerId);
            if (!existing || o.createdAt < existing) {
              map.set(o.customerId, o.createdAt);
            }
          }
        }
        return map;
      })(),
    };
  }, [orders, products, customers, now]);

  const router = useRouter();
  const [showAllDebtors, setShowAllDebtors] = useState(false);
  const [debtorSearch, setDebtorSearch] = useState("");
  const [productTab, setProductTab] = useState<"products" | "variants">(
    "products",
  );

  const nowMs = Date.now();

  // Aging buckets: compute per-debtor age + credit order count
  const debtorDetails = useMemo(() => {
    const creditOrdersByCustomer = new Map<string, number>();
    for (const o of stats.creditOrders) {
      if (o.customerId) {
        creditOrdersByCustomer.set(
          o.customerId,
          (creditOrdersByCustomer.get(o.customerId) || 0) + 1,
        );
      }
    }

    return stats.debtors.map((d) => {
      const oldest = stats.oldestDebtByCustomer.get(d.id);
      const ageDays = oldest
        ? Math.floor((nowMs - oldest) / (1000 * 60 * 60 * 24))
        : 0;
      return {
        ...d,
        ageDays,
        creditOrderCount: creditOrdersByCustomer.get(d.id) || 0,
        ageBucket: ageDays < 30 ? 0 : ageDays < 60 ? 1 : ageDays < 90 ? 2 : 3,
      };
    });
  }, [stats.debtors, stats.oldestDebtByCustomer, stats.creditOrders, nowMs]);

  // Aging summary
  const agingSummary = useMemo(() => {
    const buckets = [
      { amount: 0, count: 0 },
      { amount: 0, count: 0 },
      { amount: 0, count: 0 },
      { amount: 0, count: 0 },
    ];
    for (const d of debtorDetails) {
      buckets[d.ageBucket].amount += d.balance || 0;
      buckets[d.ageBucket].count += 1;
    }
    return buckets;
  }, [debtorDetails]);

  const sortedDebtors = useMemo(() => {
    let list = [...debtorDetails].sort((a, b) => b.ageDays - a.ageDays);
    if (debtorSearch.trim()) {
      const q = debtorSearch.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.phone?.toLowerCase().includes(q) ||
          d.email?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [debtorDetails, debtorSearch]);

  const visibleDebtors = showAllDebtors
    ? sortedDebtors
    : sortedDebtors.slice(0, 10);

  const exportDebtorsCsv = useCallback(() => {
    const header = [
      i.common.name,
      i.common.phone,
      i.common.email,
      i.reports.totalOutstanding,
      i.reports.oldestDebt,
    ].join(",");

    const rows = sortedDebtors.map((d) => {
      const oldest = stats.oldestDebtByCustomer.get(d.id);
      return [
        `"${(d.name || "").replace(/"/g, '""')}"`,
        `"${d.phone || ""}"`,
        `"${d.email || ""}"`,
        d.balance || 0,
        oldest ? new Date(oldest).toISOString().split("T")[0] : "",
      ].join(",");
    });

    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "debtors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [sortedDebtors, stats.oldestDebtByCustomer, i]);

  const fc = (v: number) =>
    formatCurrency(v, currency, numberFormat, currencyFormat, language);
  const fn = (v: number) => formatNumber(v, numberFormat);

  const topList =
    productTab === "products" ? stats.topProducts : stats.topVariants;
  const topColor = productTab === "products" ? "indigo" : "emerald";

  return (
    <div className="space-y-6">
      <PageHeader title={i.reports.title} subtitle={i.reports.subtitle} />

      {/* ── Hero row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={i.reports.netRevenue}
          value={fc(stats.allTime.netRevenue)}
          subtitle={`${fn(stats.allTime.orderCount)} ${i.reports.nonVoidedOrders}`}
          icon={<IconMoney size={24} />}
        />
        <StatCard
          title={i.reports.grossProfit}
          value={fc(stats.allTime.grossProfit)}
          subtitle={`${stats.allTime.margin.toFixed(1)}% ${i.reports.margin}`}
          icon={<IconOrders size={24} />}
        />
        <StatCard
          title={i.reports.creditReport}
          value={fc(stats.totalOutstanding)}
          subtitle={`${fn(stats.debtors.length)} ${i.reports.debtors.toLowerCase()}`}
          icon={<IconCustomers size={24} />}
        />
      </div>

      {/* ── Period comparison ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
            {i.reports.periodComparison}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                <th className="px-6 py-3 text-start font-medium" />
                <th className="px-4 py-3 text-end font-medium">
                  {i.reports.netRevenue}
                </th>
                <th className="px-4 py-3 text-end font-medium">
                  {i.reports.orders}
                </th>
                <th className="px-4 py-3 text-end font-medium">
                  {i.reports.profit}
                </th>
                <th className="px-4 py-3 text-end font-medium">
                  {i.reports.avgOrderValueLabel}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(
                [
                  { label: i.common.today, data: stats.today },
                  { label: i.reports.thisWeek, data: stats.week },
                  { label: i.reports.thisMonth, data: stats.month },
                  { label: i.reports.allTime, data: stats.allTime },
                ] as const
              ).map((row) => (
                <tr key={row.label} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3 font-semibold text-slate-700">
                    {row.label}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums font-bold text-slate-900">
                    {fc(row.data.netRevenue)}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums text-slate-700">
                    {fn(row.data.orderCount)}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums font-semibold text-emerald-700">
                    {fc(row.data.grossProfit)}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums text-slate-600">
                    {fc(row.data.avgOrder)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Two-column: Top Selling + Credit/Receivables ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top Selling (tabbed) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              {i.reports.topSelling}
            </h2>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setProductTab("products")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  productTab === "products"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {i.reports.products}
              </button>
              <button
                type="button"
                onClick={() => setProductTab("variants")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  productTab === "variants"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {i.reports.variants}
              </button>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {topList.length === 0 ? (
              <div className="px-6 py-10 text-center text-slate-400 text-sm">
                {productTab === "products"
                  ? i.reports.noProductData
                  : i.reports.noVariantData}
              </div>
            ) : (
              topList.map((item, index) => (
                <div
                  key={item.name}
                  className="px-6 py-3.5 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                        topColor === "indigo"
                          ? "bg-indigo-50 text-indigo-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {fn(index + 1)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 capitalize truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {fn(item.quantity)} {i.reports.units} ·{" "}
                        {fc(item.grossProfit)} {i.reports.profit}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">
                    {fc(item.netRevenue)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Credit / Receivables */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                {i.reports.creditReport}
              </h2>
              <p className="text-lg font-bold text-amber-700 tabular-nums mt-0.5">
                {fc(stats.totalOutstanding)}
                <span className="text-xs font-normal text-slate-400 ms-1.5">
                  {i.reports.totalOutstanding.toLowerCase()}
                </span>
              </p>
            </div>
            {stats.debtors.length > 0 && (
              <button
                type="button"
                onClick={exportDebtorsCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                CSV
              </button>
            )}
          </div>

          {stats.debtors.length === 0 ? (
            <div className="px-6 py-10 text-center text-slate-400 text-sm">
              {i.reports.noDebtors}
            </div>
          ) : (
            <>
              {/* Aging Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4">
                {[
                  { from: 0, to: 30, color: "emerald" as const, idx: 0 },
                  { from: 30, to: 60, color: "amber" as const, idx: 1 },
                  { from: 60, to: 90, color: "orange" as const, idx: 2 },
                  { from: 90, to: 0, color: "red" as const, idx: 3 },
                ].map(({ from, to, color, idx }) => {
                  const label =
                    idx === 3
                      ? i.reports.agingDaysPlus.replace("{from}", fn(from))
                      : i.reports.agingDays
                          .replace("{from}", fn(from))
                          .replace("{to}", fn(to));
                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border px-3 py-2.5 ${
                        color === "emerald"
                          ? "border-emerald-200 bg-emerald-50"
                          : color === "amber"
                            ? "border-amber-200 bg-amber-50"
                            : color === "orange"
                              ? "border-orange-200 bg-orange-50"
                              : "border-red-200 bg-red-50"
                      }`}
                    >
                      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                        {label}
                      </p>
                      <p
                        className={`text-base font-bold tabular-nums mt-0.5 ${
                          color === "emerald"
                            ? "text-emerald-700"
                            : color === "amber"
                              ? "text-amber-700"
                              : color === "orange"
                                ? "text-orange-700"
                                : "text-red-700"
                        }`}
                      >
                        {fc(agingSummary[idx].amount)}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {fn(agingSummary[idx].count)}{" "}
                        {i.nav.customers.toLowerCase()}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Search */}
              <div className="px-6 pb-3">
                <input
                  type="text"
                  value={debtorSearch}
                  onChange={(e) => setDebtorSearch(e.target.value)}
                  placeholder={i.reports.debtorSearch}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </div>

              {/* Debtor Table */}
              <div className="divide-y divide-slate-50">
                {visibleDebtors.map((debtor) => (
                  <div
                    key={debtor.id}
                    className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/dashboard/customers`)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-blue-700 capitalize hover:underline truncate">
                          {debtor.name}
                        </p>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${
                            debtor.ageBucket === 0
                              ? "bg-emerald-100 text-emerald-700"
                              : debtor.ageBucket === 1
                                ? "bg-amber-100 text-amber-700"
                                : debtor.ageBucket === 2
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-red-100 text-red-700"
                          }`}
                        >
                          {i.reports.ageDays.replace(
                            "{days}",
                            String(debtor.ageDays),
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {(debtor.phone || debtor.email) && (
                          <span className="text-xs text-slate-400">
                            {debtor.phone || debtor.email}
                          </span>
                        )}
                        <span className="text-xs text-slate-300">·</span>
                        <span className="text-xs text-slate-400">
                          {fn(debtor.creditOrderCount)} {i.reports.unpaidOrders}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-amber-700 tabular-nums whitespace-nowrap">
                      {fc(debtor.balance || 0)}
                    </span>
                  </div>
                ))}
                {sortedDebtors.length > 10 && (
                  <div className="px-6 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => setShowAllDebtors((prev) => !prev)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {showAllDebtors
                        ? i.reports.showLess
                        : `${i.reports.viewAll} (${sortedDebtors.length})`}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Daily Performance ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
            {i.reports.dailyPerformanceLast7}
          </h2>
        </div>
        {stats.dailyPerformance.length === 0 ? (
          <div className="px-6 py-10 text-center text-slate-400 text-sm">
            {i.reports.noSalesData}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="px-6 py-3 text-start font-medium">
                    {i.orders.date}
                  </th>
                  <th className="px-4 py-3 text-end font-medium">
                    {i.reports.orders}
                  </th>
                  <th className="px-4 py-3 text-end font-medium">
                    {i.reports.netRevenue}
                  </th>
                  <th className="px-4 py-3 text-end font-medium">
                    {i.reports.profit}
                  </th>
                  <th className="px-4 py-3 text-end font-medium">
                    {i.reports.refunds}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.dailyPerformance.map((day) => (
                  <tr key={day.date} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-semibold text-slate-700">
                      {formatDate(day.date, dateFormat, numberFormat)}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-slate-700">
                      {fn(day.orderCount)}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums font-bold text-slate-900">
                      {fc(day.netRevenue)}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums font-semibold text-emerald-700">
                      {fc(day.grossProfit)}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-slate-500">
                      {fc(day.refundedRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Financials + Store Overview ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-5">
            {i.reports.financials}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-5 gap-x-4">
            <div>
              <p className="text-xs text-slate-400">{i.reports.grossSales}</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
                {fc(stats.allTime.grossSales)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">
                {i.reports.refundedRevenue}
              </p>
              <p className="text-lg font-bold text-rose-700 mt-0.5 tabular-nums">
                {fc(stats.allTime.refundedRevenue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{i.reports.netCogs}</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
                {fc(stats.allTime.netCogs)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{i.reports.refundRate}</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
                {stats.refundRate.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{i.reports.refundVoid}</p>
              <p className="text-lg font-bold text-rose-700 mt-0.5 tabular-nums">
                {fn(stats.refundedOrders.length)} /{" "}
                {fn(stats.voidedOrders.length)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">
                {i.reports.avgDailyOrders}
              </p>
              <p className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
                {fn(stats.avgDailyOrders)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-5">
            {i.reports.storeOverview}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-5 gap-x-4">
            <div>
              <p className="text-xs text-slate-400">{i.reports.products}</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
                {fn(stats.productCount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{i.reports.variants}</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
                {fn(stats.variantCount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{i.reports.customers}</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
                {fn(customers.length)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">
                {i.reports.avgOrderValueLabel}
              </p>
              <p className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
                {fc(stats.allTime.avgOrder)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{i.reports.lowOutStock}</p>
              <p className="text-lg font-bold text-amber-700 mt-0.5 tabular-nums">
                {fn(stats.lowStockCount)} / {fn(stats.outOfStockCount)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
