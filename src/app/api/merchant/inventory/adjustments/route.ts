import { prisma } from "@/lib/db";
import { getMerchantFromSession } from "@/lib/merchant";
import { requireStaffForApi } from "@/lib/staff";
import { apiError } from "@/lib/apiError";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

const adjustmentSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(["PURCHASE", "RETURN", "DAMAGE", "CORRECTION", "TRANSFER"]),
  quantity: z
    .number()
    .int()
    .refine((value) => value !== 0, "Quantity change cannot be zero"),
  reason: z.string().max(250).optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await requireStaffForApi(
      "/api/merchant/inventory/adjustments",
    );
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    const adjustments = await prisma.inventoryAdjustment.findMany({
      where: {
        merchantId: merchant.id,
        ...(productId ? { productId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            variantName: true,
            sku: true,
            unit: true,
          },
        },
      },
    });

    return NextResponse.json(adjustments);
  } catch (err) {
    return apiError(err, "GET /api/merchant/inventory/adjustments");
  }
}

export async function POST(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await requireStaffForApi(
      "/api/merchant/inventory/adjustments",
    );
    if (error) return error;

    const parsed = adjustmentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const product = await prisma.product.findFirst({
      where: {
        id: parsed.data.productId,
        merchantId: merchant.id,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        stock: true,
        trackStock: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (!product.trackStock) {
      return NextResponse.json(
        { error: "This product does not track inventory" },
        { status: 400 },
      );
    }

    const nextStock = product.stock + parsed.data.quantity;
    if (nextStock < 0) {
      return NextResponse.json(
        { error: "Stock cannot go below zero" },
        { status: 400 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: { stock: nextStock },
      });

      await tx.inventoryAdjustment.create({
        data: {
          merchantId: merchant.id,
          productId: product.id,
          type: parsed.data.type,
          quantity: parsed.data.quantity,
          reason:
            parsed.data.reason ||
            `${parsed.data.type.replaceAll("_", " ")} adjustment`,
        },
      });

      return updatedProduct;
    });

    await prisma.activityLog
      .create({
        data: {
          merchantId: merchant.id,
          action: "INVENTORY_ADJUSTED",
          entity: "product",
          entityId: product.id,
        },
      })
      .catch(() => {});

    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/pos");
    return NextResponse.json({
      success: true,
      productId: updated.id,
      productName: product.name,
      stock: updated.stock,
    });
  } catch (err) {
    return apiError(err, "POST /api/merchant/inventory/adjustments");
  }
}
