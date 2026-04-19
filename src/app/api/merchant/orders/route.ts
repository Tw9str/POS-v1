import { prisma } from "@/lib/db";
import { getMerchantFromSession } from "@/lib/merchant";
import { requireStaffForApi, getStaff } from "@/lib/staff";
import { generateOrderNumber, SUPPORTED_PAYMENT_METHODS } from "@/lib/utils";
import { apiError } from "@/lib/apiError";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error: staffError } = await requireStaffForApi(
      "/api/merchant/orders",
    );
    if (staffError) return staffError;

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const creditOnly = searchParams.get("credit") === "true";

    const where: Record<string, unknown> = { merchantId: merchant.id };
    if (customerId) where.customerId = customerId;
    if (creditOnly) {
      where.status = { not: "VOIDED" };
      where.paymentStatus = { in: ["credit", "partial_credit", "settled"] };
    }

    const orders = await prisma.order.findMany({
      where,
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
    return apiError(err, "GET /api/merchant/orders");
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
  customerId: z.string().nullable().optional(),
  paymentMethod: z.enum(SUPPORTED_PAYMENT_METHODS),
  paidAmount: z.number().min(0),
  creditAmount: z.number().min(0).default(0),
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
      customerId,
      paymentMethod,
      paidAmount,
      creditAmount,
      notes,
      subtotal,
      taxAmount,
      total,
    } = parsed.data;

    // Use authenticated staff session instead of client-provided staffId
    const staff = await getStaff();
    const staffId = staff?.staffId ?? null;

    const changeAmount = Math.max(0, paidAmount - total);
    const orderNumber = generateOrderNumber();

    // Determine payment status
    const paymentStatus =
      creditAmount > 0 && paidAmount > 0
        ? "partial_credit"
        : creditAmount > 0
          ? "credit"
          : "paid";

    // Credit requires a customer
    if (creditAmount > 0 && !customerId) {
      return NextResponse.json(
        { error: "Credit requires a selected customer" },
        { status: 400 },
      );
    }

    // Use a transaction to create order + update stock + update customer
    const order = await prisma.$transaction(
      async (tx) => {
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
            creditAmount,
            changeAmount,
            paymentStatus,
            paymentMethod: paymentMethod as
              | "CASH"
              | "CARD"
              | "MOBILE_MONEY"
              | "CREDIT",
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

        // Update stock + create inventory adjustments in parallel per item
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

        // Update customer stats if attached
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

    revalidatePath("/dashboard", "layout");
    return NextResponse.json(
      { id: order.id, orderNumber: order.orderNumber },
      { status: 201 },
    );
  } catch (err) {
    return apiError(err, "POST /api/merchant/orders");
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
        id: parsed.data.id,
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

    revalidatePath("/dashboard", "layout");
    return NextResponse.json({
      id: updatedOrder.id,
      status: updatedOrder.status,
      refundedAmount:
        action === "PARTIAL_REFUND" ? partialRefundAmount : existing.total,
    });
  } catch (err) {
    return apiError(err, "PUT /api/merchant/orders");
  }
}
