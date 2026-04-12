import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function SubscriptionsPage() {
  let subscriptions: (Awaited<
    ReturnType<typeof prisma.subscription.findMany>
  >[number] & {
    merchant: { id: string; name: string; slug: string; isActive: boolean };
  })[] = [];

  try {
    subscriptions = await prisma.subscription.findMany({
      orderBy: { expiresAt: "asc" },
      include: {
        merchant: {
          select: { id: true, name: true, slug: true, isActive: true },
        },
      },
    });
  } catch (err) {
    console.error("Subscriptions page error:", err);
  }

  const statusVariant = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "success" as const;
      case "TRIAL":
        return "info" as const;
      case "PAST_DUE":
        return "warning" as const;
      default:
        return "danger" as const;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
        <p className="text-gray-500 mt-1">Manage merchant subscriptions</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 text-left font-medium">Merchant</th>
              <th className="px-6 py-3 text-left font-medium">Plan</th>
              <th className="px-6 py-3 text-left font-medium">Status</th>
              <th className="px-6 py-3 text-left font-medium">Started</th>
              <th className="px-6 py-3 text-left font-medium">Expires</th>
              <th className="px-6 py-3 text-left font-medium">Paid</th>
              <th className="px-6 py-3 text-left font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {subscriptions.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-gray-400"
                >
                  No subscriptions yet
                </td>
              </tr>
            ) : (
              subscriptions.map((sub) => {
                const isExpiring =
                  new Date(sub.expiresAt).getTime() - Date.now() <
                  7 * 24 * 60 * 60 * 1000;
                return (
                  <tr
                    key={sub.id}
                    className={`hover:bg-gray-50 ${isExpiring ? "bg-yellow-50" : ""}`}
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {sub.merchant.name}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="info">{sub.plan}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={statusVariant(sub.status)}>
                        {sub.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatDate(sub.startsAt)}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatDate(sub.expiresAt)}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {sub.paidAt ? formatDate(sub.paidAt) : "·"}
                    </td>
                    <td className="px-6 py-4 text-gray-500 max-w-[200px] truncate">
                      {sub.notes || "·"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
