import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { OrdersContent } from "./orders-content";

export default async function OrdersPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/orders");

  return (
    <OrdersContent merchantId={merchant.id} currency={merchant.currency} />
  );
}
