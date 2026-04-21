"use client";

import { useState, useActionState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconCopy, IconCheck, IconEdit, IconKey } from "@/components/Icons";
import {
  CURRENCIES,
  LANGUAGES,
  PLANS,
  SUBSCRIPTION_STATUSES,
  formatPlan,
  formatStatus,
  statusVariant,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import {
  updateMerchant,
  manageMerchantPlan,
  regenerateAccessCode,
  revokeLicense,
} from "@/app/actions/admin";

// ─── Copyable code widget ───
function CopyableCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 relative">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
        Access Code
      </p>
      <div className="flex items-center justify-center gap-3">
        <p className="text-3xl font-mono font-bold text-indigo-600 tracking-widest">
          {code}
        </p>
        <button
          type="button"
          onClick={handleCopy}
          className="p-2 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer text-gray-400 hover:text-gray-600"
        >
          {copied ? (
            <IconCheck size={20} className="text-green-600" />
          ) : (
            <IconCopy size={20} />
          )}
        </button>
      </div>
      {copied && (
        <p className="text-xs text-green-600 mt-2 text-center">Copied!</p>
      )}
    </div>
  );
}

// ─── Tab switcher ───
export function DetailTabs({
  overview,
  orders,
  staff,
  licenses,
  activity,
}: {
  overview: React.ReactNode;
  orders: React.ReactNode;
  staff: React.ReactNode;
  licenses: React.ReactNode;
  activity: React.ReactNode;
}) {
  const [tab, setTab] = useState<
    "overview" | "orders" | "staff" | "licenses" | "activity"
  >("overview");

  const tabs = { overview, orders, staff, licenses, activity };

  return (
    <>
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
      {tabs[tab]}
    </>
  );
}

// ─── Edit Merchant Button (detail page) ───
export function EditDetailButton({
  merchant,
}: {
  merchant: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    currency: string;
    taxRate: number;
    language: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(updateMerchant, {});

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <IconEdit size={14} /> Edit
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Edit Merchant"
        size="md"
      >
        {state.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {state.error}
          </div>
        )}
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={merchant.id} />
          <Input
            label="Name"
            name="name"
            defaultValue={merchant.name}
            required
          />
          <Input
            label="Phone"
            name="phone"
            defaultValue={merchant.phone || ""}
          />
          <Input
            label="Address"
            name="address"
            defaultValue={merchant.address || ""}
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Currency
              </label>
              <select
                name="currency"
                defaultValue={merchant.currency}
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.value}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Tax Rate (%)"
              name="taxRate"
              type="number"
              defaultValue={String(merchant.taxRate)}
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
              name="language"
              defaultValue={merchant.language}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ─── Manage Plan Button (detail page) ───
