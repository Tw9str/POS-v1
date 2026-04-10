"use client";

import { useLocalOrders } from "@/hooks/use-local-data";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const statusVariant = (status: string) => {
  switch (status) {
    case "COMPLETED":
    case "synced":
      return "success" as const;
    case "REFUNDED":
    case "VOIDED":
    case "failed":
      return "danger" as const;
    default:
      return "warning" as const;
  }
};

const displayStatus = (order: { status?: string; syncStatus: string }) => {
  if (order.syncStatus === "pending") return "PENDING SYNC";
  if (order.syncStatus === "failed") return "SYNC FAILED";
  return order.status ?? "COMPLETED";
};

export function OrdersContent({
  merchantId,
  currency,
}: {
  merchantId: string;
  currency: string;
}) {
  const orders = useLocalOrders(merchantId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-500 mt-1">{orders.length} orders</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 text-left font-medium">Order #</th>
              <th className="px-6 py-3 text-left font-medium">Cashier</th>
              <th className="px-6 py-3 text-left font-medium">Customer</th>
              <th className="px-6 py-3 text-left font-medium">Items</th>
              <th className="px-6 py-3 text-left font-medium">Total</th>
              <th className="px-6 py-3 text-left font-medium">Payment</th>
              <th className="px-6 py-3 text-left font-medium">Status</th>
              <th className="px-6 py-3 text-left font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-12 text-center text-gray-400"
                >
                  No orders yet
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const status = displayStatus(o);
                return (
                  <tr key={o.localId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {o.orderNumber}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {o.staffName || "—"}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {o.customerName || "Walk-in"}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {o.items.length}
                    </td>
                    <td className="px-6 py-4 font-semibold">
                      {formatCurrency(o.total, currency)}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {o.paymentMethod}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={statusVariant(status)}>{status}</Badge>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatDateTime(new Date(o.createdAt))}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
