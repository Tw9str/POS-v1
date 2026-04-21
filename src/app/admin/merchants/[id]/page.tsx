import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { IconChevronLeft, IconWarning } from "@/components/Icons";
import { formatPlan, formatStatus, statusVariant } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { getMerchantDetail } from "@/app/actions/admin";
import {
  DetailTabs,
  EditDetailButton,
  ManagePlanDetailButton,
  RegenCodeButton,
  RevokeLicenseButton,
} from "./DetailWidgets";
import type { Metadata } from "next";

const fmtCurrency = (n: number, c = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: c,
    maximumFractionDigits: 0,
  }).format(n);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getMerchantDetail(id);
  return { title: data?.merchant.name ?? "Merchant Details" };
}

export default async function MerchantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getMerchantDetail(id);

  if (!data) notFound();

  const { merchant, revenue, recentOrders, recentActivity, gracePeriodDays } =
    data;
  const sub = merchant.subscription;
  type LicenseKey = (typeof merchant.licenseKeys)[number];
  type StaffMember = (typeof merchant.staff)[number];
  type OrderRow = (typeof recentOrders)[number];
  type ActivityLog = (typeof recentActivity)[number];

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/merchants"
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-2"
          >
            <IconChevronLeft size={16} /> Back to Merchants
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {merchant.name}
            </h1>
            {!merchant.isActive ? (
              <Badge variant="danger">Suspended</Badge>
            ) : (
              sub && (
                <Badge variant={statusVariant(sub.status)}>
                  {formatStatus(sub.status)}
                </Badge>
              )
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {merchant.slug} · {merchant.currency} · Created{" "}
            {formatDateTime(merchant.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <RefreshButton />
          <EditDetailButton
            merchant={{
              id: merchant.id,
              name: merchant.name,
              phone: merchant.phone,
              address: merchant.address,
              currency: merchant.currency,
              taxRate: merchant.taxRate,
              language: merchant.language,
            }}
          />
          <ManagePlanDetailButton
            merchantId={merchant.id}
            merchantName={merchant.name}
            subscription={
              sub
                ? {
                    plan: sub.plan,
                    status: sub.status,
                    expiresAt: sub.expiresAt,
                    paidAmount: sub.paidAmount,
                    paymentRef: sub.paymentRef,
                    notes: sub.notes,
                  }
                : null
            }
            gracePeriodDays={gracePeriodDays}
          />
        </div>
      </div>

      {/* Suspended banner */}
      {!merchant.isActive && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <IconWarning size={20} className="text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">
              This merchant is suspended
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Toggle the status from the merchants list to reactivate.
            </p>
          </div>
        </div>
      )}

      {/* Access Code Bar */}
      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Access Code
          </p>
          <p className="text-sm text-gray-400 mt-0.5">
            Not stored — only shown at creation or regeneration
          </p>
        </div>
        <RegenCodeButton
          merchantId={merchant.id}
          merchantName={merchant.name}
        />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Products", value: merchant._count.products },
          { label: "Orders", value: merchant._count.orders },
          { label: "Staff", value: merchant._count.staff },
          { label: "Customers", value: merchant._count.customers },
          {
            label: "Revenue",
            value: fmtCurrency(revenue as number, merchant.currency),
          },
          { label: "Licenses", value: merchant._count.licenseKeys },
        ].map((s) => (
          <Card key={s.label}>
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-xl font-bold text-gray-900">{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Subscription Card */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
        </div>
        {sub ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div>
              <p className="text-xs text-gray-500">Plan</p>
              <p className="font-medium">{formatPlan(sub.plan)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <Badge variant={statusVariant(sub.status)}>
                {formatStatus(sub.status)}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-gray-500">Starts</p>
              <p className="text-sm">{formatDateTime(sub.startsAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Expires</p>
              <p className="text-sm">{formatDateTime(sub.expiresAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Paid</p>
              <p className="text-sm">
                {sub.paidAmount
                  ? fmtCurrency(sub.paidAmount as number, merchant.currency)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Payment Ref</p>
              <p className="text-sm truncate">{sub.paymentRef || "—"}</p>
            </div>
            {sub.notes && (
              <div className="col-span-full">
                <p className="text-xs text-gray-500">Notes</p>
                <p className="text-sm text-gray-600">{sub.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-400">
            No subscription — use Manage Plan to set one up
          </p>
        )}
      </Card>

      {/* Tabs */}
      <DetailTabs
        overview={
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Details
              </h3>
              <dl className="space-y-2 text-sm">
                {[
                  ["Phone", merchant.phone || "—"],
                  ["Address", merchant.address || "—"],
                  ["Currency", merchant.currency],
                  ["Tax Rate", `${merchant.taxRate}%`],
                  ["Language", merchant.language],
                  ["Timezone", merchant.timezone],
                  ["Onboarded", merchant.onboardingDone ? "Yes" : "No"],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="font-medium text-gray-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Breakdown
              </h3>
              <dl className="space-y-2 text-sm">
                {[
                  ["Categories", merchant._count.categories],
                  ["Suppliers", merchant._count.suppliers],
                  ["Payments", merchant._count.payments],
                  ["Total Licenses", merchant._count.licenseKeys],
                  [
                    "Active Licenses",
                    merchant.licenseKeys.filter(
                      (l: LicenseKey) =>
                        !l.isRevoked && new Date(l.expiresAt) > new Date(),
                    ).length,
                  ],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex justify-between">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="font-medium text-gray-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>
        }
        orders={
          <Card padding={false} className="mt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Order #</th>
                    <th className="px-5 py-3 text-left font-medium">Total</th>
                    <th className="px-5 py-3 text-left font-medium">Status</th>
                    <th className="px-5 py-3 text-left font-medium">Payment</th>
                    <th className="px-5 py-3 text-left font-medium">Staff</th>
                    <th className="px-5 py-3 text-left font-medium">
                      Customer
                    </th>
                    <th className="px-5 py-3 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentOrders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-12 text-center text-gray-400"
                      >
                        No orders
                      </td>
                    </tr>
                  ) : (
                    recentOrders.map((o: OrderRow) => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium">
                          {o.orderNumber}
                        </td>
                        <td className="px-5 py-3">
                          {fmtCurrency(o.total, merchant.currency)}
                        </td>
                        <td className="px-5 py-3">
                          <Badge
                            variant={
                              o.status === "COMPLETED" ? "success" : "warning"
                            }
                          >
                            {o.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-gray-500">
                          {o.paymentMethod}
                        </td>
                        <td className="px-5 py-3 text-gray-500">
                          {o.staff?.name || "—"}
                        </td>
                        <td className="px-5 py-3 text-gray-500">
                          {o.customer?.name || "Walk-in"}
                        </td>
                        <td className="px-5 py-3 text-gray-500 text-xs">
                          {formatDateTime(o.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        }
        staff={
          <Card padding={false} className="mt-6">
            <div className="divide-y divide-gray-100">
              {merchant.staff.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-400">
                  No staff members
                </div>
              ) : (
                merchant.staff.map((s: StaffMember) => (
                  <div
                    key={s.id}
                    className="px-6 py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {s.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {s.role} · Added {formatDateTime(s.createdAt)}
                      </p>
                    </div>
                    <Badge variant={s.isActive ? "success" : "danger"}>
                      {s.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        }
        licenses={
          <div className="space-y-3 mt-6">
            <p className="text-sm text-gray-500">
              {merchant.licenseKeys.length} license keys
            </p>
            <Card padding={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">ID</th>
                      <th className="px-5 py-3 text-left font-medium">
                        Expires
                      </th>
                      <th className="px-5 py-3 text-left font-medium">
                        Status
                      </th>
                      <th className="px-5 py-3 text-left font-medium">
                        Created
                      </th>
                      <th className="px-5 py-3 text-right font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {merchant.licenseKeys.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-5 py-12 text-center text-gray-400"
                        >
                          No licenses
                        </td>
                      </tr>
                    ) : (
                      merchant.licenseKeys.map((lic: LicenseKey) => {
                        const expired = new Date(lic.expiresAt) < new Date();
                        return (
                          <tr
                            key={lic.id}
                            className={`hover:bg-gray-50 ${lic.isRevoked ? "opacity-50" : ""}`}
                          >
                            <td className="px-5 py-3 font-mono text-xs">
                              {lic.id.slice(0, 12)}...
                            </td>
                            <td className="px-5 py-3 text-xs">
                              {formatDateTime(lic.expiresAt)}
                            </td>
                            <td className="px-5 py-3">
                              {lic.isRevoked ? (
                                <Badge variant="danger">Revoked</Badge>
                              ) : expired ? (
                                <Badge variant="warning">Expired</Badge>
                              ) : (
                                <Badge variant="success">Active</Badge>
                              )}
                            </td>
                            <td className="px-5 py-3 text-xs text-gray-500">
                              {formatDateTime(lic.createdAt)}
                            </td>
                            <td className="px-5 py-3 text-right">
                              {!lic.isRevoked && !expired && (
                                <RevokeLicenseButton licenseId={lic.id} />
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        }
        activity={
          <Card padding={false} className="mt-6">
            <div className="divide-y divide-gray-100">
              {recentActivity.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-400">
                  No activity
                </div>
              ) : (
                recentActivity.map((log: ActivityLog) => (
                  <div
                    key={log.id}
                    className="px-6 py-3 flex items-start gap-3"
                  >
                    <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium text-gray-900">
                          {log.action}
                        </span>{" "}
                        <span className="text-gray-400">on</span>{" "}
                        <span className="text-gray-600">{log.entity}</span>
                      </p>
                      {log.details && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {log.details}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatDateTime(log.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        }
      />
    </div>
  );
}
