import { prisma } from "@/lib/db";
import { getMerchantFromSession } from "@/lib/merchant";
import { requireStaffForApi } from "@/lib/staff";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { z } from "zod";

const validateSchema = z.object({
  code: z
    .string()
    .min(1)
    .transform((v) => v.toUpperCase().trim()),
  subtotal: z.number().min(0),
  customerId: z.string().optional().nullable(),
  cartItems: z
    .array(
      z.object({
        productId: z.string(),
        categoryId: z.string().optional().nullable(),
        quantity: z.number(),
        lineTotal: z.number(),
      }),
    )
    .optional(),
});

export async function POST(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await requireStaffForApi("/api/merchant/promotions");
    if (error) return error;

    const parsed = validateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const { code, subtotal, customerId, cartItems } = parsed.data;

    const promo = await prisma.promotion.findFirst({
      where: { merchantId: merchant.id, code, isActive: true },
    });

    if (!promo) {
      return NextResponse.json(
        { valid: false, reason: "Promo code not found" },
        { status: 200 },
      );
    }

    const now = new Date();

    if (promo.startsAt && now < promo.startsAt) {
      return NextResponse.json(
        { valid: false, reason: "Promo code is not active yet" },
        { status: 200 },
      );
    }

    if (promo.endsAt && now > promo.endsAt) {
      return NextResponse.json(
        { valid: false, reason: "Promo code has expired" },
        { status: 200 },
      );
    }

    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
      return NextResponse.json(
        { valid: false, reason: "Promo code usage limit reached" },
        { status: 200 },
      );
    }

    if (promo.maxUsesPerCustomer && customerId) {
      const customerUsage = await prisma.order.count({
        where: {
          merchantId: merchant.id,
          promoId: promo.id,
          customerId,
          status: { not: "VOIDED" },
        },
      });
      if (customerUsage >= promo.maxUsesPerCustomer) {
        return NextResponse.json(
          {
            valid: false,
            reason: "Customer has exceeded usage limit for this code",
          },
          { status: 200 },
        );
      }
    }

    if (subtotal < promo.minSubtotal) {
      return NextResponse.json(
        {
          valid: false,
          reason: `Minimum subtotal of ${promo.minSubtotal} required`,
        },
        { status: 200 },
      );
    }

    // Calculate discount
    let discountAmount = 0;

    if (promo.scope === "ORDER") {
      discountAmount =
        promo.type === "PERCENT" ? subtotal * (promo.value / 100) : promo.value;
    } else if (promo.scope === "PRODUCT" && promo.scopeTargetId && cartItems) {
      const matchingItems = cartItems.filter(
        (i) => i.productId === promo.scopeTargetId,
      );
      const matchingTotal = matchingItems.reduce((s, i) => s + i.lineTotal, 0);
      discountAmount =
        promo.type === "PERCENT"
          ? matchingTotal * (promo.value / 100)
          : Math.min(promo.value, matchingTotal);
    } else if (promo.scope === "CATEGORY" && promo.scopeTargetId && cartItems) {
      const matchingItems = cartItems.filter(
        (i) => i.categoryId === promo.scopeTargetId,
      );
      const matchingTotal = matchingItems.reduce((s, i) => s + i.lineTotal, 0);
      discountAmount =
        promo.type === "PERCENT"
          ? matchingTotal * (promo.value / 100)
          : Math.min(promo.value, matchingTotal);
    }

    // Apply max discount cap
    if (promo.maxDiscount && discountAmount > promo.maxDiscount) {
      discountAmount = promo.maxDiscount;
    }

    // Never discount more than subtotal
    discountAmount = Math.min(discountAmount, subtotal);
    discountAmount = Math.round(discountAmount * 100) / 100;

    return NextResponse.json({
      valid: true,
      promo: {
        id: promo.id,
        code: promo.code,
        type: promo.type,
        value: promo.value,
        scope: promo.scope,
        scopeTargetId: promo.scopeTargetId,
      },
      discountAmount,
    });
  } catch (err) {
    return apiError(err, "POST /api/merchant/promotions/validate");
  }
}
