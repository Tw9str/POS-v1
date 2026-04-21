import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { RefreshButton } from "@/components/ui/RefreshButton";
import {
  formatPlan,
  formatStatus,
  statusVariant,
  getEffectiveStatus,
} from "@/lib/constants";
import { getSubscriptionsList, getAdminSettings } from "@/app/actions/admin";
import {
  SubFilters,
  SubPagination,
  ExpiringAlert,
  SubManagePlanButton,
} from "./SubWidgets";
import { formatDateTime } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Subscriptions" };
const fmtCurrency = (n: number, c = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: c,
    maximumFractionDigits: 0,
  }).format(n);

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, settings] = await Promise.all([
    getSubscriptionsList({
      search: params.search,
      status: params.status,
      plan: params.plan,
      expiring: params.expiring === "true",
      page: params.page ? Number(params.page) : 1,
    }),
    getAdminSettings(),
  ]);

  const gracePeriodDays = settings?.gracePeriodDays ?? 7;

  if (!data) {
    return (
      <div className="text-center py-20 text-gray-400">
        Could not load subscriptions.
      </div>
    );
  }

  const { subscriptions, pagination } = data;
  type Subscription = (typeof subscriptions)[number];
  const hasFilters =
    params.search || params.status || params.plan || params.expiring;

  // Count expiring subs on the page
  const expiringCount = subscriptions.filter(
    (s: Subscription) =>
      new Date(s.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 &&
      new Date(s.expiresAt).getTime() > Date.now(),
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
          <p className="text-gray-500 mt-1">
            {pagination.total} total subscriptions
          </p>
        </div>
        <RefreshButton />
      </div>

      {/* Expiring alert */}
      <ExpiringAlert count={expiringCount} />

      {/* Search & Filters */}
      <SubFilters />

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Merchant</th>
              <th className="px-5 py-3 text-left font-medium">Plan</th>
              <th className="px-5 py-3 text-left font-medium">Status</th>
              <th className="px-5 py-3 text-left font-medium">Started</th>
              <th className="px-5 py-3 text-left font-medium">Expires</th>
              <th className="px-5 py-3 text-left font-medium">Grace Ends</th>
              <th className="px-5 py-3 text-left font-medium">Paid</th>
              <th className="px-5 py-3 text-left font-medium">Notes</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {subscriptions.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-5 py-16 text-center text-gray-400"
                >
                  {hasFilters
                    ? "No subscriptions match your filters"
                    : "No subscriptions yet"}
                </td>
              </tr>
            ) : (
              subscriptions.map((sub: Subscription) => {
                const effectiveStatus = getEffectiveStatus(
                  sub.status,
                  sub.expiresAt,
                  gracePeriodDays,
                );
                const expTime = new Date(sub.expiresAt).getTime();
                const isExpired = effectiveStatus === "EXPIRED";
                const isExpiring =
                  !isExpired &&
                  expTime - Date.now() < 7 * 24 * 60 * 60 * 1000 &&
                  expTime > Date.now();
                const daysLeft = Math.ceil(
                  (expTime - Date.now()) / (24 * 60 * 60 * 1000),
                );

                return (
                  <tr
                    key={sub.id}
                    className={`hover:bg-gray-50 ${isExpiring ? "bg-amber-50/50" : ""} ${isExpired ? "bg-red-50/30" : ""}`}
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/merchants/${sub.merchant.id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        {sub.merchant.name}
                      </Link>
                      {!sub.merchant.isActive && (
                        <span className="ml-2 text-xs text-red-500">
                          (suspended)
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="info">{formatPlan(sub.plan)}</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={statusVariant(effectiveStatus)}>
                        {formatStatus(effectiveStatus)}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {formatDateTime(sub.startsAt)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`text-xs ${isExpired ? "text-red-600 font-medium" : isExpiring ? "text-amber-600 font-medium" : "text-gray-500"}`}
                      >
                        {formatDateTime(sub.expiresAt)}
                        {isExpiring && ` (${daysLeft}d left)`}
                        {isExpired && " (expired)"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {gracePeriodDays}d
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {sub.paidAmount ? (
                        <div>
                          <span className="font-medium text-gray-900">
                            {fmtCurrency(sub.paidAmount, sub.merchant.currency)}
                          </span>
                          {sub.paymentRef && (
                            <p className="text-gray-400 truncate max-w-24">
                              {sub.paymentRef}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs max-w-32 truncate">
                      {sub.notes || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <SubManagePlanButton
                          merchantId={sub.merchantId}
                          merchantName={sub.merchant.name}
                          sub={{
                            plan: sub.plan,
                            status: sub.status,
                            expiresAt:
                              sub.expiresAt instanceof Date
                                ? sub.expiresAt.toISOString()
                                : sub.expiresAt,
                            paidAmount: sub.paidAmount,
                            paymentRef: sub.paymentRef,
                            notes: sub.notes,
                          }}
                          gracePeriodDays={gracePeriodDays}
                        />
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
      <SubPagination
        page={pagination.page}
        pages={pagination.pages}
        total={pagination.total}
        limit={pagination.limit}
      />
    </div>
  );
}