export function ManagePlanDetailButton({
  merchantId,
  merchantName,
  subscription,
  gracePeriodDays,
}: {
  merchantId: string;
  merchantName: string;
  subscription: {
    plan: string;
    status: string;
    expiresAt: string | Date;
    paidAmount: number | null;
    paymentRef: string | null;
    notes: string | null;
  } | null;
  gracePeriodDays: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(manageMerchantPlan, {});
  const [durationType, setDurationType] = useState<"days" | "date">("days");
  const [expiresDate, setExpiresDate] = useState(
    subscription?.expiresAt
      ? new Date(subscription.expiresAt).toISOString().slice(0, 10)
      : "",
  );

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <IconKey size={14} /> Manage Plan
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Manage Plan — ${merchantName}`}
        size="md"
      >
        {subscription && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl text-sm">
            <span className="text-gray-500">Current:</span>
            <Badge variant="info">{formatPlan(subscription.plan)}</Badge>
            <Badge variant={statusVariant(subscription.status)}>
              {formatStatus(subscription.status)}
            </Badge>
            <span className="text-gray-500 text-xs">
              expires {formatDateTime(subscription.expiresAt)}
            </span>
          </div>
        )}

        {state.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {state.error}
          </div>
        )}

        <form action={action} className="space-y-4">
          <input type="hidden" name="merchantId" value={merchantId} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Plan
              </label>
              <select
                name="plan"
                defaultValue={subscription?.plan || "STANDARD"}
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm"
              >
                {PLANS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Status
              </label>
              <select
                name="status"
                defaultValue={subscription?.status || "ACTIVE"}
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm"
              >
                {SUBSCRIPTION_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Duration
            </label>
            <div className="flex items-center gap-3 mb-2">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={durationType === "days"}
                  onChange={() => setDurationType("days")}
                  className="accent-indigo-600"
                />
                Days from now
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={durationType === "date"}
                  onChange={() => setDurationType("date")}
                  className="accent-indigo-600"
                />
                Specific date
              </label>
            </div>
            {durationType === "days" ? (
              <Input
                key="duration-days"
                type="number"
                name="durationDays"
                defaultValue="30"
                min="1"
                max="3650"
              />
            ) : (
              <Input
                key="duration-date"
                type="date"
                name="expiresAt"
                value={expiresDate}
                onChange={(e) => setExpiresDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            )}
          </div>

          {/* Quick extend */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Quick extend:</span>
            {[7, 14, 30, 60, 90, 365].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  const base = subscription?.expiresAt
                    ? new Date(
                        Math.max(
                          new Date(subscription.expiresAt).getTime(),
                          Date.now(),
                        ),
                      )
                    : new Date();
                  const newDate = new Date(
                    base.getTime() + d * 24 * 60 * 60 * 1000,
                  );
                  setDurationType("date");
                  setExpiresDate(newDate.toISOString().slice(0, 10));
                }}
                className="px-2 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                +{d}d
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Paid Amount"
              name="paidAmount"
              type="number"
              defaultValue={
                subscription?.paidAmount != null
                  ? String(subscription.paidAmount)
                  : ""
              }
              min="0"
              step="0.01"
            />
            <Input
              label="Payment Ref"
              name="paymentRef"
              defaultValue={subscription?.paymentRef || ""}
              placeholder="Receipt #..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Notes
            </label>
            <textarea
              name="notes"
              defaultValue={subscription?.notes || ""}
              rows={2}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm resize-none"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            Grace period: {gracePeriodDays} days (global setting)
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending ? "Applying..." : "Apply Plan"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ─── Regenerate Access Code ───
export function RegenCodeButton({
  merchantId,
  merchantName,
}: {
  merchantId: string;
  merchantName: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <button
        onClick={() => setConfirmOpen(true)}
        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white transition-colors cursor-pointer"
        title="Regenerate"
      >
        <IconEdit size={18} />
      </button>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          startTransition(async () => {
            const result = await regenerateAccessCode(merchantId);
            if (
              result.data &&
              typeof result.data === "object" &&
              "accessCode" in result.data
            ) {
              setNewCode((result.data as { accessCode: string }).accessCode);
            }
            setConfirmOpen(false);
          });
        }}
        title="Regenerate Access Code"
        message={`This will replace the current access code for "${merchantName}". The old code will stop working immediately.`}
        confirmLabel="Regenerate"
        variant="danger"
        loading={isPending}
      />

      <Modal
        open={!!newCode}
        onClose={() => setNewCode(null)}
        title="New Access Code"
        size="sm"
      >
        <div className="space-y-4">
          {newCode && <CopyableCode code={newCode} />}
          <p className="text-xs text-gray-400 text-center">
            The old access code no longer works. Share this new code with the
            merchant.
          </p>
          <Button onClick={() => setNewCode(null)} className="w-full">
            Done
          </Button>
        </div>
      </Modal>
    </>
  );
}

// ─── Revoke License Button ───
export function RevokeLicenseButton({ licenseId }: { licenseId: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        Revoke
      </Button>
      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          startTransition(async () => {
            await revokeLicense(licenseId);
            setConfirmOpen(false);
          });
        }}
        title="Revoke License Key"
        message="This will permanently revoke this license key. The merchant may lose access if this is their only active license."
        confirmLabel="Revoke"
        variant="danger"
        loading={isPending}
      />
    </>
  );
}
