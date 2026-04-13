import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { SettingsForm } from "./settings-form";
import { PageHeader } from "@/components/layout/page-header";
import { t, type Locale } from "@/lib/i18n";

export default async function SettingsPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/settings");
  const language = (merchant.language ?? "en") as Locale;
  const i = t(language);

  return (
    <div className="space-y-6">
      <PageHeader title={i.settings.title} subtitle={i.settings.subtitle} />

      <SettingsForm
        merchant={{
          id: merchant.id,
          name: merchant.name,
          phone: merchant.phone || "",
          address: merchant.address || "",
          currency: merchant.currency,
          numberFormat: merchant.numberFormat ?? "western",
          dateFormat: merchant.dateFormat ?? "long",
          language: merchant.language ?? "en",
          taxRate: merchant.taxRate,
        }}
      />
    </div>
  );
}
