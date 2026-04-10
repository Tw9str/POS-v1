import { prisma } from "@/lib/db";
import { StatCard } from "@/components/ui/card";
import {
  IconMerchants,
  IconMoney,
  IconActivity,
  IconSubscription,
} from "@/components/icons";
import { formatCurrency } from "@/lib/utils";

export default async function AdminDashboardPage() {
  let merchantCount = 0;
  let activeSubCount = 0;
  let recentOrderCount = 0;
  let totalRevenueAmount = 0;
  let recentMerchants: (Awaited<
    ReturnType<typeof prisma.merchant.findMany>
  >[number] & {
    subscription?: { status: string; plan: string; expiresAt: Date } | null;
    _count: { orders: number; staff: number };
  })[] = [];
  let recentActivity: (Awaited<
    ReturnType<typeof prisma.activityLog.findMany>
  >[number] & {
    merchant?: { name: string } | null;
  })[] = [];

  try {
    const [merchants, activeSubs, recentOrders, revenue] = await Promise.all([
      prisma.merchant.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.order.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { status: "COMPLETED" },
      }),
    ]);
    merchantCount = merchants;
    activeSubCount = activeSubs;
    recentOrderCount = recentOrders;
    totalRevenueAmount = revenue?._sum?.total ?? 0;
  } catch (err) {
    console.error("Admin dashboard stats error:", err);
  }

  try {
    recentMerchants = await prisma.merchant.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        subscription: { select: { status: true, plan: true, expiresAt: true } },
        _count: { select: { orders: true, staff: true } },
      },
    });
  } catch (err) {
    console.error("Admin dashboard merchants error:", err);
  }

  try {
    recentActivity = await prisma.activityLog.findMany({
      take: 15,
      orderBy: { createdAt: "desc" },
      include: { merchant: { select: { name: true } } },
    });
  } catch (err) {
    console.error("Admin dashboard activity error:", err);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Super Admin Dashboard
        </h1>
        <p className="text-gray-500 mt-1">Overview of your POS platform</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Merchants"
          value={merchantCount}
          icon={<IconMerchants size={24} />}
        />
        <StatCard
          title="Active Subscriptions"
          value={activeSubCount}
          icon={<IconSubscription size={24} />}
        />
        <StatCard
          title="Orders (24h)"
          value={recentOrderCount}
          icon={<IconActivity size={24} />}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(totalRevenueAmount)}
          icon={<IconMoney size={24} />}
        />
      </div>

      {/* Recent Merchants */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Merchants
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Name</th>
                <th className="px-6 py-3 text-left font-medium">
                  Subscription
                </th>
                <th className="px-6 py-3 text-left font-medium">Orders</th>
                <th className="px-6 py-3 text-left font-medium">Staff</th>
                <th className="px-6 py-3 text-left font-medium">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentMerchants.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    No merchants yet
                  </td>
                </tr>
              ) : (
                recentMerchants.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {m.name}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          m.subscription?.status === "ACTIVE"
                            ? "bg-green-100 text-green-700"
                            : m.subscription?.status === "TRIAL"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {m.subscription?.status || "NONE"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {m._count.orders}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {m._count.staff}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {m.subscription?.expiresAt
                        ? new Date(
                            m.subscription.expiresAt,
                          ).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Activity
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {recentActivity.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              No activity yet
            </div>
          ) : (
            recentActivity.map((log) => (
              <div
                key={log.id}
                className="px-6 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{log.action}</span> on{" "}
                    <span className="text-gray-500">{log.entity}</span>
                  </p>
                  {log.merchant && (
                    <p className="text-xs text-gray-400">{log.merchant.name}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
