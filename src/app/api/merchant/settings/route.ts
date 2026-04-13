import { prisma } from "@/lib/db";
import { setMerchantSession } from "@/lib/merchantAuth";
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
  currencyFormat: z
    .enum(["symbol", "code", "none"])
    .optional()
    .default("symbol"),
  numberFormat: z.enum(["western", "eastern"]).optional().default("western"),
  dateFormat: z
    .enum(["long", "numeric", "arabic", "gregorian", "hijri"])
    .optional()
    .default("long"),
  language: z.enum(["en", "ar"]).optional().default("en"),
  taxRate: z.number().min(0).max(100),
  shamcashId: z.string().max(100).optional().default(""),
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
        currencyFormat: parsed.data.currencyFormat,
        numberFormat: parsed.data.numberFormat,
        dateFormat: normalizeDateFormat(parsed.data.dateFormat),
        language: parsed.data.language,
        taxRate: parsed.data.taxRate,
        shamcashId: parsed.data.shamcashId || null,
      },
    });

    await setMerchantSession({
      id: updated.id,
      name: updated.name,
      currency: updated.currency,
      currencyFormat: updated.currencyFormat ?? "symbol",
      taxRate: updated.taxRate,
      phone: updated.phone,
      address: updated.address,
      numberFormat: updated.numberFormat ?? "western",
      dateFormat: updated.dateFormat ?? "long",
      language: updated.language ?? "en",
      shamcashId: updated.shamcashId ?? null,
      onboardingDone: updated.onboardingDone ?? false,
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
