import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { getStaffSession } from "@/lib/staffAuth";
import { prisma } from "@/lib/db";
import { dbQuery } from "@/lib/apiError";
import { POSTerminal } from "./PosTerminal";
import { getMerchantSession } from "@/lib/merchantAuth";
import { t, type Locale } from "@/lib/i18n";

export async function generateMetadata() {
  const session = await getMerchantSession();
  const locale = (session?.language ?? "en") as Locale;
  return { title: t(locale).nav.pos };
}

export default async function POSPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/pos");

  const staffSession = await getStaffSession();
  const posOnly =
    !!staffSession &&
    !staffSession.isOwner &&
    staffSession.allowedPages.length === 1 &&
    staffSession.allowedPages[0] === "pos";

  const [dbProducts, dbCategories, dbCustomers, dbStaff] = await dbQuery(() =>
    Promise.all([
      prisma.product.findMany({
        where: { merchantId: merchant.id },
        include: { category: { select: { name: true, color: true } } },
      }),
      prisma.category.findMany({
        where: { merchantId: merchant.id },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.customer.findMany({
        where: { merchantId: merchant.id },
      }),
      prisma.staff.findMany({
        where: { merchantId: merchant.id, isActive: true },
      }),
    ]),
  );

  return (
    <POSTerminal
      currentStaffId={staffSession?.staffId || null}
      staffRole={staffSession?.role || "CASHIER"}
      posOnly={posOnly}
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
      products={dbProducts.map((p) => ({
        id: p.id,
        name: p.name,
        variantName: p.variantName,
        sku: p.sku,
        barcode: p.barcode,
        price: p.price,
        costPrice: p.costPrice,
        stock: p.stock,
        trackStock: p.trackStock,
        image: p.image,
        categoryId: p.categoryId,
        categoryName: p.category?.name ?? null,
        categoryColor: p.category?.color ?? null,
      }))}
      categories={dbCategories.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
      }))}
      customers={dbCustomers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        balance: c.balance,
      }))}
      staff={dbStaff.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        maxDiscountPercent: s.maxDiscountPercent,
      }))}
    />
  );
}
