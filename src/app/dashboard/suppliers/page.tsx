import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { SuppliersContent } from "./suppliers-content";

export default async function SuppliersPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/suppliers");

  return <SuppliersContent merchantId={merchant.id} />;
}
