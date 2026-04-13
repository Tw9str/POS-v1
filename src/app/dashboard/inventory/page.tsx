import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { InventoryContent } from "./InventoryContent";

export default async function InventoryPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/inventory");

  return (
    <InventoryContent
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
