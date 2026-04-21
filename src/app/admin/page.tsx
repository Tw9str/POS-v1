import Link from "next/link";
import { Card, StatCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RefreshButton } from "@/components/ui/RefreshButton";
import {
  IconMerchants,
  IconMoney,
  IconActivity,
  IconOrders,
  IconStaff,
  IconProducts,
  IconWarning,
  IconArrowUp,
} from "@/components/Icons";
import { getAdminStats } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

function fmt(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

const statusVariant = (s: string | undefined) => {
  switch (s) {
    case "ACTIVE":
      return "success" as const;
    case "PAST_DUE":
      return "warning" as const;
    case "SUSPENDED":
      return "danger" as const;
    default:
      return "danger" as const;
  }
};

export default async function AdminDashboardPage() {
  const data = await getAdminStats();

  if (!data) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-gray-400">Could not load dashboard data.</p>
      </div>
    );
  }

  const o = data.overview;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Super Admin Dashboard
          </h1>
          <p className="text-gray-500 mt-1">
            Platform overview &amp; monitoring
          </p>
        </div>
        <RefreshButton />
      </div>

      {/* Alert: expiring subscriptions */}
      {o.expiringIn7d > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <IconWarning size={20} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{o.expiringIn7d}</strong> subscription
            {o.expiringIn7d > 1 ? "s" : ""} expiring within 7 days.{" "}
            <Link
              href="/admin/subscriptions?expiring=true"
              className="underline font-medium"
            >
              View details →
            </Link>
          </p>
        </div>
      )}

      {/* Main Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Total Merchants"
          value={fmt(o.totalMerchants)}
          icon={<IconMerchants size={22} />}
        />
        <StatCard
          title="Active"
          value={fmt(o.activeMerchants)}
          icon={<IconArrowUp size={22} />}
        />
        <StatCard
          title="Orders (24h)"
          value={fmt(o.orders24h)}
          icon={<IconOrders size={22} />}
        />
        <StatCard
          title="Revenue (30d)"
          value={fmtCurrency(o.revenue30d)}
          icon={<IconMoney size={22} />}
        />
        <StatCard
          title="Total Staff"
          value={fmt(o.totalStaff)}
          icon={<IconStaff size={22} />}
        />
        <StatCard
          title="Total Products"
          value={fmt(o.totalProducts)}
          icon={<IconProducts size={22} />}
        />
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Total Revenue
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {fmtCurrency(o.totalRevenue)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Revenue (7d)
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {fmtCurrency(o.revenue7d)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Customers
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {fmt(o.totalCustomers)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">across all merchants</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            New Merchants (7d)
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {fmt(o.newMerchants7d)}
          </p>
        </Card>
      </div>

      {/* Subscription breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By status */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Subscriptions by Status
          </h3>
          <div className="space-y-3">
            {["ACTIVE", "PAST_DUE", "EXPIRED", "SUSPENDED"].map((s) => {
              const count = data.subscriptions.byStatus[s] || 0;
              const total = o.totalMerchants || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={s} className="flex items-center gap-3">
                  <Badge
                    variant={statusVariant(s)}
                    className="w-24 justify-center"
                  >
                    {s}
                  </Badge>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        s === "ACTIVE"
                          ? "bg-emerald-500"
                          : s === "PAST_DUE"
                            ? "bg-amber-500"
                            : s === "SUSPENDED"
                              ? "bg-slate-500"
                              : "bg-red-400"
                      }`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-12 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* By plan */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Subscriptions by Plan
          </h3>
          <div className="space-y-3">
            {["FREE_TRIAL", "BASIC", "STANDARD", "PREMIUM"].map((p) => {
              const count = data.subscriptions.byPlan[p] || 0;
              const total = o.totalMerchants || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={p} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-600 w-24">
                    {p.replace("_", " ")}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-indigo-500"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-12 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Top merchants by revenue */}
      {data.topMerchants.length > 0 && (
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">
              Top Merchants by Revenue
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {data.topMerchants.map((m, i) => (
              <Link
                key={m.id}
                href={`/admin/merchants/${m.id}`}
                className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-bold text-gray-400 w-6">
                  #{i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {m.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {fmt(m.orders)} orders
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {fmtCurrency(m.revenue)}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Merchants + Activity side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Merchants */}
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Recent Merchants
            </h3>
            <Link
              href="/admin/merchants"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data.recentMerchants.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">
                No merchants yet
              </div>
            ) : (
              data.recentMerchants.map((m) => (
                <Link
                  key={m.id}
                  href={`/admin/merchants/${m.id}`}
                  className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {m.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {m._count.products} products · {m._count.orders} orders
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={statusVariant(m.subscription?.status)}>
                      {m.subscription?.status || "NONE"}
                    </Badge>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Recent Activity
            </h3>
            <Link
              href="/admin/activity"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data.recentActivity.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">
                No activity yet
              </div>
            ) : (
              data.recentActivity.map((log) => (
                <div key={log.id} className="px-6 py-3 flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{log.action}</span>{" "}
                      <span className="text-gray-400">on</span>{" "}
                      <span className="text-gray-600">{log.entity}</span>
                    </p>
                    {log.merchant && (
                      <p className="text-xs text-gray-400">
                        {log.merchant.name}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
