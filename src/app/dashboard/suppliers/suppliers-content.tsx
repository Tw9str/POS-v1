"use client";

import { useLocalSuppliers } from "@/hooks/use-local-data";
import { SupplierActions } from "./supplier-actions";

export function SuppliersContent({ merchantId }: { merchantId: string }) {
  const suppliers = useLocalSuppliers(merchantId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-gray-500 mt-1">{suppliers.length} suppliers</p>
        </div>
        <SupplierActions merchantId={merchantId} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 text-left font-medium">Name</th>
              <th className="px-6 py-3 text-left font-medium">Phone</th>
              <th className="px-6 py-3 text-left font-medium">Email</th>
              <th className="px-6 py-3 text-left font-medium">Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {suppliers.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-12 text-center text-gray-400"
                >
                  No suppliers yet
                </td>
              </tr>
            ) : (
              suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {s.name}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{s.phone || "—"}</td>
                  <td className="px-6 py-4 text-gray-500">{s.email || "—"}</td>
                  <td className="px-6 py-4 text-gray-500">
                    {s.address || "—"}
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
