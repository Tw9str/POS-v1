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
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="text-gray-500 mt-1">{staff.length} team members</p>
        </div>
        <StaffActions merchantId={merchantId} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 text-left font-medium">Name</th>
              <th className="px-6 py-3 text-left font-medium">Role</th>
              <th className="px-6 py-3 text-left font-medium">PIN</th>
              <th className="px-6 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staff.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-12 text-center text-gray-400"
                >
                  No staff yet
                </td>
              </tr>
            ) : (
              staff.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {s.name}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{s.role}</td>
                  <td className="px-6 py-4 text-gray-400 font-mono text-xs">
                    {"••••"}
                  </td>
                  <td className="px-6 py-4">
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
