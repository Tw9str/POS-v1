"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "./_shared";
import { requireMerchant, requireStaffAction } from "./_shared";

export async function getPromotions(merchantId: string) {
  return prisma.promotion.findMany({
    where: { merchantId },
    orderBy: { createdAt: "desc" },
  });
}

const promoSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(50)
    .transform((v) => v.toUpperCase().trim()),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.number().min(0),
  scope: z.enum(["ORDER", "PRODUCT", "CATEGORY"]).default("ORDER"),
  scopeTargetId: z.string().optional().nullable(),
  minSubtotal: z.number().min(0).default(0),
  maxDiscount: z.number().min(0).optional().nullable(),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
  maxUses: z.number().int().min(1).optional().nullable(),
  maxUsesPerCustomer: z.number().int().min(1).optional().nullable(),
  stackable: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export async function createPromotion(
  input: z.input<typeof promoSchema>,
): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr, staff } = await requireStaffAction(
    "/api/merchant/promotions",
    "POST",
  );
  if (sErr) return { error: sErr };

  if (staff && staff.role !== "OWNER" && staff.role !== "MANAGER") {
    return { error: "Only owners and managers can create promotions" };
  }

  const parsed = promoSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const existing = await prisma.promotion.findFirst({
    where: { merchantId: merchant.id, code: parsed.data.code },
  });
  if (existing)
    return { error: `Promo code "${parsed.data.code}" already exists` };

  const promo = await prisma.promotion.create({
    data: {
      merchantId: merchant.id,
      code: parsed.data.code,
      type: parsed.data.type,
      value: parsed.data.value,
      scope: parsed.data.scope,
      scopeTargetId: parsed.data.scopeTargetId || null,
      minSubtotal: parsed.data.minSubtotal,
      maxDiscount: parsed.data.maxDiscount || null,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      maxUses: parsed.data.maxUses || null,
      maxUsesPerCustomer: parsed.data.maxUsesPerCustomer || null,
      stackable: parsed.data.stackable,
      isActive: parsed.data.isActive,
      createdBy: staff?.staffId || null,
    },
  });

  revalidatePath("/dashboard/promos");
  return { success: true, data: promo };
}

export async function updatePromotion(
  id: string,
  input: z.input<typeof promoSchema>,
): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr, staff } = await requireStaffAction(
    "/api/merchant/promotions",
    "PUT",
  );
  if (sErr) return { error: sErr };

  if (staff && staff.role !== "OWNER" && staff.role !== "MANAGER") {
    return { error: "Only owners and managers can edit promotions" };
  }

  const parsed = promoSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const existing = await prisma.promotion.findFirst({
    where: { id, merchantId: merchant.id },
  });
  if (!existing) return { error: "Promotion not found" };

  const codeConflict = await prisma.promotion.findFirst({
    where: { merchantId: merchant.id, code: parsed.data.code, NOT: { id } },
  });
  if (codeConflict)
    return { error: `Promo code "${parsed.data.code}" already exists` };

  const updated = await prisma.promotion.update({
    where: { id },
    data: {
      code: parsed.data.code,
      type: parsed.data.type,
      value: parsed.data.value,
      scope: parsed.data.scope,
      scopeTargetId: parsed.data.scopeTargetId || null,
      minSubtotal: parsed.data.minSubtotal,
      maxDiscount: parsed.data.maxDiscount || null,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      maxUses: parsed.data.maxUses || null,
      maxUsesPerCustomer: parsed.data.maxUsesPerCustomer || null,
      stackable: parsed.data.stackable,
      isActive: parsed.data.isActive,
    },
  });

  revalidatePath("/dashboard/promos");
  return { success: true, data: updated };
}

export async function togglePromotion(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr, staff } = await requireStaffAction(
    "/api/merchant/promotions",
    "PUT",
  );
  if (sErr) return { error: sErr };

  if (staff && staff.role !== "OWNER" && staff.role !== "MANAGER") {
    return { error: "Only owners and managers can manage promotions" };
  }

  const existing = await prisma.promotion.findFirst({
    where: { id, merchantId: merchant.id },
  });
  if (!existing) return { error: "Promotion not found" };

  await prisma.promotion.update({ where: { id }, data: { isActive } });

  revalidatePath("/dashboard/promos");
  return { success: true };
}

