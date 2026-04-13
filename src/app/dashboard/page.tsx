import { requireMerchant } from "@/lib/merchant";
import {
  requireStaffForPage,
  getAllowedPages,
  type StaffRole,
} from "@/lib/staff";
import { getStaffSession } from "@/lib/staffAuth";
import { DashboardContent } from "./DashboardContent";

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
      currencyFormat={
        (merchant.currencyFormat ?? "symbol") as "symbol" | "code" | "none"
      }
      numberFormat={
        (merchant.numberFormat ?? "western") as "western" | "eastern"
      }
      language={merchant.language ?? "en"}
      staffRole={role}
      allowedPages={allowedPages}
    />
  );
}
