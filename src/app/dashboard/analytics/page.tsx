import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { AnalyticsContent } from "./AnalyticsContent";

export default async function AnalyticsPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/analytics");

  return (
    <AnalyticsContent
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
