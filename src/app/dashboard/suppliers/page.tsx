import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { SuppliersContent } from "./SuppliersContent";

export default async function SuppliersPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/suppliers");

  return (
    <SuppliersContent
      merchantId={merchant.id}
      numberFormat={
        (merchant.numberFormat ?? "western") as "western" | "eastern"
      }
      language={merchant.language ?? "en"}
    />
  );
}
