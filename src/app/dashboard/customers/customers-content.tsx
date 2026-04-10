"use client";

import { useLocalCustomers } from "@/hooks/use-local-data";
import { CustomerActions } from "./customer-actions";
import { formatCurrency } from "@/lib/utils";

export function CustomersContent({
  merchantId,
  currency,
}: {
  merchantId: string;
  currency: string;
}) {
  const customers = useLocalCustomers(merchantId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Customers
          </h1>
          <p className="text-slate-500 mt-1">{customers.length} customers</p>
        </div>
        <CustomerActions merchantId={merchantId} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3.5 text-left font-semibold">Name</th>
              <th className="px-5 py-3.5 text-left font-semibold">Phone</th>
              <th className="px-5 py-3.5 text-left font-semibold">Email</th>
              <th className="px-5 py-3.5 text-left font-semibold">
                Total Spent
              </th>
              <th className="px-5 py-3.5 text-left font-semibold">Visits</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {customers.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  No customers yet
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-5 py-4 font-semibold text-slate-800">
                    {c.name}
                  </td>
                  <td className="px-5 py-4 text-slate-500">{c.phone || "—"}</td>
                  <td className="px-5 py-4 text-slate-500">{c.email || "—"}</td>
                  <td className="px-5 py-4 font-bold text-slate-900 tabular-nums">
                    {formatCurrency(c.totalSpent, currency)}
                  </td>
                  <td className="px-5 py-4 text-slate-500 tabular-nums">
                    {c.visitCount}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
