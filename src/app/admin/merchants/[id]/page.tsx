import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate, formatCurrency } from "@/lib/utils";
import { MerchantActions } from "./actions";

export default async function MerchantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let merchant;
  let recentOrders: {
    id: string;
    orderNumber: string;
    total: number;
    status: string;
    paymentMethod: string;
    createdAt: Date;
  }[] = [];
  let totalRevenueAmount = 0;

  try {
    merchant = await prisma.merchant.findUnique({
      where: { id },
      include: {
        subscription: true,
        _count: {
          select: {
            orders: true,
            staff: true,
            products: true,
            customers: true,
          },
        },
        staff: {
          select: { id: true, name: true, role: true, isActive: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  } catch (err) {
    console.error("Merchant detail error:", err);
  }

  if (!merchant) notFound();

  try {
    recentOrders = await prisma.order.findMany({
      where: { merchantId: id },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        status: true,
        paymentMethod: true,
        createdAt: true,
      },
    });
  } catch (err) {
    console.error("Merchant detail orders error:", err);
  }

  try {
    const totalRevenue = await prisma.order.aggregate({
      where: { merchantId: id, status: "COMPLETED" },
      _sum: { total: true },
    });
    totalRevenueAmount = totalRevenue?._sum?.total ?? 0;
  } catch (err) {
    console.error("Merchant detail revenue error:", err);
  }

  const statusVariant = (status: string | undefined) => {
    switch (status) {
      case "ACTIVE":
        return "success" as const;
      case "TRIAL":
        return "info" as const;
      case "PAST_DUE":
        return "warning" as const;
      default:
        return "danger" as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{merchant.name}</h1>
          <p className="text-gray-500 mt-1">
            Access Code:{" "}
            <code className="px-2 py-0.5 bg-gray-100 rounded font-mono">
              {merchant.accessCode}
            </code>
          </p>
        </div>
        <MerchantActions
          merchantId={merchant.id}
          isActive={merchant.isActive}
        />
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Products</p>
          <p className="text-2xl font-bold">{merchant._count.products}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Orders</p>
          <p className="text-2xl font-bold">{merchant._count.orders}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Staff</p>
          <p className="text-2xl font-bold">{merchant._count.staff}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Revenue</p>
          <p className="text-2xl font-bold">
            {formatCurrency(totalRevenueAmount, merchant?.currency)}
          </p>
        </Card>
      </div>

      {/* Subscription info */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Subscription
        </h2>
        {merchant.subscription ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Plan</p>
              <p className="font-medium">{merchant.subscription.plan}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <Badge variant={statusVariant(merchant.subscription.status)}>
                {merchant.subscription.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500">Starts</p>
              <p className="font-medium">
                {formatDate(merchant.subscription.startsAt)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Expires</p>
              <p className="font-medium">
                {formatDate(merchant.subscription.expiresAt)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-gray-400">No subscription</p>
        )}
      </Card>

      {/* Staff */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Staff</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {merchant.staff.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400">
              No staff members
            </div>
          ) : (
            merchant.staff.map((s) => (
              <div
                key={s.id}
                className="px-6 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.role}</p>
                </div>
                <Badge variant={s.isActive ? "success" : "danger"}>
                  {s.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Recent orders */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Order #</th>
                <th className="px-6 py-3 text-left font-medium">Total</th>
                <th className="px-6 py-3 text-left font-medium">Status</th>
                <th className="px-6 py-3 text-left font-medium">Payment</th>
                <th className="px-6 py-3 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-gray-400"
                  >
                    No orders yet
                  </td>
                </tr>
              ) : (
                recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium">{o.orderNumber}</td>
                    <td className="px-6 py-3">
                      {formatCurrency(o.total, merchant.currency)}
                    </td>
                    <td className="px-6 py-3">
                      <Badge
                        variant={
                          o.status === "COMPLETED" ? "success" : "warning"
                        }
                      >
                        {o.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-gray-500">
                      {o.paymentMethod}
                    </td>
                    <td className="px-6 py-3 text-gray-500">
                      {formatDate(o.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
