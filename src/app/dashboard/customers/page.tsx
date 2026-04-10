import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { CustomersContent } from "./customers-content";

export default async function CustomersPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/customers");

  return (
    <CustomersContent merchantId={merchant.id} currency={merchant.currency} />
  );
}
