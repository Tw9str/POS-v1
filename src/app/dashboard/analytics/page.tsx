import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { AnalyticsContent } from "./analytics-content";

export default async function AnalyticsPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/analytics");

  return (
    <AnalyticsContent
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
      language={merchant.language ?? "en"}
    />
  );
}
