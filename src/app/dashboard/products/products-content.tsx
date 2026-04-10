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
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500 mt-1">{products.length} products</p>
        </div>
        <ProductActions
          categories={categories}
          currency={currency}
          merchantId={merchantId}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 text-left font-medium">Name</th>
              <th className="px-6 py-3 text-left font-medium">Category</th>
              <th className="px-6 py-3 text-left font-medium">SKU</th>
              <th className="px-6 py-3 text-left font-medium">Price</th>
              <th className="px-6 py-3 text-left font-medium">Cost</th>
              <th className="px-6 py-3 text-left font-medium">Stock</th>
              <th className="px-6 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-gray-400"
                >
                  No products yet
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {p.name}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {p.categoryName || "—"}
                  </td>
                  <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                    {p.sku || "—"}
                  </td>
                  <td className="px-6 py-4 font-semibold">
                    {formatCurrency(p.price, currency)}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatCurrency(p.costPrice, currency)}
                  </td>
                  <td className="px-6 py-4">{p.trackStock ? p.stock : "∞"}</td>
                  <td className="px-6 py-4">
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
