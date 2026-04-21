import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { PromosContent } from "./PromosContent";
import { getMerchantSession } from "@/lib/merchantAuth";
import { t, type Locale } from "@/lib/i18n";
import { getPromotions } from "@/app/actions/merchant";

export async function generateMetadata() {
  const session = await getMerchantSession();
  const locale = (session?.language ?? "en") as Locale;
  return { title: t(locale).nav.promos };
}

export default async function PromosPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/promos");

  const dbPromos = await getPromotions(merchant.id);
  const promos = dbPromos.map((p) => ({
    id: p.id,
    code: p.code,
    type: p.type as "PERCENT" | "FIXED",
    value: p.value,
    scope: p.scope as "ORDER" | "PRODUCT" | "CATEGORY",
    scopeTargetId: p.scopeTargetId,
    minSubtotal: p.minSubtotal,
    maxDiscount: p.maxDiscount,
    startsAt: p.startsAt?.toISOString() ?? null,
    endsAt: p.endsAt?.toISOString() ?? null,
    maxUses: p.maxUses,
    usedCount: p.usedCount,
    maxUsesPerCustomer: p.maxUsesPerCustomer,
    stackable: p.stackable,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <PromosContent
      currency={merchant.currency}
      currencyFormat={
        (merchant.currencyFormat ?? "symbol") as "symbol" | "code" | "none"
      }
      numberFormat={
        (merchant.numberFormat ?? "western") as "western" | "eastern"
      }
      language={merchant.language ?? "en"}
      initialPromos={promos}
    />
  );
}
