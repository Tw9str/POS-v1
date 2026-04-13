import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { ProductsContent } from "./ProductsContent";

export default async function ProductsPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/products");

  return (
    <ProductsContent
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
