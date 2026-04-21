"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "./_shared";
import { requireMerchant, requireStaffAction } from "./_shared";

const adjustmentSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(["PURCHASE", "RETURN", "DAMAGE", "CORRECTION", "TRANSFER"]),
  quantity: z
    .number()
    .int()
    .refine((v) => v !== 0, "Quantity change cannot be zero"),
  reason: z.string().max(250).optional().nullable(),
});

export async function createInventoryAdjustment(
  input: z.infer<typeof adjustmentSchema>,
): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr } = await requireStaffAction(
    "/api/merchant/inventory/adjustments",
    "POST",
  );
  if (sErr) return { error: sErr };

  const parsed = adjustmentSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const product = await prisma.product.findFirst({
    where: {
      id: parsed.data.productId,
      merchantId: merchant.id,
      isActive: true,
    },
    select: { id: true, name: true, stock: true, trackStock: true },
  });
  if (!product) return { error: "Product not found" };
  if (!product.trackStock)
    return { error: "This product does not track inventory" };

  const nextStock = product.stock + parsed.data.quantity;
  if (nextStock < 0) return { error: "Stock cannot go below zero" };

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
  return {
    success: true,
    data: {
      productId: updated.id,
      productName: product.name,
      stock: updated.stock,
    },
  };
}

export async function adjustInventoryFormAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return createInventoryAdjustment({
    productId: formData.get("productId") as string,
    type: formData.get("type") as
      | "PURCHASE"
      | "RETURN"
      | "DAMAGE"
      | "CORRECTION"
      | "TRANSFER",
    quantity: parseInt((formData.get("quantity") as string) || "0"),
    reason: (formData.get("reason") as string) || null,
  });
}

export async function getInventoryAdjustments(productId?: string) {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return [];

  return prisma.inventoryAdjustment.findMany({
    where: { merchantId: merchant.id, ...(productId ? { productId } : {}) },
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
}
