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
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 mt-1">Sales overview and analytics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Daily Sales (Last 7 Days)
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.dailySales.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400">
                No sales data yet
              </div>
            ) : (
              stats.dailySales.map((day) => (
                <div
                  key={day.date}
                  className="px-6 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(day.date)}
                    </p>
                    <p className="text-xs text-gray-400">{day.count} orders</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(day.total, currency)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Top Selling Products
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.topProducts.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400">
                No sales data yet
              </div>
            ) : (
              stats.topProducts.map((product, i) => (
                <div
                  key={product.id}
                  className="px-6 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {product.quantity} units sold
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(product.total, currency)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Store Overview
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500">Active Products</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {products.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Customers</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {customers.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Avg Order Value</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(stats.avgOrder, currency)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Avg Daily Orders</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {stats.avgDailyOrders}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
