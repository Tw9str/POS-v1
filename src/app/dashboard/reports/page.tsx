import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { ReportsContent } from "./reports-content";

export default async function ReportsPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/reports");

  return (
    <ReportsContent
      merchantId={merchant.id}
      currency={merchant.currency}
      numberFormat={
        (merchant.numberFormat ?? "western") as "western" | "eastern"
      }
      dateFormat={
        (merchant.dateFormat ?? "long") as
          | "long"
          | "numeric"
          | "arabic"
          | "gregorian"
          | "hijri"
      }
    />
  );
}
