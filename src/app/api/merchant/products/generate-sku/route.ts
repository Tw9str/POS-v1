import { prisma } from "@/lib/db";
import { getMerchantFromSession } from "@/lib/merchant";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId")?.trim() || null;

    // Build prefix from category name or default "PRD"
    let prefix = "PRD";
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, merchantId: merchant.id },
        select: { name: true },
      });
      if (category) {
        // Take first 3 letters of category name, uppercase
        prefix =
          category.name
            .replace(/[^a-zA-Z\u0600-\u06FF]/g, "")
            .slice(0, 3)
            .toUpperCase() || "PRD";
      }
    }

    // Count existing products with this prefix to determine next number
    const existing = await prisma.product.count({
      where: {
        merchantId: merchant.id,
        sku: { startsWith: `${prefix}-` },
      },
    });

    const sku = `${prefix}-${String(existing + 1).padStart(3, "0")}`;

    return NextResponse.json({ sku });
  } catch (err) {
    return apiError(err, "GET /api/merchant/products/generate-sku");
  }
}
