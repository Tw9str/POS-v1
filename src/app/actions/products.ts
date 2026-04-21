"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "./_shared";
import {
  requireMerchant,
  requireMerchantWithLicense,
  requireStaffAction,
} from "./_shared";

// ─── Products ───

const productSchema = z.object({
  name: z.string().min(1).max(200),
  variantName: z.string().max(120).optional().nullable(),
  sku: z.string().max(50).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  categoryId: z.string().min(1),
  price: z.number().min(0),
  costPrice: z.number().min(0).default(0),
  stock: z.number().int().min(0).default(0),
  lowStockAt: z.number().int().min(0).default(5),
  unit: z.string().default("piece"),
  trackStock: z.boolean().default(true),
});

export async function createProduct(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { error: mErr, merchant, license } = await requireMerchantWithLicense();
  if (mErr) return { error: mErr };
  const { error: sErr } = await requireStaffAction(
    "/api/merchant/products",
    "POST",
  );
  if (sErr) return { error: sErr };

  if (license?.maxProducts) {
    const activeCount = await prisma.product.count({
      where: { merchantId: merchant.id, isActive: true },
    });
    if (activeCount >= license.maxProducts) {
      return {
        error: `Product limit reached (${license.maxProducts}). Upgrade your plan to add more products.`,
      };
    }
  }

  const raw = Object.fromEntries(formData);
  const parsed = productSchema.safeParse({
    ...raw,
    price: Number(raw.price),
    costPrice: Number(raw.costPrice ?? 0),
    stock: Number(raw.stock ?? 0),
    lowStockAt: Number(raw.lowStockAt ?? 5),
    trackStock: raw.trackStock === "true",
    variantName: raw.variantName || null,
    sku: raw.sku || null,
    barcode: raw.barcode || null,
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const dup = await prisma.product.findFirst({
    where: {
      merchantId: merchant.id,
      name: { equals: data.name, mode: "insensitive" },
      variantName: data.variantName?.trim()
        ? { equals: data.variantName.trim(), mode: "insensitive" }
        : null,
      isActive: true,
    },
  });
  if (dup) {
    return {
      error: data.variantName
        ? `A variant "${data.variantName}" already exists for "${data.name}"`
        : `A product named "${data.name}" already exists`,
    };
  }

  if (data.sku) {
    const skuExists = await prisma.product.findUnique({
      where: { merchantId_sku: { merchantId: merchant.id, sku: data.sku } },
    });
    if (skuExists) return { error: "SKU already exists" };
  }

  if (data.barcode) {
    const barcodeExists = await prisma.product.findUnique({
      where: {
        merchantId_barcode: { merchantId: merchant.id, barcode: data.barcode },
      },
    });
    if (barcodeExists) return { error: "Barcode already exists" };
  }

  const product = await prisma.product.create({
    data: {
      merchantId: merchant.id,
      name: data.name,
      variantName: data.variantName?.trim() || null,
      sku: data.sku || null,
      barcode: data.barcode || null,
      categoryId: data.categoryId,
      price: data.price,
      costPrice: data.costPrice,
      stock: data.stock,
      lowStockAt: data.lowStockAt,
      unit: data.unit,
      trackStock: data.trackStock,
    },
  });

  if (data.stock > 0 && data.trackStock) {
    await prisma.inventoryAdjustment
      .create({
        data: {
          merchantId: merchant.id,
          productId: product.id,
          type: "PURCHASE",
          quantity: data.stock,
          reason: "Initial stock",
        },
      })
      .catch(() => {});
  }

  await prisma.activityLog
    .create({
      data: {
        merchantId: merchant.id,
        action: "PRODUCT_CREATED",
        entity: "product",
        entityId: product.id,
      },
    })
    .catch(() => {});

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/pos");
  revalidatePath("/dashboard/inventory");
  return { success: true, data: product };
}

export async function updateProduct(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr } = await requireStaffAction(
    "/api/merchant/products",
    "PUT",
  );
  if (sErr) return { error: sErr };

  const raw = Object.fromEntries(formData);
  const id = raw.id as string;
  if (!id) return { error: "Product ID required" };

  const parsed = productSchema.safeParse({
    ...raw,
    price: Number(raw.price),
    costPrice: Number(raw.costPrice ?? 0),
    stock: Number(raw.stock ?? 0),
    lowStockAt: Number(raw.lowStockAt ?? 5),
    trackStock: raw.trackStock === "true",
    variantName: raw.variantName || null,
    sku: raw.sku || null,
    barcode: raw.barcode || null,
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const existing = await prisma.product.findFirst({
    where: { id, merchantId: merchant.id, isActive: true },
  });
  if (!existing) return { error: "Product not found" };

  const dup = await prisma.product.findFirst({
    where: {
      merchantId: merchant.id,
      name: { equals: data.name, mode: "insensitive" },
      variantName: data.variantName?.trim()
        ? { equals: data.variantName.trim(), mode: "insensitive" }
        : null,
      isActive: true,
      NOT: { id },
    },
  });
  if (dup) {
    return {
      error: data.variantName
        ? `A variant "${data.variantName}" already exists for "${data.name}"`
        : `A product named "${data.name}" already exists`,
    };
  }

  if (data.sku) {
    const skuExists = await prisma.product.findFirst({
      where: {
        merchantId: merchant.id,
        sku: data.sku,
        isActive: true,
        NOT: { id },
      },
    });
    if (skuExists) return { error: "SKU already exists" };
  }

  if (data.barcode) {
    const barcodeExists = await prisma.product.findFirst({
      where: {
        merchantId: merchant.id,
        barcode: data.barcode,
        isActive: true,
        NOT: { id },
      },
    });
    if (barcodeExists) return { error: "Barcode already exists" };
  }

  const updated = await prisma.product.update({
    where: { id },
    data: {
      name: data.name,
      variantName: data.variantName?.trim() || null,
      sku: data.sku || null,
      barcode: data.barcode || null,
      categoryId: data.categoryId,
      price: data.price,
      costPrice: data.costPrice,
      stock: data.stock,
      lowStockAt: data.lowStockAt,
      unit: data.unit,
      trackStock: data.trackStock,
    },
    include: { category: { select: { id: true, name: true, color: true } } },
  });

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/pos");
  revalidatePath("/dashboard/inventory");
  return { success: true, data: updated };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr } = await requireStaffAction(
    "/api/merchant/products",
    "DELETE",
  );
  if (sErr) return { error: sErr };

  const existing = await prisma.product.findFirst({
    where: { id, merchantId: merchant.id, isActive: true },
  });
  if (!existing) return { error: "Product not found" };

  await prisma.product.update({ where: { id }, data: { isActive: false } });

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/pos");
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function generateSku(
  categoryId: string,
): Promise<{ sku?: string; error?: string }> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };

  const category = await prisma.category.findFirst({
    where: { id: categoryId, merchantId: merchant.id, isActive: true },
  });
  if (!category) return { error: "Category not found" };

  const prefix = category.name.slice(0, 3).toUpperCase();
  const count = await prisma.product.count({
    where: { merchantId: merchant.id, categoryId, isActive: true },
  });
  return { sku: `${prefix}-${String(count + 1).padStart(4, "0")}` };
}

// ─── Categories ───

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().max(20).optional().nullable().default("#4f46e5"),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export async function createCategory(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr } = await requireStaffAction(
    "/api/merchant/products",
    "POST",
  );
  if (sErr) return { error: sErr };

  const raw = Object.fromEntries(formData);
  const parsed = categorySchema.safeParse({
    name: raw.name,
    color: raw.color || "#4f46e5",
    sortOrder: Number(raw.sortOrder ?? 0),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const exists = await prisma.category.findFirst({
    where: { merchantId: merchant.id, name: parsed.data.name, isActive: true },
  });
  if (exists) return { error: "Category already exists" };

  const category = await prisma.category.create({
    data: {
      merchantId: merchant.id,
      name: parsed.data.name,
      color: parsed.data.color || "#4f46e5",
      sortOrder: parsed.data.sortOrder ?? 0,
    },
  });

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/pos");
  return { success: true, data: category };
}

export async function updateCategory(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr } = await requireStaffAction(
    "/api/merchant/products",
    "PUT",
  );
  if (sErr) return { error: sErr };

  const raw = Object.fromEntries(formData);
  const id = raw.id as string;
  if (!id) return { error: "Category ID required" };

  const parsed = categorySchema.safeParse({
    name: raw.name,
    color: raw.color || "#4f46e5",
    sortOrder: Number(raw.sortOrder ?? 0),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const existing = await prisma.category.findFirst({
    where: { id, merchantId: merchant.id, isActive: true },
  });
  if (!existing) return { error: "Category not found" };

  const duplicate = await prisma.category.findFirst({
    where: {
      merchantId: merchant.id,
      name: parsed.data.name,
      isActive: true,
      NOT: { id },
    },
  });
  if (duplicate) return { error: "Category already exists" };

  const updated = await prisma.category.update({
    where: { id },
    data: {
      name: parsed.data.name,
      color: parsed.data.color || "#4f46e5",
      sortOrder: parsed.data.sortOrder ?? 0,
    },
  });

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/pos");
  return { success: true, data: updated };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr } = await requireStaffAction(
    "/api/merchant/products",
    "DELETE",
  );
  if (sErr) return { error: sErr };

  const category = await prisma.category.findFirst({
    where: { id, merchantId: merchant.id, isActive: true },
  });
  if (!category) return { error: "Category not found" };
  if (category.name === "Other")
    return { error: "The 'Other' category cannot be deleted" };

  let otherCategory = await prisma.category.findFirst({
    where: { merchantId: merchant.id, name: "Other", isActive: true },
  });
  if (!otherCategory) {
    otherCategory = await prisma.category.create({
      data: {
        merchantId: merchant.id,
        name: "Other",
        color: "#6b7280",
        sortOrder: 999,
      },
    });
  }

  await prisma.product.updateMany({
    where: { categoryId: id },
    data: { categoryId: otherCategory.id },
  });
  await prisma.category.update({ where: { id }, data: { isActive: false } });

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/pos");
  return { success: true };
}

export async function saveCategoryAction(
  prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = formData.get("id") as string | null;
  return id
    ? updateCategory(prevState, formData)
    : createCategory(prevState, formData);
}
