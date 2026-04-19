"use client";

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  IconCopy,
  IconRefresh,
  IconChevronLeft,
  IconWarning,
  IconCheck,
  IconKey,
  IconEdit,
} from "@/components/Icons";

interface MerchantDetail {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  currency: string;
  taxRate: number;
  language: string;
  timezone: string;
  isActive: boolean;
  onboardingDone: boolean;
  createdAt: string;
  updatedAt: string;
  subscription: {
    id: string;
    plan: string;
    status: string;
    startsAt: string;
    expiresAt: string;
    graceEndsAt: string | null;
    paidAmount: number | null;
    paidAt: string | null;
    paymentRef: string | null;
    notes: string | null;
  } | null;
  licenseKeys: {
    id: string;
    token: string;
    expiresAt: string;
    isRevoked: boolean;
    activatedAt: string | null;
    createdAt: string;
  }[];
  staff: {
    id: string;
    name: string;
    role: string;
    isActive: boolean;
    createdAt: string;
  }[];
  _count: {
    orders: number;
    staff: number;
    products: number;
    customers: number;
    suppliers: number;
    categories: number;
    licenseKeys: number;
    payments: number;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
  staff?: { name: string } | null;
  customer?: { name: string } | null;
}

interface ActivityItem {
  id: string;
  action: string;
  entity: string;
  details?: string | null;
  createdAt: string;
}

const statusVariant = (s: string | undefined) => {
  switch (s) {
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

const fmtDate = (d: string) => new Date(d).toLocaleDateString();
const fmtDateTime = (d: string) => new Date(d).toLocaleString();
const fmtCurrency = (n: number, c = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: c,
    maximumFractionDigits: 0,
  }).format(n);

export default function MerchantDetailClient() {
  const params = useParams();
  const router = useRouter();
  const merchantId = params.id as string;

  const [merchant, setMerchant] = useState<MerchantDetail | null>(null);
  const [revenue, setRevenue] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<
    "overview" | "orders" | "staff" | "licenses" | "activity"
  >("overview");

  // Modals
  const [editOpen, setEditOpen] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [suspendConfirm, setSuspendConfirm] = useState(false);
  const [regenConfirm, setRegenConfirm] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);

  // Edit form
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCurrency, setEditCurrency] = useState("");
  const [editTaxRate, setEditTaxRate] = useState("");
  const [editLanguage, setEditLanguage] = useState("");

  // License form
  const [licDuration, setLicDuration] = useState("30");
  const [licPlan, setLicPlan] = useState("STANDARD");

