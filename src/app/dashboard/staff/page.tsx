import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { StaffContent } from "./staff-content";

export default async function StaffPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/staff");

  return (
    <StaffContent
      merchantId={merchant.id}
      numberFormat={
        (merchant.numberFormat ?? "western") as "western" | "eastern"
      }
    />
  );
}
