import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconShield, IconLicense, IconCalendar } from "@/components/Icons";
import { getAdminSettings } from "@/app/actions/admin";
import { GracePeriodForm, PlanCards } from "./SettingsWidgets";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "System Settings" };

const LICENSE_CONFIG = [
  { label: "Algorithm", value: "Ed25519 (EdDSA)" },
  { label: "Token Format", value: "JWT (JWS Compact)" },
  { label: "Default Duration", value: "30 days" },
  { label: "Signature Verification", value: "Public key (JWK)" },
];

const SUB_STATUSES = [
  {
    status: "ACTIVE",
    desc: "Subscription is current and fully operational",
    variant: "success" as const,
  },
  {
    status: "PAST_DUE",
    desc: "Payment overdue, grace period active",
    variant: "warning" as const,
  },
  {
    status: "EXPIRED",
    desc: "Subscription expired, renewal required",
    variant: "danger" as const,
  },
  {
    status: "SUSPENDED",
    desc: "Merchant suspended by administrator",
    variant: "danger" as const,
  },
];

export default async function AdminSettingsPage() {
  const settings = await getAdminSettings();
  const gracePeriodDays = settings?.gracePeriodDays ?? 7;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-500 mt-1">
          Platform configuration and plan reference
        </p>
      </div>

      {/* Global Settings */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <IconCalendar size={20} className="text-amber-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Global Settings
          </h2>
        </div>
        <Card>
          <div className="p-5">
            <GracePeriodForm initialDays={gracePeriodDays} />
          </div>
        </Card>
      </section>

      {/* Subscription Plans */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <IconShield size={20} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Subscription Plans
          </h2>
        </div>
        <PlanCards />
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
              {[
                { label: "Framework", value: "Next.js 16" },
                { label: "Database", value: "PostgreSQL (Prisma)" },
                { label: "Authentication", value: "NextAuth.js" },
                { label: "Access Codes", value: "bcrypt hashed" },
                { label: "Frontend", value: "Next.js + React" },
                { label: "Styling", value: "Tailwind CSS v4" },
              ].map((item) => (
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
          </div>
        </Card>
      </section>
    </div>
  );
}
