import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { SettingsForm } from "./SettingsForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { t, type Locale } from "@/lib/i18n";
import { getMerchantSession } from "@/lib/merchantAuth";
import { prisma } from "@/lib/db";

export async function generateMetadata() {
  const session = await getMerchantSession();
  const locale = (session?.language ?? "en") as Locale;
  return { title: t(locale).nav.settings };
}

export default async function SettingsPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/settings");
  const language = (merchant.language ?? "en") as Locale;
  const i = t(language);

  const subscription = await prisma.subscription.findUnique({
    where: { merchantId: merchant.id },
    select: { plan: true, status: true, expiresAt: true },
  });

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
          currencyFormat: merchant.currencyFormat ?? "symbol",
          numberFormat: merchant.numberFormat ?? "western",
          dateFormat: merchant.dateFormat ?? "long",
          language: merchant.language ?? "en",
          taxRate: merchant.taxRate,
          shamcashId: merchant.shamcashId ?? "",
        }}
        subscription={
          subscription
            ? {
                plan: subscription.plan,
                status: subscription.status,
                expiresAt: subscription.expiresAt.toISOString(),
              }
            : null
        }
      />
    </div>
  );
}
