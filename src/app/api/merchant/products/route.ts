import { prisma } from "@/lib/db";
import { getMerchantFromSession } from "@/lib/merchant";
import { NextResponse } from "next/server";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().max(50).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  price: z.number().min(0),
  costPrice: z.number().min(0).default(0),
  stock: z.number().int().min(0).default(0),
  lowStockAt: z.number().int().min(0).default(5),
  unit: z.string().default("piece"),
  trackStock: z.boolean().default(true),
});

export async function GET() {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const products = await prisma.product.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: "desc" },
      include: { category: { select: { id: true, name: true } } },
    });

    return NextResponse.json(products);
  } catch (err) {
    console.error("GET /api/merchant/products error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = productSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const data = parsed.data;

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
        sku: data.sku || null,
        barcode: data.barcode || null,
        categoryId: data.categoryId || null,
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

    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    console.error("POST /api/merchant/products error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
