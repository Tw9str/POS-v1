"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useTransition,
  useCallback,
  useActionState,
  useState,
  useEffect,
  cloneElement,
  isValidElement,
} from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { StatusToggle } from "@/components/ui/StatusToggle";
import {
  IconSearch,
  IconFilter,
  IconX,
  IconCopy,
  IconCheck,
  IconKey,
} from "@/components/Icons";
import {
  CURRENCIES,
  PLANS,
  SUBSCRIPTION_STATUSES,
  formatPlan,
  formatStatus,
  statusVariant,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import {
  createMerchant,
  toggleMerchant,
  manageMerchantPlan,
  updateMerchant,
} from "@/app/actions/admin";

// ─── Search + Filter bar ───
export function MerchantFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const plan = searchParams.get("plan") || "";
  const [showFilters, setShowFilters] = useState(!!status || !!plan);

  const update = useCallback(
    (updates: Record<string, string>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
      if (!("page" in updates)) p.delete("page");
      startTransition(() => router.push(`?${p.toString()}`));
    },
    [router, searchParams],
  );

  const hasFilters = status || plan;

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-60 max-w-md">
          <IconSearch
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search name, slug, code, phone..."
            defaultValue={search}
            onChange={(e) => update({ search: e.target.value })}
            className="w-full pl-9 pr-4 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 rounded-xl transition-colors cursor-pointer ${
            hasFilters
              ? "border-indigo-500 text-indigo-600 bg-indigo-50"
              : "border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          <IconFilter size={16} />
          Filters
          {hasFilters && (
            <span className="w-5 h-5 bg-indigo-600 text-white rounded-full text-xs flex items-center justify-center">
              {[status, plan].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="flex items-center gap-3 flex-wrap p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => update({ status: e.target.value })}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
            >
              <option value="">All</option>
              {SUBSCRIPTION_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">
              Plan
            </label>
            <select
              value={plan}
              onChange={(e) => update({ plan: e.target.value })}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
            >
              <option value="">All</option>
              {PLANS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => update({ status: "", plan: "" })}
              className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 mt-4 cursor-pointer"
            >
              <IconX size={14} /> Clear
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ─── Pagination ───
export function MerchantPagination({
  page,
  pages,
  total,
  limit,
}: {
  page: number;
  pages: number;
  total: number;
  limit: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    startTransition(() => router.push(`?${params.toString()}`));
  };

  if (pages <= 1) return null;

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-500">
        Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of{" "}
        {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1 || isPending}
          onClick={() => goToPage(page - 1)}
        >
          Previous
        </Button>
        {Array.from({ length: Math.min(7, pages) }, (_, i) => {
          let pageNum: number;
          if (pages <= 7) pageNum = i + 1;
          else if (page <= 4) pageNum = i + 1;
          else if (page >= pages - 3) pageNum = pages - 6 + i;
          else pageNum = page - 3 + i;
          return (
            <button
              key={pageNum}
              onClick={() => goToPage(pageNum)}
              disabled={isPending}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                pageNum === page
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {pageNum}
            </button>
          );
        })}
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pages || isPending}
          onClick={() => goToPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

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
          title="Copy to clipboard"
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

// ─── Create Merchant Button + Modal ───
export function CreateMerchantButton() {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(createMerchant, {});

  // After creation: show access code
  const created = state.success && state.data;
  const result = created as
    | { id: string; name: string; accessCode: string }
    | undefined;

  // Plan setup after creation
  const [planTarget, setPlanTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  function close() {
    setOpen(false);
    setPlanTarget(null);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ New Merchant</Button>

      {/* Create form */}
      <Modal
        open={open && !result}
        onClose={close}
        title="Create New Merchant"
        size="md"
      >
        {state.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {state.error}
          </div>
        )}
        <form action={action} className="space-y-4">
          <Input
            label="Store Name *"
            name="name"
            placeholder="My Store"
            required
            minLength={2}
          />
          <Input label="Phone" name="phone" placeholder="+963..." />
          <Input label="Address" name="address" placeholder="Damascus, Syria" />
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Currency
            </label>
            <select
              name="currency"
              defaultValue="USD"
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.value}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={close}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Success modal */}
      <Modal
        open={!!result && !planTarget}
        onClose={close}
        title="Merchant Created!"
        size="sm"
      >
        {result && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-gray-500">
              Share this access code with <strong>{result.name}</strong>
            </p>
            <CopyableCode code={result.accessCode} />
            <p className="text-xs text-gray-400">
              The merchant uses this code to log in at /store
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={close} className="flex-1">
                Skip
              </Button>
              <Button
                onClick={() =>
                  setPlanTarget({ id: result.id, name: result.name })
                }
                className="flex-1"
              >
                <IconKey size={14} /> Set Up Plan
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Plan setup */}
      {planTarget && (
        <ManagePlanForm
          open
          onClose={() => {
            setPlanTarget(null);
            close();
          }}
          merchantId={planTarget.id}
          merchantName={planTarget.name}
        />
      )}
    </>
  );
}

// ─── Edit Merchant Modal ───
export function EditMerchantButton({
  merchant,
  children,
}: {
  merchant: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    currency: string;
  };
  children: React.ReactElement<{ onClick?: () => void }>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {isValidElement(children)
        ? cloneElement(children, { onClick: () => setOpen(true) })
        : children}
      {open && (
        <EditMerchantModal merchant={merchant} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function EditMerchantModal({
  merchant,
  onClose,
}: {
  merchant: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    currency: string;
  };
  onClose: () => void;
}) {
  const [state, action, isPending] = useActionState(updateMerchant, {});

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <Modal open onClose={onClose} title={`Edit — ${merchant.name}`} size="md">
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
          minLength={2}
        />
        <Input
          label="Phone"
          name="phone"
          defaultValue={merchant.phone || ""}
          placeholder="+963..."
        />
        <Input
          label="Address"
          name="address"
          defaultValue={merchant.address || ""}
          placeholder="Damascus, Syria"
        />
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
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
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
  );
}

// ─── Toggle Active / Suspended ───
export function MerchantToggle({
  merchantId,
  effectiveStatus,
}: {
  merchantId: string;
  effectiveStatus: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <StatusToggle
      isActive={effectiveStatus !== "SUSPENDED"}
      activeLabel={formatStatus(effectiveStatus)}
      inactiveLabel="Suspended"
      badgeVariant={statusVariant(effectiveStatus)}
      onToggle={() =>
        startTransition(async () => {
          await toggleMerchant(merchantId);
        })
      }
      title={
        effectiveStatus === "SUSPENDED"
          ? "Click to activate"
          : "Click to suspend"
      }
    />
  );
}

// ─── Manage Plan Button + Modal ───
export function ManagePlanButton({
  merchantId,
  merchantName,
  currentPlan,
  currentStatus,
  currentExpiresAt,
  currentPaidAmount,
  gracePeriodDays,
  children,
}: {
  merchantId: string;
  merchantName: string;
  currentPlan?: string;
  currentStatus?: string;
  currentExpiresAt?: string;
  currentPaidAmount?: number | null;
  gracePeriodDays?: number;
  children: React.ReactElement<{ onClick?: () => void }>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {isValidElement(children)
        ? cloneElement(children, { onClick: () => setOpen(true) })
        : children}
      {open && (
        <ManagePlanForm
          open
          onClose={() => setOpen(false)}
          merchantId={merchantId}
          merchantName={merchantName}
          currentPlan={currentPlan}
          currentStatus={currentStatus}
          currentExpiresAt={currentExpiresAt}
          currentPaidAmount={currentPaidAmount}
          gracePeriodDays={gracePeriodDays}
        />
      )}
    </>
  );
}

// ─── Manage Plan Form (useActionState) ───
function ManagePlanForm({
  open,
  onClose,
  merchantId,
  merchantName,
  currentPlan,
  currentStatus,
  currentExpiresAt,
  currentPaidAmount,
  gracePeriodDays = 7,
}: {
  open: boolean;
  onClose: () => void;
  merchantId: string;
  merchantName: string;
  currentPlan?: string;
  currentStatus?: string;
  currentExpiresAt?: string;
  currentPaidAmount?: number | null;
  gracePeriodDays?: number;
}) {
  const [state, action, isPending] = useActionState(manageMerchantPlan, {});
  const [durationType, setDurationType] = useState<"days" | "date">("days");
  const [expiresDate, setExpiresDate] = useState(
    currentExpiresAt?.slice(0, 10) || "",
  );

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Manage Plan — ${merchantName}`}
      size="md"
    >
      {currentPlan && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl text-sm">
          <span className="text-gray-500">Current:</span>
          <span className="font-medium">{formatPlan(currentPlan)}</span>
          {currentStatus && (
            <span className="text-gray-400">
              ({formatStatus(currentStatus)})
            </span>
          )}
          {currentExpiresAt && (
            <span className="text-gray-500 text-xs">
              expires {formatDateTime(currentExpiresAt)}
            </span>
          )}
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
              defaultValue={currentPlan || "STANDARD"}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
              defaultValue={currentStatus || "ACTIVE"}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              {SUBSCRIPTION_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Duration */}
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
              placeholder="30"
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

        {/* Quick extend buttons */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Quick extend:</span>
          {[7, 14, 30, 60, 90, 365].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                const base = currentExpiresAt
                  ? new Date(
                      Math.max(
                        new Date(currentExpiresAt).getTime(),
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
              currentPaidAmount != null ? String(currentPaidAmount) : ""
            }
            min="0"
            step="0.01"
          />
          <Input
            label="Payment Ref"
            name="paymentRef"
            placeholder="Receipt #, transfer ID..."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Notes
          </label>
          <textarea
            name="notes"
            rows={2}
            className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            placeholder="Internal notes..."
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          Grace period: {gracePeriodDays} days (global setting)
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
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
  );
}
