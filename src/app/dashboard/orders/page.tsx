import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { OrdersContent } from "./OrdersContent";

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
      currencyFormat={
        (merchant.currencyFormat ?? "symbol") as "symbol" | "code" | "none"
      }
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
