import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { DashboardContent } from "./dashboard-content";

export default async function DashboardPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard");

  return (
    <DashboardContent
      merchantId={merchant.id}
      merchantName={merchant.name}
      currency={merchant.currency}
    />
  );
}
