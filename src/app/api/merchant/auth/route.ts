import { prisma } from "@/lib/db";
import { setMerchantSession } from "@/lib/merchantAuth";
import { NextResponse } from "next/server";
import { z } from "zod";

const authSchema = z.object({
  accessCode: z.string().min(1, "Access code is required"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = authSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const code = parsed.data.accessCode.toUpperCase().trim();

    const merchant = await prisma.merchant.findUnique({
      where: { accessCode: code },
      select: {
        id: true,
        name: true,
        isActive: true,
        currency: true,
        currencyFormat: true,
        taxRate: true,
        phone: true,
        address: true,
        numberFormat: true,
        dateFormat: true,
        language: true,
        shamcashId: true,
        onboardingDone: true,
      },
    });

    if (!merchant) {
      return NextResponse.json(
        { error: "Invalid access code. Please check with your administrator." },
        { status: 401 },
      );
    }

    if (!merchant.isActive) {
      return NextResponse.json(
        {
          error: "This store has been deactivated. Contact your administrator.",
        },
        { status: 403 },
      );
    }

    await setMerchantSession({
      id: merchant.id,
      name: merchant.name,
      currency: merchant.currency,
      currencyFormat: merchant.currencyFormat ?? "symbol",
      taxRate: merchant.taxRate,
      phone: merchant.phone,
      address: merchant.address,
      numberFormat: merchant.numberFormat ?? "western",
      dateFormat: merchant.dateFormat ?? "long",
      language: merchant.language ?? "en",
      shamcashId: merchant.shamcashId ?? null,
      onboardingDone: merchant.onboardingDone ?? false,
    });

    return NextResponse.json({
      success: true,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        currency: merchant.currency,
        taxRate: merchant.taxRate,
      },
    });
  } catch (err) {
    console.error("POST /api/merchant/auth error:", err);
    const isConnectionError =
      err instanceof Error && err.message.includes("Can't reach database");
    return NextResponse.json(
      {
        error: isConnectionError
          ? "Unable to connect. Please check your internet connection and try again."
          : "Internal server error",
      },
      { status: isConnectionError ? 503 : 500 },
    );
  }
}
