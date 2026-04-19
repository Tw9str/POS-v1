import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { prisma } from "@/lib/db";
import { dbQuery } from "@/lib/apiError";
import { CustomersContent } from "./CustomersContent";
import { getMerchantSession } from "@/lib/merchantAuth";
import { t, type Locale } from "@/lib/i18n";

export async function generateMetadata() {
  const session = await getMerchantSession();
  const locale = (session?.language ?? "en") as Locale;
  return { title: t(locale).nav.customers };
}

export default async function CustomersPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/customers");

  const customers = await dbQuery(() =>
    prisma.customer.findMany({
      where: { merchantId: merchant.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        notes: true,
        totalSpent: true,
        visitCount: true,
        balance: true,
        createdAt: true,
      },
    }),
  );

  return (
    <CustomersContent
      merchantId={merchant.id}
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
      customers={customers.map((c) => ({
        ...c,
        phone: c.phone ?? null,
        email: c.email ?? null,
        address: c.address ?? null,
        notes: c.notes ?? null,
        totalSpent: c.totalSpent,
        balance: c.balance,
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
