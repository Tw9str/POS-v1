"use client";

import { useActionState } from "react";
import { updateAdminSettings } from "@/app/actions/admin";
import { Input } from "@/components/ui/Input";

export function GracePeriodForm({ initialDays }: { initialDays: number }) {
  const [state, action, isPending] = useActionState(updateAdminSettings, {});

  return (
    <form action={action} className="max-w-sm">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Input
            label="Grace Period (days)"
            type="number"
            name="gracePeriodDays"
            defaultValue={String(initialDays)}
            min="0"
            max="90"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer mb-px"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
      </div>
      {state.error && (
        <p className="text-sm text-red-600 mt-2">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm text-green-600 mt-2">Saved successfully</p>
      )}
      <p className="text-xs text-gray-500 mt-2">
        Number of days after subscription expiry before the account is fully
        locked. During grace period, merchants see a &quot;Past Due&quot;
        warning. Applies to all merchants (0–90).
      </p>
    </form>
  );
}

export function PlanCards() {
  const PLANS = [
    {
      key: "FREE_TRIAL",
      label: "Free Trial",
      maxStaff: 2,
      maxProducts: 50,
      color: "bg-gray-100 text-gray-700",
      features: ["Limited to 2 staff", "50 products max", "Basic access"],
    },
    {
      key: "BASIC",
      label: "Basic",
      maxStaff: 2,
      maxProducts: 100,
      color: "bg-blue-100 text-blue-700",
      features: [
        "2 staff members",
        "100 products",
        "Basic reports",
        "POS access",
      ],
    },
    {
      key: "STANDARD",
      label: "Standard",
      maxStaff: 5,
      maxProducts: 10000,
      color: "bg-indigo-100 text-indigo-700",
      features: [
        "5 staff members",
        "10,000 products",
        "Full reports",
        "Customer management",
        "Supplier management",
        "Promotions",
      ],
    },
    {
      key: "PREMIUM",
      label: "Premium",
      maxStaff: 100,
      maxProducts: 100000,
      color: "bg-purple-100 text-purple-700",
      features: [
        "100 staff members",
        "100,000 products",
        "Advanced analytics",
        "Priority support",
        "Multi-device access",
        "Product insights AI",
        "Full API access",
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {PLANS.map((plan) => (
        <details
          key={plan.key}
          className="group rounded-xl border border-gray-200 bg-white shadow-sm"
        >
          <summary className="cursor-pointer p-5 list-none">
            <div className="flex items-center justify-between mb-3">
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${plan.color}`}
              >
                {plan.label}
              </span>
              <span className="text-xs text-gray-400">{plan.key}</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Max Staff</span>
                <span className="font-semibold text-gray-900">
                  {plan.maxStaff >= 100 ? "Unlimited*" : plan.maxStaff}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Max Products</span>
                <span className="font-semibold text-gray-900">
                  {plan.maxProducts >= 100000
                    ? "Unlimited*"
                    : plan.maxProducts.toLocaleString("en-US")}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2 group-open:hidden">
              Click to see features
            </p>
          </summary>
          <div className="px-5 pb-5 border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Features
            </p>
            <ul className="space-y-1.5">
              {plan.features.map((f) => (
                <li
                  key={f}
                  className="text-sm text-gray-600 flex items-center gap-2"
                >
                  <span className="text-green-500 text-xs">✓</span> {f}
                </li>
              ))}
            </ul>
          </div>
        </details>
      ))}
    </div>
  );
}
