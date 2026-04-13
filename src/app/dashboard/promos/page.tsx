import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { PromosContent } from "./PromosContent";

export default async function PromosPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/promos");

  return (
    <PromosContent
      merchantId={merchant.id}
      currency={merchant.currency}
      currencyFormat={
        (merchant.currencyFormat ?? "symbol") as "symbol" | "code" | "none"
      }
      numberFormat={
        (merchant.numberFormat ?? "western") as "western" | "eastern"
      }
      language={merchant.language ?? "en"}
    />
  );
}
