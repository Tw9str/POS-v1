import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { OrdersContent } from "./orders-content";

export default async function OrdersPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/orders");

  return (
    <OrdersContent
      merchantId={merchant.id}
      merchantName={merchant.name}
      merchantAddress={merchant.address}
      merchantPhone={merchant.phone}
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
    />
  );
}
