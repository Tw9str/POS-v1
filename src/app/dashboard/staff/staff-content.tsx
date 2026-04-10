"use client";

import { useLocalStaff } from "@/hooks/use-local-data";
import { StaffActions } from "./staff-actions";
import { Badge } from "@/components/ui/badge";

export function StaffContent({ merchantId }: { merchantId: string }) {
  const staff = useLocalStaff(merchantId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Staff
          </h1>
          <p className="text-slate-500 mt-1">{staff.length} team members</p>
        </div>
        <StaffActions merchantId={merchantId} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3.5 text-left font-semibold">Name</th>
              <th className="px-5 py-3.5 text-left font-semibold">Role</th>
              <th className="px-5 py-3.5 text-left font-semibold">PIN</th>
              <th className="px-5 py-3.5 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {staff.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  No staff yet
                </td>
              </tr>
            ) : (
              staff.map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-5 py-4 font-semibold text-slate-800">
                    {s.name}
                  </td>
                  <td className="px-5 py-4 text-slate-500">{s.role}</td>
                  <td className="px-5 py-4 text-slate-400 font-mono text-xs">
                    {"••••"}
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={s.isActive ? "success" : "danger"}>
                      {s.isActive ? "Active" : "Inactive"}
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
