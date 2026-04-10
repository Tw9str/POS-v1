"use client";

import { useLocalProducts } from "@/hooks/use-local-data";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";

export function InventoryContent({ merchantId }: { merchantId: string }) {
  const products = useLocalProducts(merchantId);

  const tracked = useMemo(
    () =>
      products.filter((p) => p.trackStock).sort((a, b) => a.stock - b.stock),
    [products],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <p className="text-gray-500 mt-1">Track and manage stock levels</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Stock Levels</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 text-left font-medium">Product</th>
              <th className="px-6 py-3 text-left font-medium">SKU</th>
              <th className="px-6 py-3 text-left font-medium">Stock</th>
              <th className="px-6 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tracked.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-12 text-center text-gray-400"
                >
                  No tracked products
                </td>
              </tr>
            ) : (
              tracked.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {p.name}
                  </td>
                  <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                    {p.sku || "—"}
                  </td>
                  <td className="px-6 py-4 font-semibold">{p.stock}</td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={
                        p.stock <= 0
                          ? "danger"
                          : p.stock <= 5
                            ? "warning"
                            : "success"
                      }
                    >
                      {p.stock <= 0
                        ? "Out of stock"
                        : p.stock <= 5
                          ? "Low stock"
                          : "In stock"}
                    </Badge>
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
