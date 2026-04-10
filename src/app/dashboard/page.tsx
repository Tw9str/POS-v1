import { requireMerchant } from "@/lib/merchant";
import {
  requireStaffForPage,
  getAllowedPages,
  type StaffRole,
} from "@/lib/staff";
import { getStaffSession } from "@/lib/staff-auth";
import { DashboardContent } from "./dashboard-content";

export default async function DashboardPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard");

  const staffSession = await getStaffSession();
  const role = (staffSession?.role ?? "CASHIER") as StaffRole;
  const allowedPages = getAllowedPages(role);

  return (
    <DashboardContent
      merchantId={merchant.id}
      merchantName={merchant.name}
      currency={merchant.currency}
      numberFormat={
        (merchant.numberFormat ?? "western") as "western" | "eastern"
      }
      staffRole={role}
      allowedPages={allowedPages}
    />
  );
}
