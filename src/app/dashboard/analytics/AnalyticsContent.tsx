"use client";

import { useMemo, useState } from "react";
import type { Order, Product, Customer } from "@/types/pos";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  IconActivity,
  IconCustomers,
  IconInventory,
  IconMoney,
  IconOrders,
  IconProducts,
} from "@/components/Icons";
import {
  buildInventoryInsights,
  buildProductPerformance,
  getRefundAmount,
} from "@/lib/productPerformance";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  getProductDisplayName,
  type DateFormat,
  type NumberFormat,
} from "@/lib/utils";
import {
  t,
  translateInsightReason,
  translatePaymentMethod,
  translateUnit,
  type Locale,
  type TranslationKeys,
} from "@/lib/i18n";

type MetricSnapshot = {
  grossSales: number;
  refundedRevenue: number;
  netRevenue: number;
  grossProfit: number;
  orderCount: number;
  avgOrder: number;
};

type AnalyticsRange = "day" | "7d" | "30d" | "90d" | "custom" | "all";

const RANGE_OPTIONS_KEYS: Array<{
  value: AnalyticsRange;
  labelKey: keyof TranslationKeys["analytics"];
}> = [
  { value: "day", labelKey: "specificDay" },
  { value: "7d", labelKey: "last7days" },
  { value: "30d", labelKey: "last30days" },
  { value: "90d", labelKey: "last90days" },
  { value: "custom", labelKey: "customRange" },
  { value: "all", labelKey: "allTime" },
];

const RANGE_META: Record<
  AnalyticsRange,
  {
    labelKey: keyof TranslationKeys["analytics"];
    days: number | null;
    trendDays: number;
  }
> = {
  day: { labelKey: "selectedDay", days: null, trendDays: 1 },
  "7d": { labelKey: "last7days", days: 7, trendDays: 7 },
  "30d": { labelKey: "last30days", days: 30, trendDays: 10 },
  "90d": { labelKey: "last90days", days: 90, trendDays: 12 },
  custom: { labelKey: "customRange", days: null, trendDays: 10 },
  all: { labelKey: "allTime", days: null, trendDays: 12 },
};

function getOrderCost(order: Pick<Order, "items">): number {
  return order.items.reduce(
    (sum, item) => sum + item.costPrice * item.quantity,
    0,
  );
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
  const grossProfit = netRevenue - (grossCogs - refundedCogs);

  return {
    grossSales,
    refundedRevenue,
    netRevenue,
    grossProfit,
    orderCount: list.length,
    avgOrder: list.length > 0 ? netRevenue / list.length : 0,
  };
}

