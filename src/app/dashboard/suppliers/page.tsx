import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { prisma } from "@/lib/db";
import { dbQuery } from "@/lib/apiError";
import { SuppliersContent } from "./SuppliersContent";
import { getMerchantSession } from "@/lib/merchantAuth";
import { t, type Locale } from "@/lib/i18n";

export async function generateMetadata() {
  const session = await getMerchantSession();
  const locale = (session?.language ?? "en") as Locale;
  return { title: t(locale).nav.suppliers };
}

export default async function SuppliersPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/suppliers");

  const dbSuppliers = await dbQuery(() =>
    prisma.supplier.findMany({
      where: { merchantId: merchant.id },
      include: { _count: { select: { purchaseOrders: true } } },
      orderBy: { createdAt: "desc" },
    }),
  );

  return (
    <SuppliersContent
      merchantId={merchant.id}
      numberFormat={
        (merchant.numberFormat ?? "western") as "western" | "eastern"
      }
      language={merchant.language ?? "en"}
      suppliers={dbSuppliers.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        email: s.email,
        address: s.address,
        notes: s.notes,
        _orderCount: s._count.purchaseOrders,
      }))}
    />
  );
}
