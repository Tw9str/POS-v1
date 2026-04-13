"use client";

import { useMemo, useState } from "react";
import {
  useLocalCustomers,
  useLocalOrders,
  useLocalProducts,
} from "@/hooks/use-local-data";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  IconActivity,
  IconCustomers,
  IconInventory,
  IconMoney,
  IconOrders,
  IconProducts,
} from "@/components/icons";
import type { LocalOrder } from "@/lib/offline-db";
import {
  buildInventoryInsights,
  buildProductPerformance,
  getRefundAmount,
} from "@/lib/product-performance";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  getPaymentMethodLabel,
  getProductDisplayName,
  type DateFormat,
  type NumberFormat,
} from "@/lib/utils";
import { t, type Locale, type TranslationKeys } from "@/lib/i18n";

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

function getOrderCost(order: Pick<LocalOrder, "items">): number {
  return order.items.reduce(
    (sum, item) => sum + item.costPrice * item.quantity,
    0,
  );
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
  numberFormat = "western",
  dateFormat = "long",
  language = "en",
}: {
  merchantId: string;
  currency: string;
  numberFormat?: NumberFormat;
  dateFormat?: DateFormat;
  language?: string;
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
  const products = useLocalProducts(merchantId);
  const customers = useLocalCustomers(merchantId);
  const orders = useLocalOrders(merchantId, 800);

  const rangeMeta = RANGE_META[range];
  const saleOrders = useMemo(
    () => orders.filter((order) => order.status !== "VOIDED"),
    [orders],
  );
  const dateRangeError = useMemo(() => {
    if (range !== "custom") return "";
    if (!customStart || !customEnd) return "Select both a start and end date.";

    const start = new Date(`${customStart}T00:00:00`).getTime();
    const end = new Date(`${customEnd}T23:59:59.999`).getTime();

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return "Enter a valid custom date range.";
    }

    return start > end ? "End date must be on or after the start date." : "";
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

  const maxNetDay =
    Math.max(...stats.dailyTrend.map((day) => day.netRevenue), 0) || 1;
  const totalPayment =
    stats.paymentMix.reduce((sum, method) => sum + method.total, 0) || 1;
  const todayValue = formatDateInputValue(new Date());
  const canGoNextDay = selectedDay < todayValue;

  function handleExport() {
    const rows: Array<Array<string | number>> = [
      ["Shampay Analytics Export"],
      ["Range", stats.rangeLabel],
      ["Net revenue", stats.snapshot.netRevenue],
      ["Gross profit", stats.snapshot.grossProfit],
      ["Gross sales", stats.snapshot.grossSales],
      ["Refunded revenue", stats.snapshot.refundedRevenue],
      ["Orders", stats.snapshot.orderCount],
      ["Average order", stats.snapshot.avgOrder],
      ["Active customers", stats.activeCustomers],
      ["Reorder alerts", stats.reorderCount],
      ["Dead stock", stats.deadStockCount],
      [],
      ["Payment method", "Orders", "Total"],
      ...stats.paymentMix.map((method) => [
        getPaymentMethodLabel(method.method),
        method.count,
        method.total,
      ]),
      [],
      ["Top variants", "Units sold", "Net revenue"],
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
          )}
          subtitle={`${stats.rangeLabel} · ${formatCurrency(stats.snapshot.grossProfit, currency, numberFormat)} ${i.analytics.profit}`}
          icon={<IconMoney size={24} />}
        />
        <StatCard
          title={i.analytics.avgOrder}
          value={formatCurrency(
            stats.snapshot.avgOrder,
            currency,
            numberFormat,
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
          )}
          subtitle={`${formatCurrency(stats.snapshot.refundedRevenue, currency, numberFormat)} ${i.reports.refunded}`}
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
          <div className="p-6 space-y-4">
            {stats.dailyTrend.map((day) => (
              <div key={day.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-700">
                    {day.label}
                  </span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(day.netRevenue, currency, numberFormat)}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{
                      width: `${Math.max(8, (day.netRevenue / maxNetDay) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  {formatNumber(day.orderCount, numberFormat)}{" "}
                  {i.analytics.orders} ·{" "}
                  {formatCurrency(day.grossProfit, currency, numberFormat)}{" "}
                  {i.analytics.profit}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              {i.analytics.paymentMix}
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {stats.paymentMix.length === 0 ? (
              <p className="text-sm text-slate-400">{i.analytics.noPayments}</p>
            ) : (
              stats.paymentMix.map((method) => (
                <div key={method.method} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-700">
                      {getPaymentMethodLabel(method.method)}
                    </span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(method.total, currency, numberFormat)}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{
                        width: `${Math.max(10, (method.total / totalPayment) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    {formatNumber(method.count, numberFormat)}{" "}
                    {i.analytics.orders}
                  </p>
                </div>
              ))
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
                          {item.reason}
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
                          {item.reason}
                        </p>
                      </div>
                      <Badge variant="default">
                        {formatNumber(product.stock, numberFormat)}{" "}
                        {product.unit}
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
