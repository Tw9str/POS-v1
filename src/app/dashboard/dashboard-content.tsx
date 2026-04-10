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
  IconWarning,
} from "@/components/icons";
import { formatCurrency } from "@/lib/utils";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";

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
    const recent = orders.slice(0, 8);

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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Dashboard
        </h1>
        <p className="text-slate-500 mt-1">Welcome back, {merchantName}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <IconWarning size={18} className="text-amber-500" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Low Stock Alerts
            </h2>
            {stats.lowStock.length > 0 && (
              <Badge variant="warning">{stats.lowStock.length}</Badge>
            )}
          </div>
          <div className="divide-y divide-slate-50">
            {stats.lowStock.length === 0 ? (
              <div className="px-6 py-10 text-center text-slate-400 text-sm">
                All stock levels are healthy
              </div>
            ) : (
              stats.lowStock.map((p) => (
                <div
                  key={p.id}
                  className="px-6 py-3.5 flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-slate-800">
                    {p.name}
                  </span>
                  <Badge variant={p.stock <= 0 ? "danger" : "warning"}>
                    {p.stock <= 0 ? "Out of stock" : `${p.stock} left`}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Recent Orders
            </h2>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.recent.length === 0 ? (
              <div className="px-6 py-10 text-center text-slate-400 text-sm">
                No orders yet
              </div>
            ) : (
              stats.recent.map((o) => (
                <div
                  key={o.localId}
                  className="px-6 py-3.5 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {o.orderNumber}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {o.staffName || "—"} · {o.items.length} items
                    </p>
                  </div>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
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
