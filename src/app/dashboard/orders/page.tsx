import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { prisma } from "@/lib/db";
import { dbQuery } from "@/lib/apiError";
import { OrdersContent } from "./OrdersContent";
import { getMerchantSession } from "@/lib/merchantAuth";
import { t, type Locale } from "@/lib/i18n";

export async function generateMetadata() {
  const session = await getMerchantSession();
  const locale = (session?.language ?? "en") as Locale;
  return { title: t(locale).nav.orders };
}

export default async function OrdersPage() {
  const merchant = await requireMerchant();
  await requireStaffForPage("/dashboard/orders");

  const orders = await dbQuery(() =>
    prisma.order.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: "desc" },
      take: 200,
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
  );

  return (
    <OrdersContent
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
      orders={orders.map((o) => ({
        id: o.id,
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
      }))}
    />
  );
}
