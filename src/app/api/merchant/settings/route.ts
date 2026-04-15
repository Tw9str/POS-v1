import { prisma } from "@/lib/db";
import { setMerchantSession } from "@/lib/merchantAuth";
import { getMerchantFromSession } from "@/lib/merchant";
import { requireStaffForApi } from "@/lib/staff";
import { normalizeDateFormat } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

const settingsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  currency: z.string().min(3).max(3).optional(),
  currencyFormat: z.enum(["symbol", "code", "none"]).optional(),
  numberFormat: z.enum(["western", "eastern"]).optional(),
  dateFormat: z
    .enum(["long", "numeric", "arabic", "gregorian", "hijri"])
    .optional(),
  language: z.enum(["en", "ar"]).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  shamcashId: z.string().max(100).optional(),
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

    const data: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.phone !== undefined) data.phone = parsed.data.phone || null;
    if (parsed.data.address !== undefined)
      data.address = parsed.data.address || null;
    if (parsed.data.currency !== undefined)
      data.currency = parsed.data.currency;
    if (parsed.data.currencyFormat !== undefined)
      data.currencyFormat = parsed.data.currencyFormat;
    if (parsed.data.numberFormat !== undefined)
      data.numberFormat = parsed.data.numberFormat;
    if (parsed.data.dateFormat !== undefined)
      data.dateFormat = normalizeDateFormat(parsed.data.dateFormat);
    if (parsed.data.language !== undefined)
      data.language = parsed.data.language;
    if (parsed.data.taxRate !== undefined) data.taxRate = parsed.data.taxRate;
    if (parsed.data.shamcashId !== undefined)
      data.shamcashId = parsed.data.shamcashId || null;

    const updated = await prisma.merchant.update({
      where: { id: merchant.id },
      data,
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