  // Subscription form
  const [subPlan, setSubPlan] = useState("");
  const [subStatus, setSubStatus] = useState("");
  const [subExpires, setSubExpires] = useState("");
  const [subPaidAmount, setSubPaidAmount] = useState("");
  const [subPaymentRef, setSubPaymentRef] = useState("");
  const [subNotes, setSubNotes] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/merchants/${merchantId}`);
      if (!res.ok) {
        router.push("/admin/merchants");
        return;
      }
      const data = await res.json();
      setMerchant(data.merchant);
      setRevenue(data.revenue);
      setOrders(data.recentOrders);
      setActivity(data.recentActivity);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [merchantId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function initEditForm() {
    if (!merchant) return;
    setEditName(merchant.name);
    setEditPhone(merchant.phone || "");
    setEditAddress(merchant.address || "");
    setEditCurrency(merchant.currency);
    setEditTaxRate(String(merchant.taxRate));
    setEditLanguage(merchant.language);
    setEditOpen(true);
  }

  function initSubForm() {
    if (!merchant?.subscription) return;
    const s = merchant.subscription;
    setSubPlan(s.plan);
    setSubStatus(s.status);
    setSubExpires(s.expiresAt.slice(0, 10));
    setSubPaidAmount(String(s.paidAmount ?? ""));
    setSubPaymentRef(s.paymentRef || "");
    setSubNotes(s.notes || "");
    setSubOpen(true);
  }

  async function handleEdit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionLoading(true);
    try {
      await fetch(`/api/admin/merchants/${merchantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          phone: editPhone || null,
          address: editAddress || null,
          currency: editCurrency,
          taxRate: Number(editTaxRate) || 0,
          language: editLanguage,
        }),
      });
      setEditOpen(false);
      fetchData();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleGenerateLicense(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/merchants/${merchantId}/license`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationDays: Number(licDuration),
          plan: licPlan,
        }),
      });
      if (res.ok) {
        setLicenseOpen(false);
        fetchData();
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpdateSub(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionLoading(true);
    try {
      await fetch("/api/admin/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantId,
          plan: subPlan || undefined,
          status: subStatus || undefined,
          expiresAt: subExpires
            ? new Date(subExpires).toISOString()
            : undefined,
          paidAmount: subPaidAmount ? Number(subPaidAmount) : undefined,
          paymentRef: subPaymentRef || undefined,
          notes: subNotes || undefined,
        }),
      });
      setSubOpen(false);
      fetchData();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleToggle() {
    setActionLoading(true);
    try {
      await fetch(`/api/admin/merchants/${merchantId}/toggle`, {
        method: "POST",
      });
      setSuspendConfirm(false);
      fetchData();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRegenCode() {
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/admin/merchants/${merchantId}/regenerate-code`,
        { method: "POST" },
      );
      const data = await res.json();
      if (data.accessCode) setNewCode(data.accessCode);
      setRegenConfirm(false);
      fetchData();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRevokeLicense() {
    if (!revokeTarget) return;
    setActionLoading(true);
    try {
      await fetch("/api/admin/licenses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseId: revokeTarget }),
      });
      setRevokeTarget(null);
      fetchData();
    } finally {
      setActionLoading(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="text-center py-20 text-gray-400">Merchant not found</div>
    );
  }

  const sub = merchant.subscription;

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
            {!merchant.isActive && <Badge variant="danger">Disabled</Badge>}
            {sub && (
              <Badge variant={statusVariant(sub.status)}>{sub.status}</Badge>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {merchant.slug} · {merchant.currency} · Created{" "}
            {fmtDate(merchant.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={initEditForm}>
            <IconEdit size={14} /> Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLicenseOpen(true)}
          >
            <IconKey size={14} /> License
          </Button>
          <Button
            variant={merchant.isActive ? "danger" : "primary"}
            size="sm"
            onClick={() => setSuspendConfirm(true)}
          >
            {merchant.isActive ? "Suspend" : "Activate"}
          </Button>
        </div>
      </div>

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
        <button
          onClick={() => setRegenConfirm(true)}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white transition-colors cursor-pointer"
          title="Regenerate"
        >
          <IconRefresh size={18} />
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Products", value: merchant._count.products },
          { label: "Orders", value: merchant._count.orders },
          { label: "Staff", value: merchant._count.staff },
          { label: "Customers", value: merchant._count.customers },
          { label: "Revenue", value: fmtCurrency(revenue, merchant.currency) },
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
          {sub && (
            <Button variant="ghost" size="sm" onClick={initSubForm}>
              <IconEdit size={14} /> Edit
            </Button>
          )}
        </div>
        {sub ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div>
              <p className="text-xs text-gray-500">Plan</p>
              <p className="font-medium">{sub.plan}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <Badge variant={statusVariant(sub.status)}>{sub.status}</Badge>
            </div>
            <div>
              <p className="text-xs text-gray-500">Starts</p>
              <p className="text-sm">{fmtDate(sub.startsAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Expires</p>
              <p className="text-sm">{fmtDate(sub.expiresAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Paid</p>
              <p className="text-sm">
                {sub.paidAmount
                  ? fmtCurrency(sub.paidAmount, merchant.currency)
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
            No subscription — generate a license to create one
          </p>
        )}
      </Card>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {(
            ["overview", "orders", "staff", "licenses", "activity"] as const
          ).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium transition-colors cursor-pointer border-b-2 ${
                tab === t
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Merchant Details */}
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
                <div key={label} className="flex justify-between">
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="font-medium text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* Quick Stats */}
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
                    (l) => !l.isRevoked && new Date(l.expiresAt) > new Date(),
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
      )}

      {tab === "orders" && (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Order #</th>
                  <th className="px-5 py-3 text-left font-medium">Total</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Payment</th>
                  <th className="px-5 py-3 text-left font-medium">Staff</th>
                  <th className="px-5 py-3 text-left font-medium">Customer</th>
                  <th className="px-5 py-3 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center text-gray-400"
                    >
                      No orders
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium">{o.orderNumber}</td>
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
                        {fmtDateTime(o.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "staff" && (
        <Card padding={false}>
          <div className="divide-y divide-gray-100">
            {merchant.staff.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400">
                No staff members
              </div>
            ) : (
              merchant.staff.map((s) => (
                <div
                  key={s.id}
                  className="px-6 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {s.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {s.role} · Added {fmtDate(s.createdAt)}
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
      )}

      {tab === "licenses" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {merchant.licenseKeys.length} license keys
            </p>
            <Button size="sm" onClick={() => setLicenseOpen(true)}>
              + Generate New
            </Button>
          </div>
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">ID</th>
                    <th className="px-5 py-3 text-left font-medium">Expires</th>
                    <th className="px-5 py-3 text-left font-medium">Status</th>
                    <th className="px-5 py-3 text-left font-medium">Created</th>
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
                    merchant.licenseKeys.map((lic) => {
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
                            {fmtDate(lic.expiresAt)}
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
                            {fmtDateTime(lic.createdAt)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {!lic.isRevoked && !expired && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRevokeTarget(lic.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                Revoke
                              </Button>
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
      )}

      {tab === "activity" && (
        <Card padding={false}>
          <div className="divide-y divide-gray-100">
            {activity.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400">
                No activity
              </div>
            ) : (
              activity.map((log) => (
                <div key={log.id} className="px-6 py-3 flex items-start gap-3">
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
                    {fmtDateTime(log.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* Edit Merchant Modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Merchant"
        size="md"
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <Input
            label="Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          <Input
            label="Phone"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
          />
          <Input
            label="Address"
            value={editAddress}
            onChange={(e) => setEditAddress(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Currency
              </label>
              <select
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm"
              >
                <option value="SYP">SYP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="TRY">TRY</option>
              </select>
            </div>
            <Input
              label="Tax Rate (%)"
              type="number"
              value={editTaxRate}
              onChange={(e) => setEditTaxRate(e.target.value)}
              min="0"
              max="100"
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Language
            </label>
            <select
              value={editLanguage}
              onChange={(e) => setEditLanguage(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm"
            >
              <option value="en">English</option>
              <option value="ar">Arabic</option>
              <option value="tr">Turkish</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" loading={actionLoading} className="flex-1">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Generate License Modal */}
      <Modal
        open={licenseOpen}
        onClose={() => setLicenseOpen(false)}
        title="Generate License"
        size="sm"
      >
        <form onSubmit={handleGenerateLicense} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Plan
            </label>
            <select
              value={licPlan}
              onChange={(e) => setLicPlan(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm"
            >
              <option value="FREE_TRIAL">Free Trial</option>
              <option value="BASIC">Basic</option>
              <option value="STANDARD">Standard</option>
              <option value="PREMIUM">Premium</option>
            </select>
          </div>
          <Input
            label="Duration (days)"
            type="number"
            value={licDuration}
            onChange={(e) => setLicDuration(e.target.value)}
            min="1"
            max="365"
          />
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLicenseOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" loading={actionLoading} className="flex-1">
              Generate
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Subscription Modal */}
      <Modal
        open={subOpen}
        onClose={() => setSubOpen(false)}
        title="Edit Subscription"
        size="md"
      >
        <form onSubmit={handleUpdateSub} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Plan
              </label>
              <select
                value={subPlan}
                onChange={(e) => setSubPlan(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm"
              >
                <option value="FREE_TRIAL">Free Trial</option>
                <option value="BASIC">Basic</option>
                <option value="STANDARD">Standard</option>
                <option value="PREMIUM">Premium</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Status
              </label>
              <select
                value={subStatus}
                onChange={(e) => setSubStatus(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm"
              >
                <option value="TRIAL">Trial</option>
                <option value="ACTIVE">Active</option>
                <option value="PAST_DUE">Past Due</option>
                <option value="EXPIRED">Expired</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          </div>
          <Input
            label="Expires"
            type="date"
            value={subExpires}
            onChange={(e) => setSubExpires(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Paid Amount"
              type="number"
              value={subPaidAmount}
              onChange={(e) => setSubPaidAmount(e.target.value)}
              min="0"
              step="0.01"
            />
            <Input
              label="Payment Ref"
              value={subPaymentRef}
              onChange={(e) => setSubPaymentRef(e.target.value)}
              placeholder="e.g. receipt #"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Notes
            </label>
            <textarea
              value={subNotes}
              onChange={(e) => setSubNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSubOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" loading={actionLoading} className="flex-1">
              Update Subscription
            </Button>
          </div>
        </form>
      </Modal>

      {/* Suspend/Activate Confirm */}
      <ConfirmModal
        open={suspendConfirm}
        onClose={() => setSuspendConfirm(false)}
        onConfirm={handleToggle}
        title={merchant.isActive ? "Suspend Merchant" : "Activate Merchant"}
        message={
          merchant.isActive
            ? `This will immediately block "${merchant.name}" from accessing the dashboard. Their staff and POS will stop working.`
            : `This will re-enable "${merchant.name}". They will regain access with their existing license.`
        }
        confirmLabel={merchant.isActive ? "Suspend" : "Activate"}
        variant={merchant.isActive ? "danger" : "primary"}
        loading={actionLoading}
      />

      {/* Regenerate Code Confirm */}
      <ConfirmModal
        open={regenConfirm}
        onClose={() => setRegenConfirm(false)}
        onConfirm={handleRegenCode}
        title="Regenerate Access Code"
        message={`This will replace the current access code for "${merchant.name}". The old code will stop working immediately. You'll need to share the new code with the merchant.`}
        confirmLabel="Regenerate"
        variant="danger"
        loading={actionLoading}
      />

      {/* Revoke License Confirm */}
      <ConfirmModal
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevokeLicense}
        title="Revoke License Key"
        message="This will permanently revoke this license key. The merchant may lose access if this is their only active license."
        confirmLabel="Revoke"
        variant="danger"
        loading={actionLoading}
      />

      {/* New Code Alert */}
      <Modal
        open={!!newCode}
        onClose={() => setNewCode(null)}
        title="New Access Code"
        size="sm"
      >
        <div className="text-center space-y-4">
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
              New Access Code
            </p>
            <p className="text-3xl font-mono font-bold text-indigo-600 tracking-widest">
              {newCode}
            </p>
          </div>
          <p className="text-xs text-gray-400">
            The old access code no longer works. Share this new code with the
            merchant.
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                if (newCode) copyToClipboard(newCode);
              }}
              className="flex-1"
            >
              <IconCopy size={14} /> Copy
            </Button>
            <Button onClick={() => setNewCode(null)} className="flex-1">
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
