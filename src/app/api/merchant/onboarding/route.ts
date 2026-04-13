import { prisma } from "@/lib/db";
import { setMerchantSession } from "@/lib/merchantAuth";
import { getMerchantFromSession } from "@/lib/merchant";
import { NextResponse } from "next/server";
import { z } from "zod";

const onboardingSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(30).optional().default(""),
  address: z.string().max(500).optional().default(""),
  currency: z.string().min(3).max(3),
  language: z.enum(["en", "ar"]).optional().default("en"),
  taxRate: z.number().min(0).max(100),
  shamcashId: z.string().max(100).optional().default(""),
  ownerName: z.string().min(1).max(100),
  ownerPin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/),
});

export async function POST(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (merchant.onboardingDone) {
      return NextResponse.json(
        { error: "Onboarding already completed" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const parsed = onboardingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const { ownerName, ownerPin, ...merchantData } = parsed.data;

    // Use a transaction to update merchant + create owner staff atomically
    const updated = await prisma.$transaction(async (tx) => {
      const m = await tx.merchant.update({
        where: { id: merchant.id },
        data: {
          name: merchantData.name,
          phone: merchantData.phone || null,
          address: merchantData.address || null,
          currency: merchantData.currency.toUpperCase(),
          language: merchantData.language,
          taxRate: merchantData.taxRate,
          shamcashId: merchantData.shamcashId || null,
          onboardingDone: true,
        },
      });

      // Check if an owner staff already exists
      const existingOwner = await tx.staff.findFirst({
        where: { merchantId: merchant.id, role: "OWNER" },
      });

      if (existingOwner) {
        // Update existing owner
        await tx.staff.update({
          where: { id: existingOwner.id },
          data: { name: ownerName, pin: ownerPin },
        });
      } else {
        // Create new owner staff
        await tx.staff.create({
          data: {
            merchantId: merchant.id,
            name: ownerName,
            pin: ownerPin,
            role: "OWNER",
          },
        });
      }

      return m;
    });

    // Re-cache session with updated data
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
      onboardingDone: true,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/merchant/onboarding error:", err);

    // Handle unique constraint violation (duplicate PIN for merchant)
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint failed")
    ) {
      return NextResponse.json(
        { error: "This PIN is already in use by another staff member." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
