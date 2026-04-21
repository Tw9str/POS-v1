import {
  IconActivity,
  IconCustomers,
  IconDashboard,
  IconInventory,
  IconOrders,
  IconPOS,
  IconProducts,
  IconPromo,
  IconReports,
  IconSettings,
  IconStaff,
  IconSuppliers,
} from "@/components/Icons";
import type { TranslationKeys } from "@/lib/i18n";

type NavKey = keyof TranslationKeys["nav"];
type DashKey = keyof TranslationKeys["dashboard"];

export interface NavCard {
  href: string;
  labelKey: NavKey;
  descKey: DashKey;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}

export const NAV_CARDS: NavCard[] = [
  {
    href: "/dashboard/pos",
    labelKey: "pos",
    icon: IconPOS,
    color: "bg-indigo-500",
    descKey: "processSales",
  },
  {
    href: "/dashboard/products",
    labelKey: "products",
    icon: IconProducts,
    color: "bg-blue-500",
    descKey: "manageCatalog",
  },
  {
    href: "/dashboard/orders",
    labelKey: "orders",
    icon: IconOrders,
    color: "bg-emerald-500",
    descKey: "viewTransactions",
  },
  {
    href: "/dashboard/inventory",
    labelKey: "inventory",
    icon: IconInventory,
    color: "bg-amber-500",
    descKey: "stockLevels",
  },
  {
    href: "/dashboard/promos",
    labelKey: "promos",
    icon: IconPromo,
    color: "bg-rose-500",
    descKey: "discountCodes",
  },
  {
    href: "/dashboard/customers",
    labelKey: "customers",
    icon: IconCustomers,
    color: "bg-purple-500",
    descKey: "customerData",
  },
  {
    href: "/dashboard/suppliers",
    labelKey: "suppliers",
    icon: IconSuppliers,
    color: "bg-orange-500",
    descKey: "manageSuppliers",
  },
  {
    href: "/dashboard/staff",
    labelKey: "staff",
    icon: IconStaff,
    color: "bg-pink-500",
    descKey: "teamMembers",
  },
  {
    href: "/dashboard/reports",
    labelKey: "reports",
    icon: IconReports,
    color: "bg-cyan-500",
    descKey: "salesAnalytics",
  },
  {
    href: "/dashboard/analytics",
    labelKey: "analytics",
    icon: IconActivity,
    color: "bg-violet-500",
    descKey: "demandInsights",
  },
];

export interface NavItem {
  href: string;
  labelKey: NavKey;
  shortKey: NavKey;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    labelKey: "dashboard",
    shortKey: "home",
    icon: IconDashboard,
  },
  {
    href: "/dashboard/pos",
    labelKey: "pos",
    shortKey: "posShort",
    icon: IconPOS,
  },
  {
    href: "/dashboard/products",
    labelKey: "products",
    shortKey: "products",
    icon: IconProducts,
  },
  {
    href: "/dashboard/orders",
    labelKey: "orders",
    shortKey: "orders",
    icon: IconOrders,
  },
  {
    href: "/dashboard/inventory",
    labelKey: "inventory",
    shortKey: "inventory",
    icon: IconInventory,
  },
  {
    href: "/dashboard/promos",
    labelKey: "promos",
    shortKey: "promos",
    icon: IconPromo,
  },
  {
    href: "/dashboard/customers",
    labelKey: "customers",
    shortKey: "customers",
    icon: IconCustomers,
  },
  {
    href: "/dashboard/suppliers",
    labelKey: "suppliers",
    shortKey: "suppliers",
    icon: IconSuppliers,
  },
  {
    href: "/dashboard/staff",
    labelKey: "staff",
    shortKey: "staff",
    icon: IconStaff,
  },
  {
    href: "/dashboard/reports",
    labelKey: "reports",
    shortKey: "reports",
    icon: IconReports,
  },
  {
    href: "/dashboard/analytics",
    labelKey: "analytics",
    shortKey: "analytics",
    icon: IconActivity,
  },
  {
    href: "/dashboard/settings",
    labelKey: "settings",
    shortKey: "settings",
    icon: IconSettings,
  },
];

// First 4 visible items go in the mobile bottom bar, rest in "More"
export const BOTTOM_TAB_HREFS = new Set<string>([
  "/dashboard",
  "/dashboard/pos",
  "/dashboard/orders",
  "/dashboard/products",
]);
