import { prisma } from "@/lib/db";
import { getMerchantFromSession } from "@/lib/merchant";
import { requireStaffForApi } from "@/lib/staff";
import { normalizeDateFormat } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

const settingsSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(30).optional().default(""),
  address: z.string().max(500).optional().default(""),
  currency: z.string().min(3).max(3),
  numberFormat: z.enum(["western", "eastern"]).optional().default("western"),
  dateFormat: z
    .enum(["long", "numeric", "arabic", "gregorian", "hijri"])
    .optional()
    .default("long"),
  taxRate: z.number().min(0).max(100),
});

export async function PUT(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await requireStaffForApi("/api/merchant/settings");
    if (error) return error;

    const body = await req.json();
    const parsed = settingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const updated = await prisma.merchant.update({
      where: { id: merchant.id },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        currency: parsed.data.currency,
        numberFormat: parsed.data.numberFormat,
        dateFormat: normalizeDateFormat(parsed.data.dateFormat),
        taxRate: parsed.data.taxRate,
      },
    });

    await prisma.activityLog
      .create({
        data: {
          merchantId: merchant.id,
          action: "SETTINGS_UPDATED",
          entity: "merchant",
          entityId: merchant.id,
        },
      })
      .catch(() => {});

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/merchant/settings error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
