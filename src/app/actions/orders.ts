"use server";

import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/staff";
import { generateOrderNumber, SUPPORTED_PAYMENT_METHODS } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "./_shared";
import { requireMerchant, requireStaffAction } from "./_shared";

const orderItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  sku: z.string().nullable(),
  price: z.number().min(0),
  costPrice: z.number().min(0),
  quantity: z.number().int().min(1),
  discount: z.number().min(0).default(0),
});

const orderSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  customerId: z.string().nullable().optional(),
  staffId: z.string().nullable().optional(),
  paymentMethod: z.enum(SUPPORTED_PAYMENT_METHODS),
  paidAmount: z.number().min(0),
  creditAmount: z.number().min(0).default(0),
  notes: z.string().nullable().optional(),
  subtotal: z.number().min(0),
  taxAmount: z.number().min(0),
  total: z.number().min(0),
  promoCode: z.string().nullable().optional(),
  promoId: z.string().nullable().optional(),
  promoDiscount: z.number().min(0).default(0),
});

export async function createOrder(
  input: z.infer<typeof orderSchema>,
): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr } = await requireStaffAction(
    "/api/merchant/orders",
    "POST",
  );
  if (sErr) return { error: sErr };

  const parsed = orderSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const {
    items,
    customerId,
    staffId: inputStaffId,
    paymentMethod,
    paidAmount,
    creditAmount,
    notes,
    subtotal,
    taxAmount,
    total,
    promoCode,
    promoId,
    promoDiscount,
  } = parsed.data;

  const staff = await getStaff();
  const staffId = inputStaffId || staff?.staffId || null;

  const changeAmount = Math.max(0, paidAmount - total);
  const orderNumber = generateOrderNumber();

  const paymentStatus =
    creditAmount > 0 && paidAmount > 0
      ? "partial_credit"
      : creditAmount > 0
        ? "credit"
        : "paid";

  if (creditAmount > 0 && !customerId) {
    return { error: "Credit requires a selected customer" };
  }

  const order = await prisma.$transaction(
    async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          merchantId: merchant.id,
          staffId: staffId || null,
          customerId: customerId || null,
          orderNumber,
          status: "COMPLETED",
          subtotal,
          taxAmount,
          total,
          paidAmount,
          creditAmount,
          changeAmount,
          paymentStatus,
          paymentMethod: paymentMethod as
            | "CASH"
            | "CARD"
            | "MOBILE_MONEY"
            | "CREDIT",
          notes: notes || null,
          promoCode: promoCode || null,
          promoId: promoId || null,
          promoDiscount: promoDiscount || 0,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              name: item.name,
              sku: item.sku,
              price: item.price,
              costPrice: item.costPrice,
              quantity: item.quantity,
              discount: item.discount,
              total: item.price * item.quantity - item.discount,
            })),
          },
        },
      });

      await Promise.all(
        items.map((item) =>
          Promise.all([
            tx.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.quantity } },
            }),
            tx.inventoryAdjustment.create({
              data: {
                merchantId: merchant.id,
                productId: item.productId,
                type: "SALE",
                quantity: -item.quantity,
                reason: `Sale: ${orderNumber}`,
              },
            }),
          ]),
        ),
      );

      if (customerId) {
        const customerUpdate: Record<string, unknown> = {
          totalSpent: { increment: total },
          visitCount: { increment: 1 },
        };
        if (creditAmount > 0) {
          customerUpdate.balance = { increment: creditAmount };
        }
        await tx.customer.update({
          where: { id: customerId },
          data: customerUpdate,
        });
      }

      return newOrder;
    },
    { timeout: 15000 },
  );

  await prisma.activityLog
    .create({
      data: {
        merchantId: merchant.id,
        action: "ORDER_CREATED",
        entity: "order",
        entityId: order.id,
      },
    })
    .catch(() => {});

  revalidatePath("/dashboard", "layout");
  return {
    success: true,
    data: { id: order.id, orderNumber: order.orderNumber },
  };
}

const orderActionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["REFUND", "VOID", "PARTIAL_REFUND"]),
  amount: z.number().positive().optional(),
  reason: z.string().max(250).optional().nullable(),
});

export async function processOrderAction(
  input: z.infer<typeof orderActionSchema>,
): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr, staff } = await requireStaffAction(
    "/api/merchant/orders",
    "PUT",
  );
  if (sErr) return { error: sErr };

  if (!staff || !["OWNER", "MANAGER"].includes(staff.role)) {
    return {
      error: "Only managers and owners can manage refunds or void orders",
    };
  }

  const parsed = orderActionSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const existing = await prisma.order.findFirst({
    where: { merchantId: merchant.id, id: parsed.data.id },
    include: {
      items: true,
      customer: { select: { id: true, totalSpent: true, visitCount: true } },
    },
  });
  if (!existing) return { error: "Order not found" };

  if (["REFUNDED", "VOIDED", "PARTIALLY_REFUNDED"].includes(existing.status)) {
    return { error: `Order is already ${existing.status.toLowerCase()}` };
  }

  const action = parsed.data.action;
  const nextStatus =
    action === "REFUND"
      ? "REFUNDED"
      : action === "PARTIAL_REFUND"
        ? "PARTIALLY_REFUNDED"
        : "VOIDED";
  const reasonPrefix =
    action === "REFUND"
      ? "Refund"
      : action === "PARTIAL_REFUND"
        ? "Partial refund"
        : "Void";
  const partialRefundAmount =
    action === "PARTIAL_REFUND" ? Number(parsed.data.amount ?? 0) : 0;

  if (action === "PARTIAL_REFUND") {
    if (!Number.isFinite(partialRefundAmount) || partialRefundAmount <= 0) {
      return { error: "Partial refund amount must be greater than zero" };
    }
    if (partialRefundAmount >= existing.total) {
      return {
        error: "Use a full refund instead when refunding the whole order",
      };
    }
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const noteParts = [existing.notes, parsed.data.reason].filter(Boolean);
    if (action === "PARTIAL_REFUND") {
      noteParts.push(`Partial refund amount: ${partialRefundAmount}`);
    }

    const order = await tx.order.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        notes: noteParts.join(" • ") || existing.notes,
      },
    });

    if (action !== "PARTIAL_REFUND") {
      for (const item of existing.items) {
        if (!item.productId) continue;
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
        await tx.inventoryAdjustment.create({
          data: {
            merchantId: merchant.id,
            productId: item.productId,
            type: "RETURN",
            quantity: item.quantity,
            reason: `${reasonPrefix}: ${existing.orderNumber}`,
          },
        });
      }
    }

    if (existing.customer) {
      await tx.customer.update({
        where: { id: existing.customer.id },
        data: {
          totalSpent: Math.max(
            0,
            existing.customer.totalSpent -
              (action === "PARTIAL_REFUND"
                ? partialRefundAmount
                : existing.total),
          ),
          ...(action === "PARTIAL_REFUND"
            ? {}
            : { visitCount: Math.max(0, existing.customer.visitCount - 1) }),
        },
      });
    }

    return order;
  });

  await prisma.activityLog
    .create({
      data: {
        merchantId: merchant.id,
        action:
          action === "REFUND"
            ? "ORDER_REFUNDED"
            : action === "PARTIAL_REFUND"
              ? "ORDER_PARTIALLY_REFUNDED"
              : "ORDER_VOIDED",
        entity: "order",
        entityId: existing.id,
      },
    })
    .catch(() => {});

  revalidatePath("/dashboard", "layout");
  return {
    success: true,
    data: {
      id: updatedOrder.id,
      status: updatedOrder.status,
      refundedAmount:
        action === "PARTIAL_REFUND" ? partialRefundAmount : existing.total,
    },
  };
}
