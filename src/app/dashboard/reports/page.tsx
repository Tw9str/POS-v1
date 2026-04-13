import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { ReportsContent } from "./ReportsContent";

export default async function ReportsPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/reports");

  return (
    <ReportsContent
      merchantId={merchant.id}
      currency={merchant.currency}
      currencyFormat={
        (merchant.currencyFormat ?? "symbol") as "symbol" | "code" | "none"
      }
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
      language={merchant.language ?? "en"}
    />
  );
}