function escapeCsvValue(value: string | number): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDateValue(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  date.setDate(date.getDate() + amount);
  return formatDateInputValue(date);
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  if (typeof window === "undefined") return;

  const csv = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function AnalyticsContent({
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
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [selectedDay, setSelectedDay] = useState(() =>
    formatDateInputValue(new Date()),
  );
  const [customStart, setCustomStart] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return formatDateInputValue(date);
  });
  const [customEnd, setCustomEnd] = useState(() =>
    formatDateInputValue(new Date()),
  );
  const rangeMeta = RANGE_META[range];
  const saleOrders = useMemo(
    () => orders.filter((order) => order.status !== "VOIDED"),
    [orders],
  );
  const dateRangeError = useMemo(() => {
    if (range !== "custom") return "";
    if (!customStart || !customEnd) return i.analytics.selectBothDates;

    const start = new Date(`${customStart}T00:00:00`).getTime();
    const end = new Date(`${customEnd}T23:59:59.999`).getTime();

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return i.analytics.invalidDateRange;
    }

    return start > end ? i.analytics.endAfterStart : "";
  }, [range, customStart, customEnd]);
  const filteredOrders = useMemo(() => {
    if (range === "day") {
      const start = new Date(`${selectedDay}T00:00:00`).getTime();
      const end = new Date(`${selectedDay}T23:59:59.999`).getTime();
      return saleOrders.filter(
        (order) => order.createdAt >= start && order.createdAt <= end,
      );
    }

    if (range === "custom") {
      if (dateRangeError) return [];

      const start = new Date(`${customStart}T00:00:00`).getTime();
      const end = new Date(`${customEnd}T23:59:59.999`).getTime();
      return saleOrders.filter(
        (order) => order.createdAt >= start && order.createdAt <= end,
      );
    }

    if (rangeMeta.days === null) return saleOrders;

    const start = Date.now() - rangeMeta.days * 24 * 60 * 60 * 1000;
    return saleOrders.filter((order) => order.createdAt >= start);
  }, [
    saleOrders,
    range,
    rangeMeta.days,
    selectedDay,
    customStart,
    customEnd,
    dateRangeError,
  ]);

  const performance = useMemo(
    () => buildProductPerformance(filteredOrders, products),
    [filteredOrders, products],
  );
  const inventoryInsights = useMemo(
    () => buildInventoryInsights(products, performance),
    [products, performance],
  );
  const stats = useMemo(() => {
    const activeCustomers = new Set(
      filteredOrders
        .map((order) => order.customerId || order.customerName || null)
        .filter(Boolean),
    );

    const paymentMix = Array.from(
      filteredOrders
        .reduce((map, order) => {
          const key = order.paymentMethod || "Unknown";
          const current = map.get(key) ?? { method: key, total: 0, count: 0 };
          current.total += order.total;
          current.count += 1;
          map.set(key, current);
          return map;
        }, new Map<string, { method: string; total: number; count: number }>())
        .values(),
    ).sort((a, b) => b.total - a.total);

    const trendDays = rangeMeta.trendDays;
    const dailyTrend = Array.from({ length: trendDays }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (trendDays - 1 - index));
      const start = date.getTime();
      const end = start + 24 * 60 * 60 * 1000;
      const dayOrders = filteredOrders.filter(
        (order) => order.createdAt >= start && order.createdAt < end,
      );
      const snapshot = buildSnapshot(dayOrders);

      return {
        label: formatDate(date, dateFormat, numberFormat),
        shortLabel: `${date.getDate()}/${date.getMonth() + 1}`,
        ...snapshot,
      };
    });

    const topVariants = [...products]
      .map((product) => ({
        product,
        metric: performance.get(product.id),
      }))
      .sort(
        (a, b) =>
          (b.metric?.netRevenue ?? 0) - (a.metric?.netRevenue ?? 0) ||
          (b.metric?.sold30d ?? 0) - (a.metric?.sold30d ?? 0),
      )
      .slice(0, 5);

    const uniqueProducts = new Set(
      products
        .map((product) => product.name.trim().toLowerCase())
        .filter(Boolean),
    );

    return {
      rangeLabel:
        range === "day"
          ? formatDate(selectedDay, dateFormat, numberFormat)
          : range === "custom"
            ? `${formatDate(customStart, dateFormat, numberFormat)} → ${formatDate(customEnd, dateFormat, numberFormat)}`
            : i.analytics[rangeMeta.labelKey],
      snapshot: buildSnapshot(filteredOrders),
      activeCustomers: activeCustomers.size,
      paymentMix,
      dailyTrend,
      topVariants,
      productCount: uniqueProducts.size,
      variantCount: products.length,
      fastMovingCount: Array.from(performance.values()).filter(
        (metric) => metric.movement === "fast",
      ).length,
      reorderCount: inventoryInsights.filter(
        (item) => item.action === "reorder",
      ).length,
      deadStockCount: inventoryInsights.filter((item) => item.action === "dead")
        .length,
      reorderList: inventoryInsights
        .filter((item) => item.action === "reorder")
        .slice(0, 5),
      deadStockList: inventoryInsights
        .filter((item) => item.action === "dead")
        .slice(0, 5),
      refundRate:
        filteredOrders.length > 0
          ? (filteredOrders.filter(
              (order) =>
                order.status === "REFUNDED" ||
                order.status === "PARTIALLY_REFUNDED",
            ).length /
              filteredOrders.length) *
            100
          : 0,
    };
  }, [
    filteredOrders,
    products,
    performance,
    inventoryInsights,
    numberFormat,
    dateFormat,
    rangeMeta,
    range,
    selectedDay,
    customStart,
    customEnd,
  ]);

  const rawMaxNetDay =
    Math.max(...stats.dailyTrend.map((day) => day.netRevenue), 0) || 1;

  // Round up to a nice number for gridline scale
  const niceMax = (() => {
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMaxNetDay)));
    const normalized = rawMaxNetDay / magnitude;
    const nice =
      normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return nice * magnitude;
  })();

  const gridTicks = [0, 0.25, 0.5, 0.75, 1];
  const rawMaxPayment =
    Math.max(...stats.paymentMix.map((m) => m.total), 0) || 1;
  const niceMaxPayment = (() => {
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMaxPayment)));
    const normalized = rawMaxPayment / magnitude;
    const nice =
      normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return nice * magnitude;
  })();
  const todayValue = formatDateInputValue(new Date());
  const canGoNextDay = selectedDay < todayValue;

  function handleExport() {
    const rows: Array<Array<string | number>> = [
      [i.analytics.exportTitle],
      [i.analytics.exportRange, stats.rangeLabel],
      [i.analytics.netRevenue, stats.snapshot.netRevenue],
      [i.analytics.grossProfit, stats.snapshot.grossProfit],
      [i.analytics.grossSales, stats.snapshot.grossSales],
      [i.analytics.refundedRevenue, stats.snapshot.refundedRevenue],
      [i.analytics.exportOrders, stats.snapshot.orderCount],
      [i.analytics.exportAvgOrder, stats.snapshot.avgOrder],
      [i.analytics.activeCustomers, stats.activeCustomers],
      [i.analytics.reorderAlerts, stats.reorderCount],
      [i.analytics.deadStockCount, stats.deadStockCount],
      [],
      [
        i.analytics.exportPaymentMethod,
        i.analytics.exportOrders,
        i.analytics.exportTotal,
      ],
      ...stats.paymentMix.map((method) => [
        translatePaymentMethod(method.method, language as Locale),
        method.count,
        method.total,
      ]),
      [],
      [
        i.analytics.topVariants,
        i.analytics.exportUnitsSold,
        i.analytics.netRevenue,
      ],
      ...stats.topVariants.map(({ product, metric }) => [
        getProductDisplayName(product.name, product.variantName),
        metric?.sold30d ?? 0,
        metric?.netRevenue ?? 0,
      ]),
    ];

    downloadCsv(
      `analytics-${range}-${new Date().toISOString().slice(0, 10)}.csv`,
      rows,
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title={i.analytics.title} subtitle={i.analytics.subtitle}>
        <div className="flex flex-col gap-3 lg:min-w-105">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Select
              id="analytics-range"
              label={i.analytics.period}
              className="sm:min-w-44"
              value={range}
              onChange={(event) =>
                setRange(event.target.value as AnalyticsRange)
              }
              options={RANGE_OPTIONS_KEYS.map((opt) => ({
                value: opt.value,
                label: i.analytics[opt.labelKey],
              }))}
            />
            <Button variant="secondary" onClick={handleExport}>
              {i.analytics.exportCsv}
            </Button>
          </div>

          {range === "day" && (
            <div className="space-y-3">
              <Input
                id="analytics-selected-day"
                label={i.analytics.pickADay}
                type="date"
                value={selectedDay}
                onChange={(event) => setSelectedDay(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() =>
                    setSelectedDay((current) => shiftDateValue(current, -1))
                  }
                >
                  {i.analytics.previousDay}
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setSelectedDay(todayValue)}
                >
                  {i.common.today}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  disabled={!canGoNextDay}
                  onClick={() =>
                    setSelectedDay((current) => shiftDateValue(current, 1))
                  }
                >
                  {i.analytics.nextDay}
                </Button>
              </div>
            </div>
          )}

          {range === "custom" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                id="analytics-start-date"
                label={i.analytics.startDate}
                type="date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                error={dateRangeError || undefined}
              />
              <Input
                id="analytics-end-date"
                label={i.analytics.endDate}
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                error={dateRangeError || undefined}
              />
            </div>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title={i.analytics.netRevenue}
          value={formatCurrency(
            stats.snapshot.netRevenue,
            currency,
            numberFormat,
            currencyFormat,
            language,
          )}
          subtitle={`${stats.rangeLabel} · ${formatCurrency(stats.snapshot.grossProfit, currency, numberFormat, currencyFormat, language)} ${i.analytics.profit}`}
          icon={<IconMoney size={24} />}
        />
        <StatCard
          title={i.analytics.avgOrder}
          value={formatCurrency(
            stats.snapshot.avgOrder,
            currency,
            numberFormat,
            currencyFormat,
            language,
          )}
          subtitle={`${formatNumber(stats.snapshot.orderCount, numberFormat)} ${i.analytics.orders}`}
          icon={<IconOrders size={24} />}
        />
        <StatCard
          title={i.analytics.activeCustomers}
          value={formatNumber(stats.activeCustomers, numberFormat)}
          subtitle={`${formatNumber(customers.length, numberFormat)} ${i.analytics.totalSavedCustomers}`}
          icon={<IconCustomers size={24} />}
        />
        <StatCard
          title={i.analytics.refundRate}
          value={`${formatNumber(stats.refundRate.toFixed(1), numberFormat)}%`}
          subtitle={`${formatNumber(stats.reorderCount, numberFormat)} ${i.analytics.variantsNeedReorder}`}
          icon={<IconActivity size={24} />}
        />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title={i.analytics.grossSales}
          value={formatCurrency(
            stats.snapshot.grossSales,
            currency,
            numberFormat,
            currencyFormat,
            language,
          )}
          subtitle={`${formatCurrency(stats.snapshot.refundedRevenue, currency, numberFormat, currencyFormat, language)} ${i.reports.refunded}`}
          icon={<IconMoney size={22} />}
        />
        <StatCard
          title={i.analytics.productsVariants}
          value={`${formatNumber(stats.productCount, numberFormat)} / ${formatNumber(stats.variantCount, numberFormat)}`}
          subtitle={i.analytics.catalogDepth}
          icon={<IconProducts size={22} />}
        />
        <StatCard
          title={i.analytics.fastMovers}
          value={formatNumber(stats.fastMovingCount, numberFormat)}
          subtitle={`${formatNumber(stats.deadStockCount, numberFormat)} ${i.analytics.deadStockVariants}`}
          icon={<IconInventory size={22} />}
        />
        <StatCard
          title={i.analytics.reorderAlerts}
          value={formatNumber(stats.reorderCount, numberFormat)}
          subtitle={stats.rangeLabel}
          icon={<IconInventory size={22} />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              {i.analytics.revenueTrend}
            </h2>
          </div>
          <div className="p-6">
            {/* Y-axis scale + bars area */}
            <div className="flex gap-2">
              {/* Y-axis labels */}
              <div className="flex flex-col justify-between h-48 py-0.5 shrink-0">
                {[...gridTicks].reverse().map((tick) => (
                  <span
                    key={tick}
                    className="text-[10px] text-slate-400 tabular-nums text-right leading-none"
                  >
                    {formatCurrency(
                      niceMax * tick,
                      currency,
                      numberFormat,
                      currencyFormat,
                      language,
                    )}
                  </span>
                ))}
              </div>

              {/* Chart area */}
              <div className="flex-1 min-w-0">
                {/* Gridlines + bars */}
                <div className="relative h-48 border-b border-l border-slate-200">
                  {/* Horizontal gridlines */}
                  {gridTicks.slice(1).map((tick) => (
                    <div
                      key={tick}
                      className="absolute left-0 right-0 h-px bg-slate-100"
                      style={{ bottom: `${tick * 100}%` }}
                    />
                  ))}

                  {/* Bars */}
                  <div className="absolute inset-0 flex items-end gap-1 px-1">
                    {stats.dailyTrend.map((day) => {
                      const pct =
                        day.netRevenue > 0
                          ? Math.max(2, (day.netRevenue / niceMax) * 100)
                          : 0;
                      return (
                        <div
                          key={day.label}
                          className="flex-1 min-w-0 group relative"
                          style={{ height: "100%" }}
                        >
                          <div
                            className="absolute bottom-0 left-0.5 right-0.5 rounded-t bg-indigo-500 hover:bg-indigo-600 transition-colors"
                            style={{ height: `${pct}%` }}
                          />
                          {/* Tooltip on hover */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                            <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                              <p className="font-semibold">{day.label}</p>
                              <p>
                                {formatCurrency(
                                  day.netRevenue,
                                  currency,
                                  numberFormat,
                                  currencyFormat,
                                  language,
                                )}
                              </p>
                              <p className="text-slate-300">
                                {formatNumber(day.orderCount, numberFormat)}{" "}
                                {i.analytics.orders} ·{" "}
                                {formatCurrency(
                                  day.grossProfit,
                                  currency,
                                  numberFormat,
                                  currencyFormat,
                                  language,
                                )}{" "}
                                {i.analytics.profit}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* X-axis labels */}
                <div className="flex gap-1 px-1 mt-1.5">
                  {stats.dailyTrend.map((day) => (
                    <div key={day.label} className="flex-1 min-w-0 text-center">
                      <span className="text-[10px] text-slate-400 tabular-nums truncate block">
                        {day.shortLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              {i.analytics.paymentMix}
            </h2>
          </div>
          <div className="p-6">
            {stats.paymentMix.length === 0 ? (
              <p className="text-sm text-slate-400">{i.analytics.noPayments}</p>
            ) : (
              <div className="flex gap-2">
                {/* Y-axis labels */}
                <div className="flex flex-col justify-between h-48 py-0.5 shrink-0">
                  {[...gridTicks].reverse().map((tick) => (
                    <span
                      key={tick}
                      className="text-[10px] text-slate-400 tabular-nums text-right leading-none"
                    >
                      {formatCurrency(
                        niceMaxPayment * tick,
                        currency,
                        numberFormat,
                        currencyFormat,
                        language,
                      )}
                    </span>
                  ))}
                </div>

                {/* Chart area */}
                <div className="flex-1 min-w-0">
                  <div className="relative h-48 border-b border-l border-slate-200">
                    {/* Horizontal gridlines */}
                    {gridTicks.slice(1).map((tick) => (
                      <div
                        key={tick}
                        className="absolute left-0 right-0 h-px bg-slate-100"
                        style={{ bottom: `${tick * 100}%` }}
                      />
                    ))}

                    {/* Bars */}
                    <div className="absolute inset-0 flex items-end justify-center gap-4 px-4">
                      {stats.paymentMix.map((method) => {
                        const pct =
                          method.total > 0
                            ? Math.max(2, (method.total / niceMaxPayment) * 100)
                            : 0;
                        return (
                          <div
                            key={method.method}
                            className="w-12 max-w-[3rem] group relative"
                            style={{ height: "100%" }}
                          >
                            <div
                              className="absolute bottom-0 left-1 right-1 rounded-t bg-emerald-500 hover:bg-emerald-600 transition-colors"
                              style={{ height: `${pct}%` }}
                            />
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                              <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                                <p className="font-semibold">
                                  {translatePaymentMethod(
                                    method.method,
                                    language as Locale,
                                  )}
                                </p>
                                <p>
                                  {formatCurrency(
                                    method.total,
                                    currency,
                                    numberFormat,
                                    currencyFormat,
                                    language,
                                  )}
                                </p>
                                <p className="text-slate-300">
                                  {formatNumber(method.count, numberFormat)}{" "}
                                  {i.analytics.orders}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* X-axis labels */}
                  <div className="flex justify-center gap-4 px-4 mt-1.5">
                    {stats.paymentMix.map((method) => (
                      <div
                        key={method.method}
                        className="w-12 max-w-[3rem] text-center"
                      >
                        <span className="text-[10px] text-slate-400 truncate block">
                          {translatePaymentMethod(
                            method.method,
                            language as Locale,
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              {i.analytics.topVariants}
            </h2>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.topVariants.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-400">
                {i.analytics.noVariantPerf}
              </div>
            ) : (
              stats.topVariants.map(({ product, metric }) => (
                <div key={product.id} className="px-6 py-3.5">
                  <p className="font-semibold text-slate-900">
                    {getProductDisplayName(product.name, product.variantName)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatNumber(metric?.sold30d ?? 0, numberFormat)}{" "}
                    {i.analytics.sold} ·{" "}
                    {formatCurrency(
                      metric?.netRevenue ?? 0,
                      currency,
                      numberFormat,
                      currencyFormat,
                      language,
                    )}{" "}
                    {i.analytics.net}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-100 bg-amber-50/70">
            <h2 className="text-sm font-bold text-amber-900 uppercase tracking-wide">
              {i.analytics.reorderWatch}
            </h2>
          </div>
          <div className="divide-y divide-amber-50">
            {stats.reorderList.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-400">
                {i.analytics.noReorderAlerts}
              </div>
            ) : (
              stats.reorderList.map((item) => {
                const product = products.find(
                  (entry) => entry.id === item.productId,
                );
                if (!product) return null;

                return (
                  <div key={item.productId} className="px-6 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {getProductDisplayName(
                            product.name,
                            product.variantName,
                          )}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {translateInsightReason(
                            item.reasonKey,
                            language as Locale,
                            item.reasonParams,
                          )}
                        </p>
                      </div>
                      <Badge variant="warning">
                        +{formatNumber(item.recommendedQty, numberFormat)}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              {i.analytics.deadStockDetection}
            </h2>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.deadStockList.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-400">
                {i.analytics.noDeadStock}
              </div>
            ) : (
              stats.deadStockList.map((item) => {
                const product = products.find(
                  (entry) => entry.id === item.productId,
                );
                if (!product) return null;

                return (
                  <div key={item.productId} className="px-6 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {getProductDisplayName(
                            product.name,
                            product.variantName,
                          )}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {translateInsightReason(
                            item.reasonKey,
                            language as Locale,
                            item.reasonParams,
                          )}
                        </p>
                      </div>
                      <Badge variant="default">
                        {formatNumber(product.stock, numberFormat)}{" "}
                        {translateUnit(product.unit, language as Locale)}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
