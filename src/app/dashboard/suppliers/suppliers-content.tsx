"use client";

import { useLocalSuppliers } from "@/hooks/use-local-data";
import { SupplierActions } from "./supplier-actions";
import { PageHeader } from "@/components/layout/page-header";
import { formatNumber, type NumberFormat } from "@/lib/utils";

export function SuppliersContent({
  merchantId,
  numberFormat = "western",
}: {
  merchantId: string;
  numberFormat?: NumberFormat;
}) {
  const suppliers = useLocalSuppliers(merchantId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        subtitle={`${formatNumber(suppliers.length, numberFormat)} suppliers`}
      >
        <SupplierActions merchantId={merchantId} />
      </PageHeader>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3.5 text-left font-semibold">Name</th>
              <th className="px-5 py-3.5 text-left font-semibold">Phone</th>
              <th className="px-5 py-3.5 text-left font-semibold">Email</th>
              <th className="px-5 py-3.5 text-left font-semibold">Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {suppliers.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  No suppliers yet
                </td>
              </tr>
            ) : (
              suppliers.map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-5 py-4 font-semibold text-slate-800 capitalize">
                    {s.name}
                  </td>
                  <td className="px-5 py-4 text-slate-500">{s.phone || "—"}</td>
                  <td className="px-5 py-4 text-slate-500">{s.email || "—"}</td>
                  <td className="px-5 py-4 text-slate-500">
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
