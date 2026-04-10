"use client";

import {
  useLocalProducts,
  useLocalCustomers,
  useLocalOrders,
} from "@/hooks/use-local-data";
import {
  IconPOS,
  IconProducts,
  IconOrders,
  IconCustomers,
  IconInventory,
  IconSuppliers,
  IconStaff,
  IconReports,
  IconSettings,
  IconMoney,
  IconWarning,
  IconKey,
  IconLogout,
} from "@/components/icons";
import { formatCurrency, formatNumber, type NumberFormat } from "@/lib/utils";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useRouter } from "next/navigation";

const NAV_CARDS = [
  {
    href: "/dashboard/pos",
    label: "POS Terminal",
    icon: IconPOS,
    color: "bg-indigo-500",
    description: "Process sales",
  },
  {
    href: "/dashboard/products",
    label: "Products",
    icon: IconProducts,
    color: "bg-blue-500",
    description: "Manage catalog",
  },
  {
    href: "/dashboard/orders",
    label: "Orders",
    icon: IconOrders,
    color: "bg-emerald-500",
    description: "View transactions",
  },
  {
    href: "/dashboard/inventory",
    label: "Inventory",
    icon: IconInventory,
    color: "bg-amber-500",
    description: "Stock levels",
  },
  {
    href: "/dashboard/customers",
    label: "Customers",
    icon: IconCustomers,
    color: "bg-purple-500",
    description: "Customer data",
  },
  {
    href: "/dashboard/suppliers",
    label: "Suppliers",
    icon: IconSuppliers,
    color: "bg-orange-500",
    description: "Manage suppliers",
  },
  {
    href: "/dashboard/staff",
    label: "Staff",
    icon: IconStaff,
    color: "bg-pink-500",
    description: "Team members",
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: IconReports,
    color: "bg-cyan-500",
    description: "Sales analytics",
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: IconSettings,
    color: "bg-slate-500",
    description: "Store config",
  },
];

export function DashboardContent({
  merchantId,
  merchantName,
  currency,
  numberFormat = "western",
  staffRole,
  allowedPages,
}: {
  merchantId: string;
  merchantName: string;
  currency: string;
  numberFormat?: NumberFormat;
  staffRole: string;
  allowedPages: string[];
}) {
  const router = useRouter();
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
    const lowStockCount = products.filter(
      (p) => p.trackStock && p.stock <= 5,
    ).length;

    return {
      todaySales,
      todayOrderCount: todayOrders.length,
      productCount: products.length,
      customerCount: customers.length,
      lowStockCount,
    };
  }, [products, customers, orders, todayStart]);

  const visibleCards = NAV_CARDS.filter((card) =>
    allowedPages.some((p) => card.href === p || card.href.startsWith(p + "/")),
  );

  const handleLock = async () => {
    await fetch("/api/staff/auth", { method: "DELETE" });
    router.refresh();
  };

  const handleSignOut = async () => {
    await fetch("/api/staff/auth", { method: "DELETE" });
    await fetch("/api/merchant/logout", { method: "POST" });
    router.push("/store");
  };

  return (
    <div className="space-y-8">
      {/* Header with store info + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-linear-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-2xl font-bold text-white">
              {merchantName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 uppercase">
              {merchantName}
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {formatCurrency(stats.todaySales, currency, numberFormat)} today ·{" "}
              {formatNumber(stats.todayOrderCount, numberFormat)} orders
            </p>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-2">
          <button
            onClick={handleLock}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-amber-600 hover:bg-amber-50 active:scale-[0.98] transition-all cursor-pointer"
          >
            <IconKey size={18} />
            Switch User
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 active:scale-[0.98] transition-all cursor-pointer"
          >
            <IconLogout size={18} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <IconMoney size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Today</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">
              {formatCurrency(stats.todaySales, currency, numberFormat)}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
            <IconProducts size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Products</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">
              {formatNumber(stats.productCount, numberFormat)}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
            <IconCustomers size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Customers</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">
              {formatNumber(stats.customerCount, numberFormat)}
            </p>
          </div>
        </div>
        {stats.lowStockCount > 0 && (
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <IconWarning size={20} />
            </div>
            <div>
              <p className="text-xs text-amber-600 font-medium">Low Stock</p>
              <p className="text-lg font-bold text-amber-700 tabular-nums">
                {formatNumber(stats.lowStockCount, numberFormat)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Launcher Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {visibleCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 hover:shadow-lg hover:border-slate-300 active:scale-[0.97] transition-all group"
          >
            <div
              className={`w-14 h-14 ${card.color} rounded-2xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform`}
            >
              <card.icon size={28} className="text-white" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">{card.label}</h3>
            <p className="text-xs text-slate-400 mt-1">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
