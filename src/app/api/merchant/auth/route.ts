import { prisma } from "@/lib/db";
import { setMerchantSession } from "@/lib/merchantAuth";
import { hashAccessCode } from "@/lib/accessCode";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { z } from "zod";
import { t, type Locale } from "@/lib/i18n";

const authSchema = z.object({
  accessCode: z.string().min(1, "Access code is required"),
});

const loginLimiter = rateLimit({ limit: 10, windowSeconds: 60 });

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = loginLimiter.check(ip);
    if (!rl.success) {
      return NextResponse.json(
        { error: t("en").storeLogin.tooManyAttempts },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSeconds) },
        },
      );
    }

    const body = await req.json();
    const parsed = authSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const code = parsed.data.accessCode.toUpperCase().trim();
    const digest = hashAccessCode(code);

    // Look up by SHA-256 digest — no plaintext stored
    const merchant = await prisma.merchant.findUnique({
      where: { accessCodeDigest: digest },
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
        { error: t("en").storeLogin.invalidCode },
        { status: 401 },
      );
    }

    if (!merchant.isActive) {
      const lang = (merchant.language ?? "en") as Locale;
      return NextResponse.json(
        {
          error: t(lang).storeLogin.deactivated,
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
          ? t("en").storeLogin.connectionError
          : "Internal server error",
      },
      { status: isConnectionError ? 503 : 500 },
    );
  }
}
