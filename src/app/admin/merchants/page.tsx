import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { CreateMerchantButton } from "./create-merchant-button";

export default async function MerchantsPage() {
  let merchants: (Awaited<
    ReturnType<typeof prisma.merchant.findMany>
  >[number] & {
    subscription?: { status: string; plan: string; expiresAt: Date } | null;
    _count: { orders: number; staff: number; products: number };
  })[] = [];

  try {
    merchants = await prisma.merchant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        subscription: { select: { status: true, plan: true, expiresAt: true } },
        _count: { select: { orders: true, staff: true, products: true } },
      },
    });
  } catch (err) {
    console.error("Merchants page error:", err);
  }

  const statusVariant = (status: string | undefined) => {
    switch (status) {
      case "ACTIVE":
        return "success" as const;
      case "TRIAL":
        return "info" as const;
      case "PAST_DUE":
        return "warning" as const;
      case "EXPIRED":
      case "SUSPENDED":
        return "danger" as const;
      default:
        return "default" as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Merchants</h1>
          <p className="text-gray-500 mt-1">
            {merchants.length} total merchants
          </p>
        </div>
        <CreateMerchantButton />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 text-left font-medium">Merchant</th>
              <th className="px-6 py-3 text-left font-medium">Access Code</th>
              <th className="px-6 py-3 text-left font-medium">Plan</th>
              <th className="px-6 py-3 text-left font-medium">Status</th>
              <th className="px-6 py-3 text-left font-medium">Products</th>
              <th className="px-6 py-3 text-left font-medium">Orders</th>
              <th className="px-6 py-3 text-left font-medium">Staff</th>
              <th className="px-6 py-3 text-left font-medium">Expires</th>
              <th className="px-6 py-3 text-left font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {merchants.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-6 py-12 text-center text-gray-400"
                >
                  No merchants registered yet
                </td>
              </tr>
            ) : (
              merchants.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/merchants/${m.id}`}
                      className="font-medium text-blue-600 hover:text-blue-700"
                    >
                      {m.name}
                    </Link>
                    <p className="text-xs text-gray-400">{m.slug}</p>
                  </td>
                  <td className="px-6 py-4">
                    <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                      {m.accessCode}
                    </code>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="info">
                      {m.subscription?.plan || "NONE"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={statusVariant(m.subscription?.status)}>
                      {m.subscription?.status || "NONE"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {m._count.products}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{m._count.orders}</td>
                  <td className="px-6 py-4 text-gray-500">{m._count.staff}</td>
                  <td className="px-6 py-4 text-gray-500">
                    {m.subscription?.expiresAt
                      ? formatDate(m.subscription.expiresAt)
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatDate(m.createdAt)}
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