export async function deletePromotion(id: string): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr, staff } = await requireStaffAction(
    "/api/merchant/promotions",
    "DELETE",
  );
  if (sErr) return { error: sErr };

  if (staff && staff.role !== "OWNER" && staff.role !== "MANAGER") {
    return { error: "Only owners and managers can delete promotions" };
  }

  const existing = await prisma.promotion.findFirst({
    where: { id, merchantId: merchant.id },
  });
  if (!existing) return { error: "Promotion not found" };

  await prisma.promotion.delete({ where: { id } });

  revalidatePath("/dashboard/promos");
  return { success: true };
}

export async function savePromotionAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = formData.get("id") as string | null;
  const input: z.input<typeof promoSchema> = {
    code: formData.get("code") as string,
    type: formData.get("type") as "PERCENT" | "FIXED",
    value: parseFloat((formData.get("value") as string) || "0"),
    scope:
      (formData.get("scope") as "ORDER" | "PRODUCT" | "CATEGORY") ?? "ORDER",
    scopeTargetId: (formData.get("scopeTargetId") as string) || null,
    minSubtotal: parseFloat((formData.get("minSubtotal") as string) || "0"),
    maxDiscount: formData.get("maxDiscount")
      ? parseFloat(formData.get("maxDiscount") as string)
      : null,
    startsAt: (formData.get("startsAt") as string) || null,
    endsAt: (formData.get("endsAt") as string) || null,
    maxUses: formData.get("maxUses")
      ? parseInt(formData.get("maxUses") as string)
      : null,
    maxUsesPerCustomer: formData.get("maxUsesPerCustomer")
      ? parseInt(formData.get("maxUsesPerCustomer") as string)
      : null,
    stackable: formData.get("stackable") === "true",
    isActive: formData.get("isActive") === "true",
  };
  return id ? updatePromotion(id, input) : createPromotion(input);
}

export async function validatePromoCode(input: {
  code: string;
  subtotal: number;
  customerId?: string | null;
  cartItems?: Array<{
    productId: string;
    categoryId?: string | null;
    quantity: number;
    lineTotal: number;
  }>;
}) {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { valid: false, reason: mErr };
  const { error: sErr } = await requireStaffAction(
    "/api/merchant/promotions/validate",
    "POST",
  );
  if (sErr) return { valid: false, reason: sErr };

  const code = input.code.toUpperCase().trim();
  const { subtotal, customerId, cartItems } = input;

  const promo = await prisma.promotion.findFirst({
    where: { merchantId: merchant.id, code, isActive: true },
  });

  if (!promo) return { valid: false, reason: "Promo code not found" };

  const now = new Date();
  if (promo.startsAt && now < promo.startsAt)
    return { valid: false, reason: "Promo code is not active yet" };
  if (promo.endsAt && now > promo.endsAt)
    return { valid: false, reason: "Promo code has expired" };
  if (promo.maxUses && promo.usedCount >= promo.maxUses)
    return { valid: false, reason: "Promo code usage limit reached" };

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
      return {
        valid: false,
        reason: "Customer has exceeded usage limit for this code",
      };
    }
  }

  if (subtotal < promo.minSubtotal) {
    return {
      valid: false,
      reason: `Minimum subtotal of ${promo.minSubtotal} required`,
    };
  }

  let discountAmount = 0;
  if (promo.scope === "ORDER") {
    discountAmount =
      promo.type === "PERCENT" ? subtotal * (promo.value / 100) : promo.value;
  } else if (promo.scope === "PRODUCT" && promo.scopeTargetId && cartItems) {
    const matching = cartItems.filter(
      (i) => i.productId === promo.scopeTargetId,
    );
    const matchingTotal = matching.reduce((s, i) => s + i.lineTotal, 0);
    discountAmount =
      promo.type === "PERCENT"
        ? matchingTotal * (promo.value / 100)
        : Math.min(promo.value, matchingTotal);
  } else if (promo.scope === "CATEGORY" && promo.scopeTargetId && cartItems) {
    const matching = cartItems.filter(
      (i) => i.categoryId === promo.scopeTargetId,
    );
    const matchingTotal = matching.reduce((s, i) => s + i.lineTotal, 0);
    discountAmount =
      promo.type === "PERCENT"
        ? matchingTotal * (promo.value / 100)
        : Math.min(promo.value, matchingTotal);
  }

  if (promo.maxDiscount && discountAmount > promo.maxDiscount)
    discountAmount = promo.maxDiscount;
  discountAmount = Math.min(discountAmount, subtotal);
  discountAmount = Math.round(discountAmount * 100) / 100;

  return {
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
  };
}
