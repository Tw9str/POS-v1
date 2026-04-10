"use client";

import { useLocalProducts, useLocalCategories } from "@/hooks/use-local-data";
import { ProductActions } from "./product-actions";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

export function ProductsContent({
  merchantId,
  currency,
}: {
  merchantId: string;
  currency: string;
}) {
  const products = useLocalProducts(merchantId);
  const categories = useLocalCategories(merchantId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Products
          </h1>
          <p className="text-slate-500 mt-1">{products.length} products</p>
        </div>
        <ProductActions
          categories={categories}
          currency={currency}
          merchantId={merchantId}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3.5 text-left font-semibold">Name</th>
              <th className="px-5 py-3.5 text-left font-semibold">Category</th>
              <th className="px-5 py-3.5 text-left font-semibold">SKU</th>
              <th className="px-5 py-3.5 text-left font-semibold">Price</th>
              <th className="px-5 py-3.5 text-left font-semibold">Cost</th>
              <th className="px-5 py-3.5 text-left font-semibold">Stock</th>
              <th className="px-5 py-3.5 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {products.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  No products yet
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-5 py-4 font-semibold text-slate-800">
                    {p.name}
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {p.categoryName || "—"}
                  </td>
                  <td className="px-5 py-4 text-slate-500 font-mono text-xs">
                    {p.sku || "—"}
                  </td>
                  <td className="px-5 py-4 font-bold text-slate-900 tabular-nums">
                    {formatCurrency(p.price, currency)}
                  </td>
                  <td className="px-5 py-4 text-slate-500 tabular-nums">
                    {formatCurrency(p.costPrice, currency)}
                  </td>
                  <td className="px-5 py-4 tabular-nums">
                    {p.trackStock ? p.stock : "∞"}
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={p.stock > 0 ? "success" : "danger"}>
                      {p.stock > 0 ? "In stock" : "Out"}
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
