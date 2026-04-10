"use client";

import {
  useLocalProducts,
  useLocalCustomers,
  useLocalOrders,
} from "@/hooks/use-local-data";
import { StatCard } from "@/components/ui/card";
import {
  IconProducts,
  IconOrders,
  IconCustomers,
  IconMoney,
} from "@/components/icons";
import { formatCurrency } from "@/lib/utils";
import { useMemo } from "react";

export function DashboardContent({
  merchantId,
  merchantName,
  currency,
}: {
  merchantId: string;
  merchantName: string;
  currency: string;
}) {
  const products = useLocalProducts(merchantId);
  const customers = useLocalCustomers(merchantId);
  const orders = useLocalOrders(merchantId, 200);

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const stats = useMemo(() => {
    const todayOrders = orders.filter((o) => o.createdAt >= todayStart);
    const todaySales = todayOrders.reduce((sum, o) => sum + o.total, 0);
    const lowStock = products
      .filter((p) => p.trackStock && p.stock <= 5 && p.stock >= 0)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10);
    const recent = orders.slice(0, 10);

    return {
      todaySales,
      todayOrderCount: todayOrders.length,
      productCount: products.length,
      orderCount: orders.length,
      customerCount: customers.length,
      lowStock,
      recent,
    };
  }, [products, customers, orders, todayStart]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back, {merchantName}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Sales"
          value={formatCurrency(stats.todaySales, currency)}
          subtitle={`${stats.todayOrderCount} orders today`}
          icon={<IconMoney size={24} />}
        />
        <StatCard
          title="Products"
          value={stats.productCount}
          icon={<IconProducts size={24} />}
        />
        <StatCard
          title="Total Orders"
          value={stats.orderCount}
          icon={<IconOrders size={24} />}
        />
        <StatCard
          title="Customers"
          value={stats.customerCount}
          icon={<IconCustomers size={24} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Low Stock Alerts
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.lowStock.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400">
                All stock levels OK
              </div>
            ) : (
              stats.lowStock.map((p) => (
                <div
                  key={p.id}
                  className="px-6 py-3 flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {p.name}
                  </span>
                  <span
                    className={`text-sm font-bold ${p.stock <= 0 ? "text-red-600" : "text-yellow-600"}`}
                  >
                    {p.stock} left
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent orders */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Orders
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.recent.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400">
                No orders yet
              </div>
            ) : (
              stats.recent.map((o) => (
                <div
                  key={o.localId}
                  className="px-6 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {o.orderNumber}
                    </p>
                    <p className="text-xs text-gray-400">
                      {o.staffName || "—"} · {o.items.length} items
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(o.total, currency)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
