"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  IconDashboard,
  IconPOS,
  IconProducts,
  IconInventory,
  IconCustomers,
  IconOrders,
  IconReports,
  IconStaff,
  IconSuppliers,
  IconSettings,
  IconLogout,
  IconMenu,
  IconX,
  IconKey,
} from "@/components/icons";
import { useRouter } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard },
  { href: "/dashboard/pos", label: "POS", icon: IconPOS },
  { href: "/dashboard/products", label: "Products", icon: IconProducts },
  { href: "/dashboard/inventory", label: "Inventory", icon: IconInventory },
  { href: "/dashboard/orders", label: "Orders", icon: IconOrders },
  { href: "/dashboard/customers", label: "Customers", icon: IconCustomers },
  { href: "/dashboard/suppliers", label: "Suppliers", icon: IconSuppliers },
  { href: "/dashboard/staff", label: "Staff", icon: IconStaff },
  { href: "/dashboard/reports", label: "Reports", icon: IconReports },
  { href: "/dashboard/settings", label: "Settings", icon: IconSettings },
];

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  CASHIER: "Cashier",
  STOCK_CLERK: "Stock Clerk",
};

interface MerchantSidebarProps {
  merchantName?: string;
  staffName?: string;
  staffRole?: string;
  allowedPages?: string[];
}

export function MerchantSidebar({
  merchantName = "My Store",
  staffName = "Staff",
  staffRole = "CASHIER",
  allowedPages = [],
}: MerchantSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const visibleItems = navItems.filter((item) =>
    allowedPages.some((p) => {
      if (p === item.href) return true;
      if (item.href.startsWith(p + "/")) return true;
      return false;
    }),
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

  const nav = (
    <>
      <div className="flex items-center gap-3 px-4 py-6">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
          <span className="text-lg font-bold text-white">
            {merchantName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-gray-900 truncate">
            {merchantName}
          </h1>
          <p className="text-xs text-gray-400 truncate">
            {staffName} · {ROLE_LABELS[staffRole] || staffRole}
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
            )}
          >
            <item.icon size={20} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-3 pb-4 space-y-1">
        <button
          onClick={handleLock}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-amber-600 hover:bg-amber-50 transition-colors w-full"
        >
          <IconKey size={20} />
          Switch User
        </button>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors w-full"
        >
          <IconLogout size={20} />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border border-gray-200"
      >
        {mobileOpen ? <IconX size={20} /> : <IconMenu size={20} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {nav}
      </aside>
    </>
  );
}
