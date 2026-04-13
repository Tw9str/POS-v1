import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { PromosContent } from "./promos-content";

export default async function PromosPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/promos");

  return (
    <PromosContent
      merchantId={merchant.id}
      currency={merchant.currency}
      numberFormat={
        (merchant.numberFormat ?? "western") as "western" | "eastern"
      }
      language={merchant.language ?? "en"}
    />
  );
}
