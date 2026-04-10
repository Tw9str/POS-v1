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
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Inventory
        </h1>
        <p className="text-slate-500 mt-1">Track and manage stock levels</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
            Stock Levels
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3.5 text-left font-semibold">Product</th>
              <th className="px-5 py-3.5 text-left font-semibold">SKU</th>
              <th className="px-5 py-3.5 text-left font-semibold">Stock</th>
              <th className="px-5 py-3.5 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {tracked.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  No tracked products
                </td>
              </tr>
            ) : (
              tracked.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-5 py-4 font-semibold text-slate-800">
                    {p.name}
                  </td>
                  <td className="px-5 py-4 text-slate-500 font-mono text-xs">
                    {p.sku || "—"}
                  </td>
                  <td className="px-5 py-4 font-bold tabular-nums">
                    {p.stock}
                  </td>
                  <td className="px-5 py-4">
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
