import { prisma } from "@/lib/db";
import { getMerchantFromSession } from "@/lib/merchant";
import { requireStaffForApi } from "@/lib/staff";
import { apiError } from "@/lib/apiError";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

const promoSchema = z.object({
  id: z.string().optional(),
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

const deleteSchema = z.object({
  id: z.string().min(1),
});

const toggleSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean(),
});

export async function GET() {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await requireStaffForApi("/api/merchant/promotions");
    if (error) return error;

    const promotions = await prisma.promotion.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(promotions);
  } catch (err) {
    return apiError(err, "GET /api/merchant/promotions");
  }
}

export async function POST(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error, staff } = await requireStaffForApi(
      "/api/merchant/promotions",
    );
    if (error) return error;

    // Only owner/manager can create promos
    if (staff && staff.role !== "OWNER" && staff.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = promoSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    // Check unique code
    const existing = await prisma.promotion.findFirst({
      where: { merchantId: merchant.id, code: parsed.data.code },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Promo code "${parsed.data.code}" already exists` },
        { status: 400 },
      );
    }

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
    return NextResponse.json(promo, { status: 201 });
  } catch (err) {
    return apiError(err, "POST /api/merchant/promotions");
  }
}

export async function PUT(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error, staff } = await requireStaffForApi(
      "/api/merchant/promotions",
    );
    if (error) return error;

    if (staff && staff.role !== "OWNER" && staff.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    // Quick toggle: only id + isActive
    const toggle = toggleSchema.safeParse(body);
    if (toggle.success && Object.keys(body).length === 2) {
      const existing = await prisma.promotion.findFirst({
        where: { id: toggle.data.id, merchantId: merchant.id },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Promotion not found" },
          { status: 404 },
        );
      }
      const updated = await prisma.promotion.update({
        where: { id: toggle.data.id },
        data: { isActive: toggle.data.isActive },
      });
      revalidatePath("/dashboard/promos");
      return NextResponse.json(updated);
    }

    // Full update
    const parsed = promoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const id = body.id;
    if (!id) {
      return NextResponse.json(
        { error: "Promotion ID required" },
        { status: 400 },
      );
    }

    const existing = await prisma.promotion.findFirst({
      where: { id, merchantId: merchant.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Promotion not found" },
        { status: 404 },
      );
    }

    // Check code uniqueness excluding self
    const codeConflict = await prisma.promotion.findFirst({
      where: {
        merchantId: merchant.id,
        code: parsed.data.code,
        NOT: { id },
      },
    });
    if (codeConflict) {
      return NextResponse.json(
        { error: `Promo code "${parsed.data.code}" already exists` },
        { status: 400 },
      );
    }

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
    return NextResponse.json(updated);
  } catch (err) {
    return apiError(err, "PUT /api/merchant/promotions");
  }
}

export async function DELETE(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error, staff } = await requireStaffForApi(
      "/api/merchant/promotions",
    );
    if (error) return error;

    if (staff && staff.role !== "OWNER" && staff.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = deleteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const promo = await prisma.promotion.findFirst({
      where: { id: parsed.data.id, merchantId: merchant.id },
    });
    if (!promo) {
      return NextResponse.json(
        { error: "Promotion not found" },
        { status: 404 },
      );
    }

    await prisma.promotion.delete({
      where: { id: parsed.data.id },
    });

    revalidatePath("/dashboard/promos");
    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError(err, "DELETE /api/merchant/promotions");
  }
}
