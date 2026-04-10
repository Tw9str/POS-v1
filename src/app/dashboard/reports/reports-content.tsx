"use client";

import { useMemo } from "react";
import {
  useLocalProducts,
  useLocalCustomers,
  useLocalOrders,
} from "@/hooks/use-local-data";
import { StatCard } from "@/components/ui/card";
import {
  IconMoney,
  IconOrders,
  IconCustomers,
  IconProducts,
} from "@/components/icons";
import { formatCurrency, formatDate } from "@/lib/utils";

export function ReportsContent({
  merchantId,
  currency,
}: {
  merchantId: string;
  currency: string;
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
    const completed = orders.filter(
      (o) => o.status === "COMPLETED" || o.syncStatus === "synced",
    );

    const todayOrders = completed.filter((o) => o.createdAt >= now.todayStart);
    const weekOrders = completed.filter((o) => o.createdAt >= now.weekStart);
    const monthOrders = completed.filter((o) => o.createdAt >= now.monthStart);

    const todaySales = todayOrders.reduce((s, o) => s + o.total, 0);
    const weekSales = weekOrders.reduce((s, o) => s + o.total, 0);
    const monthSales = monthOrders.reduce((s, o) => s + o.total, 0);
    const allTimeSales = completed.reduce((s, o) => s + o.total, 0);

    // Daily sales (last 7 days)
    const dailyMap = new Map<string, { total: number; count: number }>();
    for (const o of weekOrders) {
      const date = new Date(o.createdAt).toISOString().split("T")[0];
      const entry = dailyMap.get(date) ?? { total: 0, count: 0 };
      entry.total += o.total;
      entry.count += 1;
      dailyMap.set(date, entry);
    }
    const dailySales = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // Top selling products (from order items)
    const productSales = new Map<
      string,
      { name: string; quantity: number; total: number }
    >();
    for (const o of completed) {
      for (const item of o.items) {
        const existing = productSales.get(item.productId) ?? {
          name: item.name,
          quantity: 0,
          total: 0,
        };
        existing.quantity += item.quantity;
        existing.total += item.price * item.quantity - item.discount;
        productSales.set(item.productId, existing);
      }
    }
    const topProducts = Array.from(productSales.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const avgOrder = completed.length > 0 ? allTimeSales / completed.length : 0;
    const avgDailyOrders =
      dailySales.length > 0
        ? Math.round(
            dailySales.reduce((a, d) => a + d.count, 0) / dailySales.length,
          )
        : 0;

    return {
      todaySales,
      todayCount: todayOrders.length,
      weekSales,
      weekCount: weekOrders.length,
      monthSales,
      monthCount: monthOrders.length,
      allTimeSales,
      totalOrders: completed.length,
      dailySales,
      topProducts,
      avgOrder,
      avgDailyOrders,
    };
  }, [orders, now]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Reports
        </h1>
        <p className="text-slate-500 mt-1">Sales overview and analytics</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today"
          value={formatCurrency(stats.todaySales, currency)}
          subtitle={`${stats.todayCount} orders`}
          icon={<IconMoney size={24} />}
        />
        <StatCard
          title="This Week"
          value={formatCurrency(stats.weekSales, currency)}
          subtitle={`${stats.weekCount} orders`}
          icon={<IconOrders size={24} />}
        />
        <StatCard
          title="This Month"
          value={formatCurrency(stats.monthSales, currency)}
          subtitle={`${stats.monthCount} orders`}
          icon={<IconCustomers size={24} />}
        />
        <StatCard
          title="All Time"
          value={formatCurrency(stats.allTimeSales, currency)}
          subtitle={`${stats.totalOrders} total orders`}
          icon={<IconProducts size={24} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Sales */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Daily Sales (Last 7 Days)
            </h2>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.dailySales.length === 0 ? (
              <div className="px-6 py-10 text-center text-slate-400 text-sm">
                No sales data yet
              </div>
            ) : (
              stats.dailySales.map((day) => (
                <div
                  key={day.date}
                  className="px-6 py-3.5 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {formatDate(day.date)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {day.count} orders
                    </p>
                  </div>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    {formatCurrency(day.total, currency)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Top Selling Products
            </h2>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.topProducts.length === 0 ? (
              <div className="px-6 py-10 text-center text-slate-400 text-sm">
                No sales data yet
              </div>
            ) : (
              stats.topProducts.map((product, i) => (
                <div
                  key={product.id}
                  className="px-6 py-3.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {product.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {product.quantity} units sold
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    {formatCurrency(product.total, currency)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-5">
          Store Overview
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-slate-500">Active Products</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {products.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Total Customers</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {customers.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Avg Order Value</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {formatCurrency(stats.avgOrder, currency)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Avg Daily Orders</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {stats.avgDailyOrders}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
