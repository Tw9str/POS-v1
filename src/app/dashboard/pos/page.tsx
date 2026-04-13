import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { getStaffSession } from "@/lib/staffAuth";
import { POSTerminal } from "./PosTerminal";

export default async function POSPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/pos");

  const staffSession = await getStaffSession();

  return (
    <POSTerminal
      currentStaffId={staffSession?.staffId || null}
      staffRole={staffSession?.role || "CASHIER"}
      language={merchant.language ?? "en"}
      merchant={{
        id: merchant.id,
        name: merchant.name,
        currency: merchant.currency,
        currencyFormat: (merchant.currencyFormat ?? "symbol") as
          | "symbol"
          | "code"
          | "none",
        numberFormat: (merchant.numberFormat ?? "western") as
          | "western"
          | "eastern",
        dateFormat: (merchant.dateFormat ?? "long") as
          | "long"
          | "numeric"
          | "arabic"
          | "gregorian"
          | "hijri",
        taxRate: merchant.taxRate,
        phone: merchant.phone ?? null,
        address: merchant.address ?? null,
        shamcashId: merchant.shamcashId ?? null,
      }}
    />
  );
}
