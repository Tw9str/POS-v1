import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { prisma } from "@/lib/db";
import { dbQuery } from "@/lib/apiError";
import { AnalyticsContent } from "./AnalyticsContent";
import { getMerchantSession } from "@/lib/merchantAuth";
import { t, type Locale } from "@/lib/i18n";

export async function generateMetadata() {
  const session = await getMerchantSession();
  const locale = (session?.language ?? "en") as Locale;
  return { title: t(locale).nav.analytics };
}

export default async function AnalyticsPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/analytics");

  const [dbProducts, dbCustomers, dbOrders] = await dbQuery(() =>
    Promise.all([
      prisma.product.findMany({
        where: { merchantId: merchant.id },
        include: { category: { select: { name: true, color: true } } },
      }),
      prisma.customer.findMany({
        where: { merchantId: merchant.id },
      }),
      prisma.order.findMany({
        where: { merchantId: merchant.id },
        orderBy: { createdAt: "desc" },
        take: 800,
        include: {
          staff: { select: { name: true } },
          customer: { select: { name: true } },
          items: {
            select: {
              productId: true,
              name: true,
              sku: true,
              price: true,
              costPrice: true,
              quantity: true,
              discount: true,
            },
          },
        },
      }),
    ]),
  );

  const products = dbProducts.map((p) => ({
    id: p.id,
    merchantId: p.merchantId,
    name: p.name,
    variantName: p.variantName,
    sku: p.sku,
    barcode: p.barcode,
    price: p.price,
    costPrice: p.costPrice,
    stock: p.stock,
    lowStockAt: p.lowStockAt,
    unit: p.unit,
    trackStock: p.trackStock,
    image: p.image,
    categoryId: p.categoryId,
    categoryName: p.category?.name ?? null,
    categoryColor: p.category?.color ?? null,
    createdAt: p.createdAt.getTime(),
  }));

  const customers = dbCustomers.map((c) => ({
    id: c.id,
    merchantId: c.merchantId,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    notes: c.notes,
    totalSpent: c.totalSpent,
    visitCount: c.visitCount,
    balance: c.balance,
    createdAt: c.createdAt?.toISOString() ?? null,
  }));

  const orders = dbOrders.map((o) => ({
    id: o.id,
    merchantId: o.merchantId,
    orderNumber: o.orderNumber,
    customerId: o.customerId,
    customerName: o.customer?.name ?? null,
    staffId: o.staffId,
    staffName: o.staff?.name ?? null,
    paymentMethod: o.paymentMethod,
    subtotal: o.subtotal,
    taxAmount: o.taxAmount,
    total: o.total,
    paidAmount: o.paidAmount,
    creditAmount: o.creditAmount,
    changeAmount: o.changeAmount,
    paymentStatus: o.paymentStatus,
    status: o.status,
    notes: o.notes,
    createdAt: o.createdAt.getTime(),
    items: o.items.map((i) => ({
      productId: i.productId ?? "",
      name: i.name,
      sku: i.sku,
      price: i.price,
      costPrice: i.costPrice,
      quantity: i.quantity,
      discount: i.discount,
    })),
  }));

  return (
    <AnalyticsContent
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
      products={products}
      customers={customers}
      orders={orders}
    />
  );
}
