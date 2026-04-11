import { prisma } from "@/lib/db";
import { getMerchantFromSession } from "@/lib/merchant";
import { requireStaffForApi } from "@/lib/staff";
import { generateOrderNumber, SUPPORTED_PAYMENT_METHODS } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orders = await prisma.order.findMany({
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
    });

    return NextResponse.json(orders);
  } catch (err) {
    console.error("GET /api/merchant/orders error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

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
  localId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  staffId: z.string().nullable().optional(),
  paymentMethod: z.enum(SUPPORTED_PAYMENT_METHODS),
  paidAmount: z.number().min(0),
  notes: z.string().nullable().optional(),
  subtotal: z.number().min(0),
  taxAmount: z.number().min(0),
  total: z.number().min(0),
});

const orderActionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["REFUND", "VOID", "PARTIAL_REFUND"]),
  amount: z.number().positive().optional(),
  reason: z.string().max(250).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await requireStaffForApi("/api/merchant/orders");
    if (error) return error;

    const body = await req.json();
    const parsed = orderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const {
      items,
      localId,
      customerId,
      staffId,
      paymentMethod,
      paidAmount,
      notes,
      subtotal,
      taxAmount,
      total,
    } = parsed.data;

    // Dedup: if localId already exists, return existing order
    if (localId) {
      const existing = await prisma.order.findFirst({
        where: { merchantId: merchant.id, localId },
      });
      if (existing) {
        return NextResponse.json(
          { id: existing.id, orderNumber: existing.orderNumber },
          { status: 409 },
        );
      }
    }

    const changeAmount = Math.max(0, paidAmount - total);
    const orderNumber = generateOrderNumber();

    // Use a transaction to create order + update stock + update customer
    const order = await prisma.$transaction(async (tx) => {
      // Create order
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
          changeAmount,
          localId: localId || null,
          syncStatus: localId ? "SYNCED" : "SYNCED",
          paymentMethod: paymentMethod as "CASH" | "CARD" | "MOBILE_MONEY",
          notes: notes || null,
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

      // Update stock for each item
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });

        // Create inventory adjustment
        await tx.inventoryAdjustment.create({
          data: {
            merchantId: merchant.id,
            productId: item.productId,
            type: "SALE",
            quantity: -item.quantity,
            reason: `Sale: ${orderNumber}`,
          },
        });
      }

      // Update customer stats if attached
      if (customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            totalSpent: { increment: total },
            visitCount: { increment: 1 },
          },
        });
      }

      return newOrder;
    });

    // Log activity (outside transaction for non-critical)
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

    return NextResponse.json(
      { id: order.id, orderNumber: order.orderNumber },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/merchant/orders error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error, staff } = await requireStaffForApi("/api/merchant/orders");
    if (error) return error;

    if (!staff || !["OWNER", "MANAGER"].includes(staff.role)) {
      return NextResponse.json(
        { error: "Only managers and owners can manage refunds or void orders" },
        { status: 403 },
      );
    }

    const parsed = orderActionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const existing = await prisma.order.findFirst({
      where: {
        merchantId: merchant.id,
        OR: [{ id: parsed.data.id }, { localId: parsed.data.id }],
      },
      include: {
        items: true,
        customer: { select: { id: true, totalSpent: true, visitCount: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (
      existing.status === "REFUNDED" ||
      existing.status === "VOIDED" ||
      existing.status === "PARTIALLY_REFUNDED"
    ) {
      return NextResponse.json(
        { error: `Order is already ${existing.status.toLowerCase()}` },
        { status: 400 },
      );
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
        return NextResponse.json(
          { error: "Partial refund amount must be greater than zero" },
          { status: 400 },
        );
      }

      if (partialRefundAmount >= existing.total) {
        return NextResponse.json(
          { error: "Use a full refund instead when refunding the whole order" },
          { status: 400 },
        );
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

    return NextResponse.json({
      id: existing.localId || updatedOrder.id,
      status: updatedOrder.status,
      refundedAmount:
        action === "PARTIAL_REFUND" ? partialRefundAmount : existing.total,
    });
  } catch (err) {
    console.error("PUT /api/merchant/orders error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
