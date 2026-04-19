"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconShield, IconLicense, IconCalendar } from "@/components/Icons";

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

const LICENSE_CONFIG = [
  { label: "Algorithm", value: "Ed25519 (EdDSA)" },
  { label: "Token Format", value: "JWT (JWS Compact)" },
  { label: "Default Duration", value: "30 days" },
  { label: "Grace Period", value: "7 days" },
  { label: "Signature Verification", value: "Public key (JWK)" },
];

const SUB_STATUSES = [
  {
    status: "ACTIVE",
    desc: "Subscription is current and fully operational",
    variant: "success" as const,
  },
  {
    status: "TRIAL",
    desc: "Free trial period, limited features",
    variant: "info" as const,
  },
  {
    status: "PAST_DUE",
    desc: "Payment overdue, grace period active",
    variant: "warning" as const,
  },
  {
    status: "SUSPENDED",
    desc: "Account suspended, no access",
    variant: "danger" as const,
  },
  {
    status: "CANCELLED",
    desc: "Subscription cancelled, data retained",
    variant: "danger" as const,
  },
];

export default function SettingsContent() {
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-500 mt-1">
          Platform configuration and plan reference
        </p>
      </div>

      {/* Subscription Plans */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <IconShield size={20} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Subscription Plans
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`cursor-pointer transition-all rounded-xl ${expandedPlan === plan.key ? "ring-2 ring-blue-500" : ""}`}
              onClick={() =>
                setExpandedPlan(expandedPlan === plan.key ? null : plan.key)
              }
            >
              <Card>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${plan.color}`}
                    >
                      {plan.label}
                    </span>
                    <span className="text-xs text-gray-400">{plan.key}</span>
                  </div>

                  <div className="space-y-2 mb-4">
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
                          : plan.maxProducts.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`overflow-hidden transition-all ${
                      expandedPlan === plan.key
                        ? "max-h-96 opacity-100"
                        : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="border-t border-gray-100 pt-3 mt-1">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                        Features
                      </p>
                      <ul className="space-y-1.5">
                        {plan.features.map((f) => (
                          <li
                            key={f}
                            className="text-sm text-gray-600 flex items-center gap-2"
                          >
                            <span className="text-green-500 text-xs">✓</span>{" "}
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {expandedPlan !== plan.key && (
                    <p className="text-xs text-gray-400 mt-2">
                      Click to see features
                    </p>
                  )}
                </div>
              </Card>
            </div>
          ))}
        </div>
      </section>

      {/* License Configuration */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <IconLicense size={20} className="text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            License Configuration
          </h2>
        </div>

        <Card>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {LICENSE_CONFIG.map((item) => (
                <div key={item.label} className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {item.label}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> License keys are generated using Ed25519
                digital signatures and verified client-side using the public
                key. Revoking a license invalidates it in the database but the
                JWT may still verify cryptographically until checked against the
                revocation list.
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* Subscription Status Reference */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <IconCalendar size={20} className="text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Subscription Status Reference
          </h2>
        </div>

        <Card>
          <div className="p-5">
            <div className="space-y-3">
              {SUB_STATUSES.map((s) => (
                <div
                  key={s.status}
                  className="flex items-center gap-4 p-3 rounded-lg bg-gray-50"
                >
                  <Badge variant={s.variant}>{s.status}</Badge>
                  <p className="text-sm text-gray-600">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>

      {/* System Info */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          System Information
        </h2>
        <Card>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Framework
                </p>
                <p className="text-sm font-medium text-gray-900">Next.js 16</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Database
                </p>
                <p className="text-sm font-medium text-gray-900">
                  PostgreSQL (Prisma)
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Authentication
                </p>
                <p className="text-sm font-medium text-gray-900">NextAuth.js</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Access Codes
                </p>
                <p className="text-sm font-medium text-gray-900">
                  bcrypt hashed
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Frontend
                </p>
                <p className="text-sm font-medium text-gray-900">
                  Next.js + React
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Styling
                </p>
                <p className="text-sm font-medium text-gray-900">
                  Tailwind CSS v4
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
