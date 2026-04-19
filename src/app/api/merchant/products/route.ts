import { prisma } from "@/lib/db";
import { getMerchantFromSession, requireActiveMerchant } from "@/lib/merchant";
import { requireStaffForApi } from "@/lib/staff";
import { apiError } from "@/lib/apiError";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

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

const productUpdateSchema = productSchema.extend({
  id: z.string().min(1),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function GET() {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error: staffError } = await requireStaffForApi(
      "/api/merchant/products",
    );
    if (staffError) return staffError;

    const products = await prisma.product.findMany({
      where: { merchantId: merchant.id, isActive: true },
      orderBy: { createdAt: "desc" },
      include: { category: { select: { id: true, name: true, color: true } } },
    });

    return NextResponse.json(products);
  } catch (err) {
    return apiError(err, "GET /api/merchant/products");
  }
}

export async function POST(req: Request) {
  try {
    const {
      error: authError,
      merchant,
      license,
    } = await requireActiveMerchant();
    if (authError || !merchant) return authError!;

    const { error } = await requireStaffForApi("/api/merchant/products");
    if (error) return error;

    // Plan limit: max products
    if (license?.maxProducts) {
      const activeCount = await prisma.product.count({
        where: { merchantId: merchant.id, isActive: true },
      });
      if (activeCount >= license.maxProducts) {
        return NextResponse.json(
          {
            error: `Product limit reached (${license.maxProducts}). Upgrade your plan to add more products.`,
          },
          { status: 403 },
        );
      }
    }

    const body = await req.json();
    const parsed = productSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Check duplicate name + variant (case-insensitive)
    const duplicateVariant = await prisma.product.findFirst({
      where: {
        merchantId: merchant.id,
        name: { equals: data.name, mode: "insensitive" },
        variantName: data.variantName?.trim()
          ? { equals: data.variantName.trim(), mode: "insensitive" }
          : null,
        isActive: true,
      },
    });
    if (duplicateVariant) {
      return NextResponse.json(
        {
          error: data.variantName
            ? `A variant "${data.variantName}" already exists for "${data.name}"`
            : `A product named "${data.name}" already exists`,
        },
        { status: 400 },
      );
    }

    // Check unique SKU
    if (data.sku) {
      const skuExists = await prisma.product.findUnique({
        where: { merchantId_sku: { merchantId: merchant.id, sku: data.sku } },
      });
      if (skuExists) {
        return NextResponse.json(
          { error: "SKU already exists" },
          { status: 400 },
        );
      }
    }

    // Check unique barcode
    if (data.barcode) {
      const barcodeExists = await prisma.product.findUnique({
        where: {
          merchantId_barcode: {
            merchantId: merchant.id,
            barcode: data.barcode,
          },
        },
      });
      if (barcodeExists) {
        return NextResponse.json(
          { error: "Barcode already exists" },
          { status: 400 },
        );
      }
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

    // Log initial stock as inventory adjustment
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
    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    return apiError(err, "POST /api/merchant/products");
  }
}

export async function PUT(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await requireStaffForApi("/api/merchant/products");
    if (error) return error;

    const body = await req.json();
    const parsed = productUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const existing = await prisma.product.findFirst({
      where: { id: parsed.data.id, merchantId: merchant.id, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Check duplicate name + variant (case-insensitive)
    const duplicateVariant = await prisma.product.findFirst({
      where: {
        merchantId: merchant.id,
        name: { equals: parsed.data.name, mode: "insensitive" },
        variantName: parsed.data.variantName?.trim()
          ? { equals: parsed.data.variantName.trim(), mode: "insensitive" }
          : null,
        isActive: true,
        NOT: { id: parsed.data.id },
      },
    });
    if (duplicateVariant) {
      return NextResponse.json(
        {
          error: parsed.data.variantName
            ? `A variant "${parsed.data.variantName}" already exists for "${parsed.data.name}"`
            : `A product named "${parsed.data.name}" already exists`,
        },
        { status: 400 },
      );
    }

    if (parsed.data.sku) {
      const skuExists = await prisma.product.findFirst({
        where: {
          merchantId: merchant.id,
          sku: parsed.data.sku,
          isActive: true,
          NOT: { id: parsed.data.id },
        },
      });
      if (skuExists) {
        return NextResponse.json(
          { error: "SKU already exists" },
          { status: 400 },
        );
      }
    }

    if (parsed.data.barcode) {
      const barcodeExists = await prisma.product.findFirst({
        where: {
          merchantId: merchant.id,
          barcode: parsed.data.barcode,
          isActive: true,
          NOT: { id: parsed.data.id },
        },
      });
      if (barcodeExists) {
        return NextResponse.json(
          { error: "Barcode already exists" },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.product.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        variantName: parsed.data.variantName?.trim() || null,
        sku: parsed.data.sku || null,
        barcode: parsed.data.barcode || null,
        categoryId: parsed.data.categoryId,
        price: parsed.data.price,
        costPrice: parsed.data.costPrice,
        stock: parsed.data.stock,
        lowStockAt: parsed.data.lowStockAt,
        unit: parsed.data.unit,
        trackStock: parsed.data.trackStock,
      },
      include: { category: { select: { id: true, name: true, color: true } } },
    });

    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard/inventory");
    return NextResponse.json(updated);
  } catch (err) {
    return apiError(err, "PUT /api/merchant/products");
  }
}

export async function DELETE(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await requireStaffForApi("/api/merchant/products");
    if (error) return error;

    const parsed = deleteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const existing = await prisma.product.findFirst({
      where: { id: parsed.data.id, merchantId: merchant.id, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await prisma.product.update({
      where: { id: parsed.data.id },
      data: { isActive: false },
    });

    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard/inventory");
    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError(err, "DELETE /api/merchant/products");
  }
}
