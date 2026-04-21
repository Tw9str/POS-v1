"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "./_shared";
import { requireMerchant, requireStaffAction } from "./_shared";

// ─── Customers ───

const customerSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

export async function createCustomer(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr } = await requireStaffAction(
    "/api/merchant/customers",
    "POST",
  );
  if (sErr) return { error: sErr };

  const raw = Object.fromEntries(formData);
  const parsed = customerSchema.safeParse(raw);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const customer = await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/pos");
  return { success: true, data: customer };
}

export async function updateCustomer(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr } = await requireStaffAction(
    "/api/merchant/customers",
    "PUT",
  );
  if (sErr) return { error: sErr };

  const raw = Object.fromEntries(formData);
  const id = raw.id as string;
  if (!id) return { error: "Customer ID required" };

  const parsed = customerSchema.safeParse(raw);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const existing = await prisma.customer.findFirst({
    where: { id, merchantId: merchant.id },
  });
  if (!existing) return { error: "Customer not found" };

  const updated = await prisma.customer.update({
    where: { id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/pos");
  return { success: true, data: updated };
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr } = await requireStaffAction(
    "/api/merchant/customers",
    "DELETE",
  );
  if (sErr) return { error: sErr };

  const existing = await prisma.customer.findFirst({
    where: { id, merchantId: merchant.id },
  });
  if (!existing) return { error: "Customer not found" };

  await prisma.customer.delete({ where: { id } });

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/pos");
  return { success: true };
}

// ─── Payments ───

const paymentSchema = z.object({
  customerId: z.string().min(1),
  orderId: z.string().nullable().optional(),
  amount: z.number().positive(),
  method: z.enum(["CASH", "MOBILE_MONEY", "CARD"]),
  note: z.string().max(500).nullable().optional(),
});

export async function collectPayment(
  input: z.infer<typeof paymentSchema>,
): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr } = await requireStaffAction(
    "/api/merchant/payments",
    "POST",
  );
  if (sErr) return { error: sErr };

  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { customerId, orderId, amount, method, note } = parsed.data;

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, merchantId: merchant.id },
  });
  if (!customer) return { error: "Customer not found" };
  if (customer.balance <= 0)
    return { error: "Customer has no outstanding balance" };

  const actualAmount = Math.min(amount, customer.balance);

  const payment = await prisma.$transaction(async (tx) => {
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

    await tx.customer.update({
      where: { id: customerId },
      data: { balance: { decrement: actualAmount } },
    });

    if (orderId) {
      const order = await tx.order.findFirst({
        where: { id: orderId, merchantId: merchant.id },
      });
      if (order) {
        const newCreditAmount = Math.max(0, order.creditAmount - actualAmount);
        await tx.order.update({
          where: { id: orderId },
          data: {
            creditAmount: newCreditAmount,
            paidAmount: { increment: actualAmount },
            paymentStatus: newCreditAmount <= 0 ? "settled" : "partial_credit",
          },
        });
      }
    } else {
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
            paymentStatus: newCreditAmount <= 0 ? "settled" : "partial_credit",
          },
        });
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
  return { success: true, data: payment };
}

export async function getCustomerPayments(customerId: string) {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return [];

  return prisma.payment.findMany({
    where: { merchantId: merchant.id, customerId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      customer: { select: { name: true } },
      order: { select: { orderNumber: true } },
    },
  });
}

export async function getCustomerCreditOrders(customerId: string) {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return [];

  return prisma.order.findMany({
    where: {
      merchantId: merchant.id,
      customerId,
      status: { not: "VOIDED" },
      paymentStatus: { in: ["credit", "partial_credit", "settled"] },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      staff: { select: { name: true } },
      items: {
        select: { name: true, price: true, quantity: true, discount: true },
      },
    },
  });
}
