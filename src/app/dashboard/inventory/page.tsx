import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { InventoryContent } from "./inventory-content";

export default async function InventoryPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/inventory");

  return <InventoryContent merchantId={merchant.id} />;
}
