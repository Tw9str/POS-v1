import { prisma } from "@/lib/db";
import { getMerchantFromSession } from "@/lib/merchant";
import { requireStaffForApi } from "@/lib/staff";
import { apiError } from "@/lib/apiError";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

const paymentSchema = z.object({
  customerId: z.string().min(1),
  orderId: z.string().nullable().optional(),
  amount: z.number().positive(),
  method: z.enum(["CASH", "MOBILE_MONEY", "CARD"]),
  note: z.string().max(500).nullable().optional(),
});

export async function GET(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error: staffError } = await requireStaffForApi(
      "/api/merchant/payments",
    );
    if (staffError) return staffError;

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");

    const where: Record<string, unknown> = { merchantId: merchant.id };
    if (customerId) where.customerId = customerId;

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        customer: { select: { name: true } },
        order: { select: { orderNumber: true } },
      },
    });

    return NextResponse.json(payments);
  } catch (err) {
    return apiError(err, "GET /api/merchant/payments");
  }
}

export async function POST(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error: staffError } = await requireStaffForApi(
      "/api/merchant/payments",
    );
    if (staffError) return staffError;

    const body = await req.json();
    const parsed = paymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const { customerId, orderId, amount, method, note } = parsed.data;

    // Verify customer belongs to merchant and has balance
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, merchantId: merchant.id },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    if (customer.balance <= 0) {
      return NextResponse.json(
        { error: "Customer has no outstanding balance" },
        { status: 400 },
      );
    }

    // Cap payment at the outstanding balance
    const actualAmount = Math.min(amount, customer.balance);

    const payment = await prisma.$transaction(async (tx) => {
      // Create payment record
      const newPayment = await tx.payment.create({
        data: {
          merchantId: merchant.id,
          customerId,
          orderId: orderId || null,
          amount: actualAmount,
          method: method as "CASH" | "CARD" | "MOBILE_MONEY",
          note: note || null,
        },
      });

      // Reduce customer balance
      await tx.customer.update({
        where: { id: customerId },
        data: { balance: { decrement: actualAmount } },
      });

      // Update credit order(s)
      if (orderId) {
        // Single order specified
        const order = await tx.order.findFirst({
          where: { id: orderId, merchantId: merchant.id },
        });
        if (order) {
          const newCreditAmount = Math.max(
            0,
            order.creditAmount - actualAmount,
          );
          await tx.order.update({
            where: { id: orderId },
            data: {
              creditAmount: newCreditAmount,
              paidAmount: { increment: actualAmount },
              paymentStatus:
                newCreditAmount <= 0 ? "settled" : "partial_credit",
            },
          });
        }
      } else {
        // No specific order: distribute payment across all credit orders
        // Create separate payment records per order so the ledger can track them
        const creditOrders = await tx.order.findMany({
          where: {
            merchantId: merchant.id,
            customerId,
            status: { not: "VOIDED" },
            paymentStatus: { in: ["credit", "partial_credit"] },
            creditAmount: { gt: 0 },
          },
          orderBy: { createdAt: "asc" },
        });
        let remaining = actualAmount;
        let isFirst = true;
        for (const order of creditOrders) {
          if (remaining <= 0) break;
          const applied = Math.min(remaining, order.creditAmount);
          const newCreditAmount = Math.max(0, order.creditAmount - applied);
          await tx.order.update({
            where: { id: order.id },
            data: {
              creditAmount: newCreditAmount,
              paidAmount: { increment: applied },
              paymentStatus:
                newCreditAmount <= 0 ? "settled" : "partial_credit",
            },
          });
          // Create linked payment for each order (skip first — already created above)
          if (isFirst) {
            await tx.payment.update({
              where: { id: newPayment.id },
              data: { orderId: order.id, amount: applied },
            });
            isFirst = false;
          } else {
            await tx.payment.create({
              data: {
                merchantId: merchant.id,
                customerId,
                orderId: order.id,
                amount: applied,
                method: method as "CASH" | "CARD" | "MOBILE_MONEY",
                note: note || null,
              },
            });
          }
          remaining -= applied;
        }
      }

      return newPayment;
    });

    // Log activity
    await prisma.activityLog
      .create({
        data: {
          merchantId: merchant.id,
          action: "PAYMENT_COLLECTED",
          entity: "payment",
          entityId: payment.id,
        },
      })
      .catch(() => {});

    revalidatePath("/dashboard/customers");
    return NextResponse.json(payment, { status: 201 });
  } catch (err) {
    return apiError(err, "POST /api/merchant/payments");
  }
}
