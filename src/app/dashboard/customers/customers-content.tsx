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
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">{customers.length} customers</p>
        </div>
        <CustomerActions merchantId={merchantId} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 text-left font-medium">Name</th>
              <th className="px-6 py-3 text-left font-medium">Phone</th>
              <th className="px-6 py-3 text-left font-medium">Email</th>
              <th className="px-6 py-3 text-left font-medium">Total Spent</th>
              <th className="px-6 py-3 text-left font-medium">Visits</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-gray-400"
                >
                  No customers yet
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {c.name}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {c.phone || "—"}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {c.email || "—"}
                  </td>
                  <td className="px-6 py-4 font-semibold">
                    {formatCurrency(c.totalSpent, currency)}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{c.visitCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
