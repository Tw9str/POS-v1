"use client";

import { useLocalOrders } from "@/hooks/use-local-data";
import { Badge } from "@/components/ui/badge";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  type DateFormat,
  type NumberFormat,
} from "@/lib/utils";

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

import { PageHeader } from "@/components/layout/page-header";

export function OrdersContent({
  merchantId,
  currency,
  numberFormat = "western",
  dateFormat = "long",
}: {
  merchantId: string;
  currency: string;
  numberFormat?: NumberFormat;
  dateFormat?: DateFormat;
}) {
  const orders = useLocalOrders(merchantId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        subtitle={`${formatNumber(orders.length, numberFormat)} orders`}
      />

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3.5 text-left font-semibold">Order #</th>
              <th className="px-5 py-3.5 text-left font-semibold">Cashier</th>
              <th className="px-5 py-3.5 text-left font-semibold">Customer</th>
              <th className="px-5 py-3.5 text-left font-semibold">Items</th>
              <th className="px-5 py-3.5 text-left font-semibold">Total</th>
              <th className="px-5 py-3.5 text-left font-semibold">Payment</th>
              <th className="px-5 py-3.5 text-left font-semibold">Status</th>
              <th className="px-5 py-3.5 text-left font-semibold">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {orders.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  No orders yet
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const status = displayStatus(o);
                return (
                  <tr
                    key={o.localId}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-5 py-4 font-semibold text-slate-800">
                      {o.orderNumber}
                    </td>
                    <td className="px-5 py-4 text-slate-500 uppercase">
                      {o.staffName || "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-500 capitalize">
                      {o.customerName || "Walk-in"}
                    </td>
                    <td className="px-5 py-4 text-slate-500 tabular-nums">
                      {formatNumber(o.items.length, numberFormat)}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900 tabular-nums">
                      {formatCurrency(o.total, currency, numberFormat)}
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {o.paymentMethod}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={statusVariant(status)}>{status}</Badge>
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {formatDateTime(
                        new Date(o.createdAt),
                        dateFormat,
                        numberFormat,
                      )}
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
