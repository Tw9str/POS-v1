import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/settings");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Settings
        </h1>
        <p className="text-slate-500 mt-1">Manage your store settings</p>
      </div>

      <SettingsForm
        merchant={{
          id: merchant.id,
          name: merchant.name,
          phone: merchant.phone || "",
          address: merchant.address || "",
          currency: merchant.currency,
          taxRate: merchant.taxRate,
        }}
      />
    </div>
  );
}
