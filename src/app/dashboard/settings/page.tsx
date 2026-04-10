import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { SettingsForm } from "./settings-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function SettingsPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/settings");

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Manage your store settings" />

      <SettingsForm
        merchant={{
          id: merchant.id,
          name: merchant.name,
          phone: merchant.phone || "",
          address: merchant.address || "",
          currency: merchant.currency,
          numberFormat: merchant.numberFormat ?? "western",
          dateFormat: merchant.dateFormat ?? "long",
          taxRate: merchant.taxRate,
        }}
      />
    </div>
  );
}
