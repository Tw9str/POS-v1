import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { ProductsContent } from "./products-content";

export default async function ProductsPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/products");

  return (
    <ProductsContent
      merchantId={merchant.id}
      currency={merchant.currency}
      numberFormat={
        (merchant.numberFormat ?? "western") as "western" | "eastern"
      }
    />
  );
}
