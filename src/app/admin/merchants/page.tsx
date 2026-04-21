import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { IconEdit, IconKey } from "@/components/Icons";
import {
  formatPlan,
  formatStatus,
  statusVariant,
  getEffectiveStatus,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { getMerchantsList, getAdminSettings } from "@/app/actions/admin";
import {
  MerchantFilters,
  MerchantPagination,
  CreateMerchantButton,
  EditMerchantButton,
  MerchantToggle,
  ManagePlanButton,
} from "./MerchantWidgets";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Merchants" };

export default async function MerchantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, settings] = await Promise.all([
    getMerchantsList({
      search: params.search,
      status: params.status,
      plan: params.plan,
      page: params.page ? Number(params.page) : 1,
    }),
    getAdminSettings(),
  ]);

  const gracePeriodDays = settings?.gracePeriodDays ?? 7;

  if (!data) {
    return (
      <div className="text-center py-20 text-gray-400">
        Could not load merchants.
      </div>
    );
  }

  const { merchants, pagination } = data;
  type MerchantRow = (typeof merchants)[number];
  const hasFilters = params.search || params.status || params.plan;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Merchants</h1>
          <p className="text-gray-500 mt-1">
            {pagination.total} total merchants
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton />
          <CreateMerchantButton />
        </div>
      </div>

      {/* Search & Filters */}
      <MerchantFilters />

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Merchant</th>
              <th className="px-5 py-3 text-left font-medium">Plan</th>
              <th className="px-5 py-3 text-left font-medium">Status</th>
              <th className="px-5 py-3 text-center font-medium">Products</th>
              <th className="px-5 py-3 text-center font-medium">Orders</th>
              <th className="px-5 py-3 text-center font-medium">Staff</th>
              <th className="px-5 py-3 text-left font-medium">Expires</th>
              <th className="px-5 py-3 text-left font-medium">Created</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {merchants.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-5 py-16 text-center text-gray-400"
                >
                  {hasFilters
                    ? "No merchants match your filters"
                    : "No merchants yet"}
                </td>
              </tr>
            ) : (
              merchants.map((m: MerchantRow) => {
                const effectiveStatus = getEffectiveStatus(
                  m.subscription?.status,
                  m.subscription?.expiresAt,
                  gracePeriodDays,
                );
                const isExpired = effectiveStatus === "EXPIRED";
                const isExpiring =
                  !isExpired &&
                  m.subscription?.expiresAt &&
                  new Date(m.subscription.expiresAt).getTime() - Date.now() <
                    7 * 24 * 60 * 60 * 1000 &&
                  new Date(m.subscription.expiresAt).getTime() > Date.now();

                return (
                  <tr
                    key={m.id}
                    className={`hover:bg-gray-50 ${isExpired ? "bg-red-50/30" : isExpiring ? "bg-amber-50/50" : ""} ${effectiveStatus === "SUSPENDED" ? "opacity-60" : ""}`}
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/merchants/${m.id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        {m.name}
                      </Link>
                      <p className="text-xs text-gray-400">{m.slug}</p>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="info">
                        {formatPlan(m.subscription?.plan)}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <MerchantToggle
                        merchantId={m.id}
                        effectiveStatus={effectiveStatus}
                      />
                    </td>
                    <td className="px-5 py-4 text-center text-gray-500">
                      {m._count.products}
                    </td>
                    <td className="px-5 py-4 text-center text-gray-500">
                      {m._count.orders}
                    </td>
                    <td className="px-5 py-4 text-center text-gray-500">
                      {m._count.staff}
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {m.subscription?.expiresAt
                        ? formatDateTime(m.subscription.expiresAt)
                        : "·"}
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {formatDateTime(m.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <EditMerchantButton
                          merchant={{
                            id: m.id,
                            name: m.name,
                            phone: m.phone,
                            address: m.address,
                            currency: m.currency,
                          }}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Edit merchant"
                          >
                            <IconEdit size={14} />
                          </Button>
                        </EditMerchantButton>
                        <ManagePlanButton
                          merchantId={m.id}
                          merchantName={m.name}
                          currentPlan={m.subscription?.plan}
                          currentStatus={m.subscription?.status}
                          currentExpiresAt={
                            m.subscription?.expiresAt instanceof Date
                              ? m.subscription.expiresAt.toISOString()
                              : m.subscription?.expiresAt
                          }
                          currentPaidAmount={m.subscription?.paidAmount}
                          gracePeriodDays={gracePeriodDays}
                        >
                          <Button variant="ghost" size="sm" title="Manage plan">
                            <IconKey size={14} />
                          </Button>
                        </ManagePlanButton>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <MerchantPagination
        page={pagination.page}
        pages={pagination.pages}
        total={pagination.total}
        limit={pagination.limit}
      />
    </div>
  );
}
