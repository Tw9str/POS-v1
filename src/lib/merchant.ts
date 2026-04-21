import { prisma, getGracePeriodDays } from "@/lib/db";
import { getMerchantSession, setMerchantSession } from "@/lib/merchantAuth";
import { checkMerchantLicense } from "@/lib/licenseCheck";
import { getEffectiveStatus } from "@/lib/constants";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export async function getMerchantFromSession() {
  const cached = await getMerchantSession();
  if (!cached) return null;

  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: cached.id },
      include: { subscription: true },
    });

    if (!merchant) return null;

    // Refresh cookie cache if merchant data changed
    if (
      merchant.name !== cached.name ||
      merchant.currency !== cached.currency ||
      merchant.taxRate !== cached.taxRate ||
      merchant.phone !== cached.phone ||
      merchant.address !== cached.address ||
      (merchant.numberFormat ?? "western") !== cached.numberFormat ||
      (merchant.dateFormat ?? "long") !== cached.dateFormat ||
      (merchant.language ?? "en") !== cached.language ||
      (merchant.currencyFormat ?? "symbol") !== cached.currencyFormat ||
      (merchant.shamcashId ?? null) !== cached.shamcashId ||
      (merchant.onboardingDone ?? false) !== cached.onboardingDone
    ) {
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
    }

    return merchant;
  } catch {
    // DB unreachable · return cached merchant data from cookie
    return {
      id: cached.id,
      name: cached.name,
      slug: "",
      phone: cached.phone,
      address: cached.address,
      logo: null,
      currency: cached.currency,
      currencyFormat: cached.currencyFormat ?? "symbol",
      timezone: "Asia/Damascus",
      taxRate: cached.taxRate,
      numberFormat: cached.numberFormat ?? "western",
      dateFormat: cached.dateFormat ?? "long",
      language: cached.language ?? "en",
      shamcashId: cached.shamcashId ?? null,
      onboardingDone: cached.onboardingDone ?? false,
      isActive: true,
      subscription: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

export async function requireMerchant() {
  const merchant = await getMerchantFromSession();
  if (!merchant) {
    redirect("/store");
  }
  return merchant;
}

/**
 * For write APIs: requires a valid merchant session, active license,
 * and a non-suspended/non-expired subscription.
 * Returns {error, merchant, license} – if error is set, return it immediately.
 */
export async function requireActiveMerchant() {
  const merchant = await getMerchantFromSession();
  if (!merchant) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      merchant: null,
      license: null,
    };
  }

  // Check subscription status
  const sub = merchant.subscription;
  const gracePeriodDays = await getGracePeriodDays();
  const effectiveStatus = getEffectiveStatus(
    sub?.status,
    sub?.expiresAt,
    gracePeriodDays,
  );
  if (effectiveStatus === "SUSPENDED") {
    return {
      error: NextResponse.json({ error: "Account suspended" }, { status: 403 }),
      merchant: null,
      license: null,
    };
  }
  if (effectiveStatus === "EXPIRED") {
    return {
      error: NextResponse.json(
        { error: "Subscription expired" },
        { status: 403 },
      ),
      merchant: null,
      license: null,
    };
  }

  const { error, license } = await checkMerchantLicense(merchant.id);
  if (error) {
    return { error, merchant: null, license: null };
  }

  return { error: null, merchant, license };
}

/**
 * For all merchant API routes: requires a valid session and
 * non-suspended/non-expired subscription (no license check).
 */
export async function requireMerchantForApi() {
  const merchant = await getMerchantFromSession();
  if (!merchant) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      merchant: null as never,
    };
  }

  const sub = merchant.subscription;
  const graceDays = await getGracePeriodDays();
  const effectiveStatus = getEffectiveStatus(
    sub?.status,
    sub?.expiresAt,
    graceDays,
  );
  if (effectiveStatus === "SUSPENDED") {
    return {
      error: NextResponse.json({ error: "Account suspended" }, { status: 403 }),
      merchant: null as never,
    };
  }
  if (effectiveStatus === "EXPIRED") {
    return {
      error: NextResponse.json(
        { error: "Subscription expired" },
        { status: 403 },
      ),
      merchant: null as never,
    };
  }

  return { error: null, merchant };
}
