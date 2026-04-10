import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { getStaffSession } from "@/lib/staff-auth";
import { POSTerminal } from "./pos-terminal";

export default async function POSPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/pos");

  const staffSession = await getStaffSession();

  return (
    <POSTerminal
      currentStaffId={staffSession?.staffId || null}
      merchant={{
        id: merchant.id,
        name: merchant.name,
        currency: merchant.currency,
        taxRate: merchant.taxRate,
        phone: merchant.phone ?? null,
        address: merchant.address ?? null,
      }}
    />
  );
}
